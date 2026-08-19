import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type DataRoom } from '@prisma/client';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import {
  addNumericSuffix,
  normalizeName,
} from '../common/names/normalize-name';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDataRoomDto } from './dto/create-data-room.dto';
import type { ListDataRoomsQueryDto } from './dto/list-data-rooms-query.dto';
import type { UpdateDataRoomDto } from './dto/update-data-room.dto';
import {
  decodeItemCursor,
  encodeItemCursor,
  type ItemKind,
} from '../common/pagination/item-cursor';
import type { ListItemsQueryDto } from './dto/list-items-query.dto';
import type { DeletionSummary } from '../common/deletion/deletion-summary.type';
import { StorageService } from '../storage/storage.service';

type DataRoomDeletionSummaryRow = {
  folderCount: number;
  fileCount: number;
  totalBytes: bigint;
};

export type DataRoomPage = {
  items: DataRoom[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type DataRoomItem =
  | {
      type: 'folder';
      id: string;
      dataRoomId: string;
      parentId: string | null;
      name: string;
      createdAt: Date;
      updatedAt: Date;
    }
  | {
      type: 'file';
      id: string;
      dataRoomId: string;
      folderId: string | null;
      name: string;
      sizeBytes: string;
      mimeType: string;
      createdAt: Date;
      updatedAt: Date;
    };

export type DataRoomItemsPage = {
  items: DataRoomItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

type ItemRow = {
  type: ItemKind;
  kindRank: number;
  id: string;
  dataRoomId: string;
  containerId: string | null;
  name: string;
  normalizedName: string;
  sizeBytes: bigint | null;
  mimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AccessPolicyService,
    private readonly storage: StorageService,
  ) {}

  async delete(ownerId: string, dataRoomId: string): Promise<void> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const files = await this.prisma.fileRecord.findMany({
      where: {
        dataRoomId,
      },
      select: {
        storageKey: true,
      },
    });

    await this.storage.removeObjects(files.map((file) => file.storageKey));

    await this.prisma.$transaction(async (transaction) => {
      await transaction.dataRoom.deleteMany({
        where: {
          id: dataRoomId,
          ownerId,
        },
      });
    });
  }

  async listOwned(
    ownerId: string,
    query: ListDataRoomsQueryDto,
  ): Promise<DataRoomPage> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const rooms = await this.prisma.dataRoom.findMany({
      where: {
        ownerId,
        ...(cursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: cursor.createdAt,
                  },
                },
                {
                  createdAt: cursor.createdAt,
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rooms.length > query.limit;
    const items = hasMore ? rooms.slice(0, query.limit) : rooms;

    const lastItem = items.at(-1);

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? encodeCursor({
              id: lastItem.id,
              createdAt: lastItem.createdAt,
            })
          : null,
    };
  }

  async listItems(
    userId: string,
    dataRoomId: string,
    query: ListItemsQueryDto,
  ): Promise<DataRoomItemsPage> {
    const folderId = query.folderId ?? null;

    if (folderId) {
      await this.accessPolicy.assertCanRead(userId, {
        type: 'folder',
        id: folderId,
      });

      const belongsToDataRoom = await this.prisma.folder.findFirst({
        where: {
          id: folderId,
          dataRoomId,
        },
        select: {
          id: true,
        },
      });

      if (!belongsToDataRoom) {
        throw new NotFoundException('Resource is not available.');
      }
    } else {
      await this.accessPolicy.assertCanRead(userId, {
        type: 'dataRoom',
        id: dataRoomId,
      });
    }

    const cursor = query.cursor ? decodeItemCursor(query.cursor) : null;

    const cursorFilter = cursor
      ? Prisma.sql`
        WHERE
          "kindRank" > ${cursor.kindRank}
          OR (
            "kindRank" = ${cursor.kindRank}
            AND "normalizedName" > ${cursor.normalizedName}
          )
          OR (
            "kindRank" = ${cursor.kindRank}
            AND "normalizedName" = ${cursor.normalizedName}
            AND "id" > CAST(${cursor.id} AS UUID)
          )
      `
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ItemRow[]>(
      Prisma.sql`
      WITH all_items AS (
        SELECT
          'folder'::TEXT AS "type",
          0::INTEGER AS "kindRank",
          "id",
          "data_room_id" AS "dataRoomId",
          "parent_id" AS "containerId",
          "name",
          "normalized_name" AS "normalizedName",
          NULL::BIGINT AS "sizeBytes",
          NULL::TEXT AS "mimeType",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "folders"
        WHERE
          "data_room_id" = CAST(${dataRoomId} AS UUID)
          AND "parent_id" IS NOT DISTINCT FROM
            CAST(${folderId} AS UUID)

        UNION ALL

        SELECT
          'file'::TEXT AS "type",
          1::INTEGER AS "kindRank",
          "id",
          "data_room_id" AS "dataRoomId",
          "folder_id" AS "containerId",
          "name",
          "normalized_name" AS "normalizedName",
          "size_bytes" AS "sizeBytes",
          "mime_type" AS "mimeType",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "files"
        WHERE
          "data_room_id" = CAST(${dataRoomId} AS UUID)
          AND "folder_id" IS NOT DISTINCT FROM
            CAST(${folderId} AS UUID)
          AND "upload_status" = 'READY'::"UploadStatus"
      )
      SELECT *
      FROM all_items
      ${cursorFilter}
      ORDER BY
        "kindRank" ASC,
        "normalizedName" ASC,
        "id" ASC
      LIMIT ${query.limit + 1}
    `,
    );

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    const items: DataRoomItem[] = pageRows.map((row) => {
      if (row.type === 'folder') {
        return {
          type: 'folder',
          id: row.id,
          dataRoomId: row.dataRoomId,
          parentId: row.containerId,
          name: row.name,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }

      return {
        type: 'file',
        id: row.id,
        dataRoomId: row.dataRoomId,
        folderId: row.containerId,
        name: row.name,
        sizeBytes: (row.sizeBytes ?? 0n).toString(),
        mimeType: row.mimeType ?? 'application/octet-stream',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    const lastRow = pageRows.at(-1);

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && lastRow
          ? encodeItemCursor({
              kind: lastRow.type,
              normalizedName: lastRow.normalizedName,
              id: lastRow.id,
            })
          : null,
    };
  }

  async create(ownerId: string, dto: CreateDataRoomDto): Promise<DataRoom> {
    const name = normalizeName(dto.name);

    try {
      return await this.prisma.dataRoom.create({
        data: {
          ownerId,
          name: name.name,
          normalizedName: name.normalizedName,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.throwNameConflict(ownerId, name.name);
      }

      throw error;
    }
  }

  async get(userId: string, dataRoomId: string): Promise<DataRoom> {
    await this.accessPolicy.assertCanRead(userId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: {
        id: dataRoomId,
      },
    });

    if (!dataRoom) {
      throw new NotFoundException('Resource is not available.');
    }

    return dataRoom;
  }

  async rename(
    ownerId: string,
    dataRoomId: string,
    dto: UpdateDataRoomDto,
  ): Promise<DataRoom> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const name = normalizeName(dto.name);

    try {
      return await this.prisma.dataRoom.update({
        where: {
          id: dataRoomId,
        },
        data: {
          name: name.name,
          normalizedName: name.normalizedName,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.throwNameConflict(ownerId, name.name);
      }

      if (this.isMissingRecord(error)) {
        throw new NotFoundException('Resource is not available.');
      }

      throw error;
    }
  }

  private async throwNameConflict(
    ownerId: string,
    requestedName: string,
  ): Promise<never> {
    const suggestedName = await this.findAvailableName(ownerId, requestedName);

    throw new ConflictException({
      error: {
        code: 'NAME_CONFLICT',
        message: 'A Data Room with this name already exists.',
        details: {
          suggestedName,
        },
      },
    });
  }

  private async findAvailableName(
    ownerId: string,
    requestedName: string,
  ): Promise<string> {
    for (let index = 1; index <= 100; index += 1) {
      const candidate = addNumericSuffix(requestedName, index);
      const normalizedCandidate = normalizeName(candidate);

      const exists = await this.prisma.dataRoom.findFirst({
        where: {
          ownerId,
          normalizedName: normalizedCandidate.normalizedName,
        },
        select: {
          id: true,
        },
      });

      if (!exists) {
        return normalizedCandidate.name;
      }
    }

    throw new ConflictException({
      error: {
        code: 'NAME_CONFLICT',
        message: 'Unable to generate an available Data Room name.',
      },
    });
  }

  private isUniqueConflict(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isMissingRecord(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  async getDeleteSummary(
    ownerId: string,
    dataRoomId: string,
  ): Promise<DeletionSummary> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const rows = await this.prisma.$queryRaw<DataRoomDeletionSummaryRow[]>(
      Prisma.sql`
        SELECT
          (
            SELECT COUNT(*)::INTEGER
            FROM "folders"
            WHERE "data_room_id" = CAST(${dataRoomId} AS UUID)
          ) AS "folderCount",
          COUNT(files."id")::INTEGER AS "fileCount",
          COALESCE(SUM(files."size_bytes"), 0)::BIGINT
            AS "totalBytes"
        FROM "files"
        WHERE files."data_room_id" = CAST(${dataRoomId} AS UUID)
      `,
    );

    const summary = rows[0];

    if (!summary) {
      throw new NotFoundException('Resource is not available.');
    }

    return {
      folderCount: summary.folderCount,
      fileCount: summary.fileCount,
      totalBytes: summary.totalBytes.toString(),
    };
  }
}
