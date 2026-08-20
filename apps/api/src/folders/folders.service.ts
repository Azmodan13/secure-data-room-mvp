import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Folder } from '@prisma/client';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import {
  addNumericSuffix,
  normalizeName,
} from '../common/names/normalize-name';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';
import type { ListFoldersQueryDto } from './dto/list-folders-query.dto';
import type { DeletionSummary } from '../common/deletion/deletion-summary.type';
import { StorageService } from '../storage/storage.service';

type StorageKeyRow = {
  storageKey: string;
};

type DeletionSummaryRow = {
  folderCount: number;
  fileCount: number;
  totalBytes: bigint;
};

export type FolderBreadcrumb = {
  id: string;
  name: string;
};

type BreadcrumbRow = {
  id: string;
  name: string;
  depth: number;
};

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AccessPolicyService,
    private readonly storage: StorageService,
  ) {}

  async create(
    ownerId: string,
    dataRoomId: string,
    dto: CreateFolderDto,
  ): Promise<Folder> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const parentId = dto.parentId ?? null;

    if (parentId) {
      await this.assertParentBelongsToDataRoom(parentId, dataRoomId);
    }

    const name = normalizeName(dto.name);

    try {
      return await this.prisma.folder.create({
        data: {
          dataRoomId,
          parentId,
          name: name.name,
          normalizedName: name.normalizedName,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.throwNameConflict(dataRoomId, parentId, name.name);
      }

      if (this.isForeignKeyConflict(error)) {
        throw new NotFoundException('Resource is not available.');
      }

      throw error;
    }
  }

  async listDestinations(
    ownerId: string,
    dataRoomId: string,
    query: ListFoldersQueryDto,
  ): Promise<{
    items: Folder[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });

    const parentId = query.parentId ?? null;

    if (parentId) {
      await this.assertParentBelongsToDataRoom(parentId, dataRoomId);
    }

    const folders = await this.prisma.folder.findMany({
      where: { dataRoomId, parentId },
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = folders.length > query.limit;
    const items = hasMore ? folders.slice(0, query.limit) : folders;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, folderId: string): Promise<Folder> {
    await this.accessPolicy.assertCanRead(userId, {
      type: 'folder',
      id: folderId,
    });

    const folder = await this.prisma.folder.findUnique({
      where: {
        id: folderId,
      },
    });

    if (!folder) {
      throw new NotFoundException('Resource is not available.');
    }

    return folder;
  }

  async rename(
    ownerId: string,
    folderId: string,
    dto: UpdateFolderDto,
  ): Promise<Folder> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'folder',
      id: folderId,
    });

    const existing = await this.prisma.folder.findUnique({
      where: {
        id: folderId,
      },
      select: {
        dataRoomId: true,
        parentId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Resource is not available.');
    }

    const name = normalizeName(dto.name);

    try {
      return await this.prisma.folder.update({
        where: {
          id: folderId,
        },
        data: {
          name: name.name,
          normalizedName: name.normalizedName,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.throwNameConflict(
          existing.dataRoomId,
          existing.parentId,
          name.name,
        );
      }

      if (this.isMissingRecord(error)) {
        throw new NotFoundException('Resource is not available.');
      }

      throw error;
    }
  }

  async getBreadcrumbs(
    ownerId: string,
    folderId: string,
  ): Promise<FolderBreadcrumb[]> {
    // Owner-only in AZM-29. Shared/public breadcrumbs must start at
    // their explicit share root and are implemented in AZM-34.
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'folder',
      id: folderId,
    });

    const rows = await this.prisma.$queryRaw<BreadcrumbRow[]>(
      Prisma.sql`
        WITH RECURSIVE folder_ancestors AS (
          SELECT
            "id",
            "name",
            "parent_id",
            "data_room_id",
            0 AS "depth"
          FROM "folders"
          WHERE "id" = CAST(${folderId} AS UUID)

          UNION

          SELECT
            parent."id",
            parent."name",
            parent."parent_id",
            parent."data_room_id",
            child."depth" + 1
          FROM "folders" AS parent
          INNER JOIN folder_ancestors AS child
            ON parent."id" = child."parent_id"
            AND parent."data_room_id" = child."data_room_id"
        )
        SELECT
          "id",
          "name",
          "depth"
        FROM folder_ancestors
        ORDER BY "depth" DESC
      `,
    );

    if (rows.length === 0) {
      throw new NotFoundException('Resource is not available.');
    }

    return rows.map(({ id, name }) => ({
      id,
      name,
    }));
  }

  async getDeleteSummary(
    ownerId: string,
    folderId: string,
  ): Promise<DeletionSummary> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'folder',
      id: folderId,
    });

    const rows = await this.prisma.$queryRaw<DeletionSummaryRow[]>(
      Prisma.sql`
      WITH RECURSIVE folder_subtree AS (
        SELECT
          "id",
          "data_room_id"
        FROM "folders"
        WHERE "id" = CAST(${folderId} AS UUID)

        UNION

        SELECT
          child."id",
          child."data_room_id"
        FROM "folders" AS child
        INNER JOIN folder_subtree AS parent
          ON child."parent_id" = parent."id"
          AND child."data_room_id" = parent."data_room_id"
      )
      SELECT
        (
          SELECT COUNT(*)::INTEGER
          FROM folder_subtree
        ) AS "folderCount",
        COUNT(files."id")::INTEGER AS "fileCount",
        COALESCE(SUM(files."size_bytes"), 0)::BIGINT
          AS "totalBytes"
      FROM "files"
      WHERE files."folder_id" IN (
        SELECT "id"
        FROM folder_subtree
      )
    `,
    );

    const summary = rows[0];

    if (!summary || summary.folderCount === 0) {
      throw new NotFoundException('Resource is not available.');
    }

    return {
      folderCount: summary.folderCount,
      fileCount: summary.fileCount,
      totalBytes: summary.totalBytes.toString(),
    };
  }

  async delete(ownerId: string, folderId: string): Promise<void> {
    await this.accessPolicy.assertCanMutate(ownerId, {
      type: 'folder',
      id: folderId,
    });

    const files = await this.prisma.$queryRaw<StorageKeyRow[]>(
      Prisma.sql`
      WITH RECURSIVE folder_subtree AS (
        SELECT
          "id",
          "data_room_id"
        FROM "folders"
        WHERE "id" = CAST(${folderId} AS UUID)

        UNION

        SELECT
          child."id",
          child."data_room_id"
        FROM "folders" AS child
        INNER JOIN folder_subtree AS parent
          ON child."parent_id" = parent."id"
          AND child."data_room_id" = parent."data_room_id"
      )
      SELECT
        files."storage_key" AS "storageKey"
      FROM "files"
      INNER JOIN folder_subtree
        ON files."folder_id" = folder_subtree."id"
        AND files."data_room_id" =
          folder_subtree."data_room_id"
    `,
    );

    await this.storage.removeObjects(files.map((file) => file.storageKey));

    await this.prisma.$transaction(async (transaction) => {
      await transaction.folder.deleteMany({
        where: {
          id: folderId,
        },
      });
    });
  }

  private async assertParentBelongsToDataRoom(
    parentId: string,
    dataRoomId: string,
  ): Promise<void> {
    const parent = await this.prisma.folder.findFirst({
      where: {
        id: parentId,
        dataRoomId,
      },
      select: {
        id: true,
      },
    });

    if (!parent) {
      throw new NotFoundException('Resource is not available.');
    }
  }

  private async throwNameConflict(
    dataRoomId: string,
    parentId: string | null,
    requestedName: string,
  ): Promise<never> {
    const suggestedName = await this.findAvailableName(
      dataRoomId,
      parentId,
      requestedName,
    );

    throw new ConflictException({
      error: {
        code: 'NAME_CONFLICT',
        message: 'A folder with this name already exists.',
        details: {
          suggestedName,
        },
      },
    });
  }

  private async findAvailableName(
    dataRoomId: string,
    parentId: string | null,
    requestedName: string,
  ): Promise<string> {
    for (let index = 1; index <= 100; index += 1) {
      const candidate = addNumericSuffix(requestedName, index);
      const normalizedCandidate = normalizeName(candidate);

      const exists = await this.prisma.folder.findFirst({
        where: {
          dataRoomId,
          parentId,
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
        message: 'Unable to generate an available folder name.',
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

  private isForeignKeyConflict(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }
}
