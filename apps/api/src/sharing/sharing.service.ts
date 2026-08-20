import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UploadStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import type { ResourceTarget } from '../access-policy/resource-target.type';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateShareGrantDto } from './dto/create-share-grant.dto';
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

    const where = {
      ...this.exactTargetWhere(target),
      recipientEmail: email,
      revokedAt: null,
    };
    const existing = await this.prisma.shareGrant.findFirst({ where });
    if (existing) return existing;

    try {
      return await this.prisma.shareGrant.create({
        data: {
          ...this.targetForeignKeys(target),
          recipientEmail: email,
          recipientUserId: recipient.id,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const raced = await this.prisma.shareGrant.findFirst({ where });
        if (raced) return raced;
      }
      throw error;
    }
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
