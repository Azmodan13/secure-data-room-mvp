import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UploadStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import type { ResourceTarget } from '../access-policy/resource-target.type';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateShareGrantDto } from './dto/create-share-grant.dto';
import type { ListOwnedAccessQueryDto } from './dto/list-owned-access-query.dto';
import type { ResourceTargetDto } from './dto/resource-target.dto';

const PAGE_SIZE = 50;

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  async createPublicLink(ownerId: string, dto: ResourceTargetDto) {
    const target = this.toTarget(dto);
    await this.accessPolicy.assertCanMutate(ownerId, target);

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const exactTarget = this.exactTargetWhere(target);

    const link = await this.prisma.$transaction(async (tx) => {
      await tx.publicLink.updateMany({
        where: { ...exactTarget, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return tx.publicLink.create({
        data: { ...this.targetForeignKeys(target), tokenHash },
      });
    });

    return {
      id: link.id,
      targetType: target.type,
      targetId: target.id,
      token,
      createdAt: link.createdAt,
    };
  }

  async listTargetShares(ownerId: string, dto: ResourceTargetDto) {
    const target = this.toTarget(dto);
    await this.accessPolicy.assertCanMutate(ownerId, target);
    const exactTarget = this.exactTargetWhere(target);

    const [publicLinks, grants] = await Promise.all([
      this.prisma.publicLink.findMany({
        where: { ...exactTarget, revokedAt: null },
        select: { id: true, expiresAt: true, createdAt: true },
      }),
      this.prisma.shareGrant.findMany({
        where: { ...exactTarget, revokedAt: null },
        select: {
          id: true,
          recipientEmail: true,
          recipientUserId: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { publicLinks, grants };
  }

  async listOwnedPublicLinks(ownerId: string, query: ListOwnedAccessQueryDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const links = await this.prisma.publicLink.findMany({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        AND: [
          {
            OR: [
              { dataRoom: { ownerId } },
              { folder: { dataRoom: { ownerId } } },
              { file: { dataRoom: { ownerId } } },
            ],
          },
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
        dataRoom: { select: { id: true, name: true } },
        folder: {
          select: {
            id: true,
            name: true,
            dataRoom: { select: { id: true, name: true } },
          },
        },
        file: {
          select: {
            id: true,
            name: true,
            folderId: true,
            dataRoom: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = links.length > query.limit;
    const page = hasMore ? links.slice(0, query.limit) : links;
    const items = page.map((link) => {
      const target = link.dataRoom ?? link.folder ?? link.file;
      const dataRoom =
        link.dataRoom ?? link.folder?.dataRoom ?? link.file?.dataRoom;
      if (!target || !dataRoom) this.throwUnavailable();

      return {
        id: link.id,
        targetType: link.dataRoom
          ? ('dataRoom' as const)
          : link.folder
            ? ('folder' as const)
            : ('file' as const),
        targetId: target.id,
        targetName: target.name,
        dataRoom,
        folderId: link.file?.folderId ?? null,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      };
    });
    const lastItem = page.at(-1);

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? encodeCursor({ id: lastItem.id, createdAt: lastItem.createdAt })
          : null,
    };
  }

  async listOwnedGrants(ownerId: string, query: ListOwnedAccessQueryDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const grants = await this.prisma.shareGrant.findMany({
      where: {
        revokedAt: null,
        AND: [
          {
            OR: [
              { dataRoom: { ownerId } },
              { folder: { dataRoom: { ownerId } } },
              { file: { dataRoom: { ownerId } } },
            ],
          },
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        recipientEmail: true,
        role: true,
        createdAt: true,
        dataRoom: { select: { id: true, name: true } },
        folder: {
          select: {
            id: true,
            name: true,
            dataRoom: { select: { id: true, name: true } },
          },
        },
        file: {
          select: {
            id: true,
            name: true,
            folderId: true,
            dataRoom: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = grants.length > query.limit;
    const page = hasMore ? grants.slice(0, query.limit) : grants;
    const items = page.map((grant) => {
      const target = grant.dataRoom ?? grant.folder ?? grant.file;
      const dataRoom =
        grant.dataRoom ?? grant.folder?.dataRoom ?? grant.file?.dataRoom;
      if (!target || !dataRoom) this.throwUnavailable();
      return {
        id: grant.id,
        targetType: grant.dataRoom
          ? ('dataRoom' as const)
          : grant.folder
            ? ('folder' as const)
            : ('file' as const),
        targetId: target.id,
        targetName: target.name,
        dataRoom,
        folderId: grant.file?.folderId ?? null,
        recipientEmail: grant.recipientEmail,
        role: grant.role,
        createdAt: grant.createdAt,
      };
    });
    const last = page.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ id: last.id, createdAt: last.createdAt })
          : null,
    };
  }

  async revokePublicLink(ownerId: string, id: string): Promise<void> {
    const link = await this.prisma.publicLink.findUnique({ where: { id } });
    if (!link) this.throwUnavailable();
    await this.accessPolicy.assertCanMutate(
      ownerId,
      this.targetFromRecord(link),
    );
    await this.prisma.publicLink.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createGrant(ownerId: string, dto: CreateShareGrantDto) {
    const target = this.toTarget(dto);
    await this.accessPolicy.assertCanMutate(ownerId, target);
    const email = dto.email.trim().toLowerCase();
    const recipient = await this.accessPolicy.requireRegisteredRecipient(email);

    if (recipient?.id === ownerId) {
      throw new BadRequestException('You already own this resource.');
    }

    const inherited = await this.accessPolicy.findInheritedGrant(
      recipient.id,
      target,
    );
    if (inherited) {
      const source =
        inherited.targetType === 'dataRoom' ? 'Data Room' : 'folder';
      throw new ConflictException({
        error: {
          code: 'ACCESS_ALREADY_INHERITED',
          message: `This user already has access through the ${source} “${inherited.targetName}”.`,
          details: inherited,
        },
      });
    }

    const where = {
      ...this.exactTargetWhere(target),
      recipientEmail: email,
      revokedAt: null,
    };
    const existing = await this.prisma.shareGrant.findFirst({ where });
    if (existing) {
      await this.revokeRedundantDescendantGrants(
        recipient.id,
        target,
        existing.id,
      );
      return existing;
    }

    try {
      const created = await this.prisma.shareGrant.create({
        data: {
          ...this.targetForeignKeys(target),
          recipientEmail: email,
          recipientUserId: recipient.id,
        },
      });
      await this.revokeRedundantDescendantGrants(
        recipient.id,
        target,
        created.id,
      );
      return created;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const raced = await this.prisma.shareGrant.findFirst({ where });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async revokeRedundantDescendantGrants(
    recipientUserId: string,
    target: ResourceTarget,
    keepGrantId: string,
  ): Promise<void> {
    if (target.type === 'file') return;
    if (target.type === 'dataRoom') {
      await this.prisma.shareGrant.updateMany({
        where: {
          recipientUserId,
          revokedAt: null,
          id: { not: keepGrantId },
          OR: [
            { folder: { dataRoomId: target.id } },
            { file: { dataRoomId: target.id } },
          ],
        },
        data: { revokedAt: new Date() },
      });
      return;
    }

    const descendants = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        WITH RECURSIVE folder_subtree AS (
          SELECT "id" FROM "folders" WHERE "id" = CAST(${target.id} AS UUID)
          UNION ALL
          SELECT child."id" FROM "folders" AS child
          INNER JOIN folder_subtree AS parent ON child."parent_id" = parent."id"
        )
        SELECT "id" FROM folder_subtree
      `,
    );
    const folderIds = descendants.map((folder) => folder.id);
    await this.prisma.shareGrant.updateMany({
      where: {
        recipientUserId,
        revokedAt: null,
        id: { not: keepGrantId },
        OR: [
          { folderId: { in: folderIds } },
          { file: { folderId: { in: folderIds } } },
        ],
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeGrant(ownerId: string, id: string): Promise<void> {
    const grant = await this.prisma.shareGrant.findUnique({ where: { id } });
    if (!grant) this.throwUnavailable();
    await this.accessPolicy.assertCanMutate(
      ownerId,
      this.targetFromRecord(grant),
    );
    await this.prisma.shareGrant.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listReceived(userId: string) {
    return this.prisma.shareGrant.findMany({
      where: { recipientUserId: userId, revokedAt: null },
      select: {
        id: true,
        dataRoomId: true,
        folderId: true,
        fileId: true,
        role: true,
        createdAt: true,
        dataRoom: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, dataRoomId: true } },
        file: { select: { id: true, name: true, dataRoomId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublicRoot(token: string) {
    const link = await this.getActivePublicLink(token);
    if (link.dataRoom) {
      return { type: 'dataRoom' as const, ...link.dataRoom };
    }
    if (link.folder) return { type: 'folder' as const, ...link.folder };
    if (link.file)
      return {
        type: 'file' as const,
        ...link.file,
        sizeBytes: link.file.sizeBytes.toString(),
      };
    this.throwUnavailable();
  }

  async listPublicItems(token: string, folderId?: string) {
    const tokenHash = this.hashToken(token);
    const link = await this.getActivePublicLink(token);
    if (link.fileId)
      throw new BadRequestException('A file link has no contents.');

    const dataRoomId = link.dataRoomId ?? link.folder?.dataRoomId;
    const containerId = folderId ?? link.folderId ?? null;
    if (!dataRoomId) this.throwUnavailable();

    const target: ResourceTarget = containerId
      ? { type: 'folder', id: containerId }
      : { type: 'dataRoom', id: dataRoomId };
    await this.accessPolicy.assertCanReadPublic(tokenHash, target);

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { dataRoomId, parentId: containerId },
        select: {
          id: true,
          dataRoomId: true,
          parentId: true,
          name: true,
          createdAt: true,
        },
        orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
        take: PAGE_SIZE + 1,
      }),
      this.prisma.fileRecord.findMany({
        where: {
          dataRoomId,
          folderId: containerId,
          uploadStatus: UploadStatus.READY,
        },
        select: {
          id: true,
          dataRoomId: true,
          folderId: true,
          name: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
        orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
        take: PAGE_SIZE + 1,
      }),
    ]);

    const items = [
      ...folders.map((folder) => ({ type: 'folder' as const, ...folder })),
      ...files.map((file) => ({
        type: 'file' as const,
        ...file,
        sizeBytes: file.sizeBytes.toString(),
      })),
    ]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .slice(0, PAGE_SIZE);

    return { items, hasMore: folders.length + files.length > PAGE_SIZE };
  }

  async getPublicFolder(token: string, folderId: string) {
    const tokenHash = this.hashToken(token);
    await this.getActivePublicLink(token);
    await this.accessPolicy.assertCanReadPublic(tokenHash, {
      type: 'folder',
      id: folderId,
    });
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, dataRoomId: true, parentId: true, name: true },
    });
    if (!folder) this.throwUnavailable();
    return folder;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async getActivePublicLink(token: string) {
    const link = await this.prisma.publicLink.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        dataRoom: { select: { id: true, name: true } },
        folder: {
          select: { id: true, name: true, dataRoomId: true, parentId: true },
        },
        file: {
          select: {
            id: true,
            name: true,
            dataRoomId: true,
            folderId: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });
    if (!link) this.throwUnavailable();
    return link;
  }

  private toTarget(dto: ResourceTargetDto): ResourceTarget {
    return { type: dto.targetType, id: dto.targetId };
  }

  private exactTargetWhere(target: ResourceTarget) {
    return {
      dataRoomId: target.type === 'dataRoom' ? target.id : null,
      folderId: target.type === 'folder' ? target.id : null,
      fileId: target.type === 'file' ? target.id : null,
    };
  }

  private targetForeignKeys(target: ResourceTarget) {
    return this.exactTargetWhere(target);
  }

  private targetFromRecord(record: {
    dataRoomId: string | null;
    folderId: string | null;
    fileId: string | null;
  }): ResourceTarget {
    if (record.dataRoomId) return { type: 'dataRoom', id: record.dataRoomId };
    if (record.folderId) return { type: 'folder', id: record.folderId };
    if (record.fileId) return { type: 'file', id: record.fileId };
    this.throwUnavailable();
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private throwUnavailable(): never {
    throw new NotFoundException('Resource is not available.');
  }
}
