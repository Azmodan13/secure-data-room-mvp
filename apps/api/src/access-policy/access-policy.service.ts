import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ResourceTarget } from './resource-target.type';

type ResourceContext = {
  dataRoomId: string;
  ownerId: string;
  folderAncestorIds: string[];
  fileId: string | null;
};

type FolderAncestorRow = {
  id: string;
};

@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanRead(userId: string, target: ResourceTarget): Promise<void> {
    const context = await this.resolveResourceContext(target);

    if (context.ownerId === userId) {
      return;
    }

    const coveredTargets: Prisma.ShareGrantWhereInput[] = [
      {
        dataRoomId: context.dataRoomId,
      },
    ];

    if (context.folderAncestorIds.length > 0) {
      coveredTargets.push({
        folderId: {
          in: context.folderAncestorIds,
        },
      });
    }

    if (context.fileId) {
      coveredTargets.push({
        fileId: context.fileId,
      });
    }

    const grant = await this.prisma.shareGrant.findFirst({
      where: {
        recipientUserId: userId,
        revokedAt: null,
        OR: coveredTargets,
      },
      select: {
        id: true,
      },
    });

    if (!grant) {
      this.throwUnavailable();
    }
  }

  async assertCanMutate(userId: string, target: ResourceTarget): Promise<void> {
    const context = await this.resolveResourceContext(target);

    if (context.ownerId !== userId) {
      this.throwUnavailable();
    }
  }

  async assertCanReadPublic(
    tokenHash: string,
    target: ResourceTarget,
  ): Promise<void> {
    const context = await this.resolveResourceContext(target);

    const coveredTargets: Prisma.PublicLinkWhereInput[] = [
      {
        dataRoomId: context.dataRoomId,
      },
    ];

    if (context.folderAncestorIds.length > 0) {
      coveredTargets.push({
        folderId: {
          in: context.folderAncestorIds,
        },
      });
    }

    if (context.fileId) {
      coveredTargets.push({
        fileId: context.fileId,
      });
    }

    const publicLink = await this.prisma.publicLink.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        AND: [
          {
            OR: [
              { expiresAt: null },
              {
                expiresAt: {
                  gt: new Date(),
                },
              },
            ],
          },
          {
            OR: coveredTargets,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!publicLink) {
      this.throwUnavailable();
    }
  }

  async requireRegisteredRecipient(normalizedEmail: string): Promise<User> {
    const email = normalizedEmail.trim().toLowerCase();

    const recipient = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!recipient) {
      throw new UnprocessableEntityException(
        'The recipient must have an existing account.',
      );
    }

    return recipient;
  }

  private async resolveResourceContext(
    target: ResourceTarget,
  ): Promise<ResourceContext> {
    switch (target.type) {
      case 'dataRoom': {
        const dataRoom = await this.prisma.dataRoom.findUnique({
          where: { id: target.id },
          select: {
            id: true,
            ownerId: true,
          },
        });

        if (!dataRoom) {
          this.throwUnavailable();
        }

        return {
          dataRoomId: dataRoom.id,
          ownerId: dataRoom.ownerId,
          folderAncestorIds: [],
          fileId: null,
        };
      }

      case 'folder': {
        const folder = await this.prisma.folder.findUnique({
          where: { id: target.id },
          select: {
            id: true,
            dataRoomId: true,
            dataRoom: {
              select: {
                ownerId: true,
              },
            },
          },
        });

        if (!folder) {
          this.throwUnavailable();
        }

        return {
          dataRoomId: folder.dataRoomId,
          ownerId: folder.dataRoom.ownerId,
          folderAncestorIds: await this.getFolderAncestorIds(folder.id),
          fileId: null,
        };
      }

      case 'file': {
        const file = await this.prisma.fileRecord.findUnique({
          where: { id: target.id },
          select: {
            id: true,
            dataRoomId: true,
            folderId: true,
            dataRoom: {
              select: {
                ownerId: true,
              },
            },
          },
        });

        if (!file) {
          this.throwUnavailable();
        }

        return {
          dataRoomId: file.dataRoomId,
          ownerId: file.dataRoom.ownerId,
          folderAncestorIds: file.folderId
            ? await this.getFolderAncestorIds(file.folderId)
            : [],
          fileId: file.id,
        };
      }
    }
  }

  private async getFolderAncestorIds(folderId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<FolderAncestorRow[]>(
      Prisma.sql`
        WITH RECURSIVE folder_ancestors AS (
          SELECT
            "id",
            "parent_id",
            "data_room_id"
          FROM "folders"
          WHERE "id" = CAST(${folderId} AS UUID)

          UNION

          SELECT
            parent."id",
            parent."parent_id",
            parent."data_room_id"
          FROM "folders" AS parent
          INNER JOIN folder_ancestors AS child
            ON parent."id" = child."parent_id"
            AND parent."data_room_id" = child."data_room_id"
        )
        SELECT "id"
        FROM folder_ancestors
      `,
    );

    return rows.map((row) => row.id);
  }

  private throwUnavailable(): never {
    throw new NotFoundException('Resource is not available.');
  }
}
