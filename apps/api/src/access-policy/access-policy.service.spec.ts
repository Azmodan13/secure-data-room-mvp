import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from './access-policy.service';

type AsyncMock = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

describe('AccessPolicyService', () => {
  let service: AccessPolicyService;

  let dataRoomFindUnique: AsyncMock;
  let folderFindUnique: AsyncMock;
  let fileFindUnique: AsyncMock;
  let shareGrantFindFirst: AsyncMock;
  let publicLinkFindFirst: AsyncMock;
  let userFindUnique: AsyncMock;
  let queryRaw: AsyncMock;

  beforeEach(() => {
    dataRoomFindUnique = jest.fn();
    folderFindUnique = jest.fn();
    fileFindUnique = jest.fn();
    shareGrantFindFirst = jest.fn();
    publicLinkFindFirst = jest.fn();
    userFindUnique = jest.fn();
    queryRaw = jest.fn();

    const prisma = {
      dataRoom: {
        findUnique: dataRoomFindUnique,
      },
      folder: {
        findUnique: folderFindUnique,
      },
      fileRecord: {
        findUnique: fileFindUnique,
      },
      shareGrant: {
        findFirst: shareGrantFindFirst,
      },
      publicLink: {
        findFirst: publicLinkFindFirst,
      },
      user: {
        findUnique: userFindUnique,
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;

    service = new AccessPolicyService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows the owner to read without querying grants', async () => {
    dataRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });

    await expect(
      service.assertCanRead('owner-1', {
        type: 'dataRoom',
        id: 'room-1',
      }),
    ).resolves.toBeUndefined();

    expect(shareGrantFindFirst).not.toHaveBeenCalled();
  });

  it('allows only the owner to mutate', async () => {
    dataRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });

    await expect(
      service.assertCanMutate('owner-1', {
        type: 'dataRoom',
        id: 'room-1',
      }),
    ).resolves.toBeUndefined();

    await expect(
      service.assertCanMutate('viewer-1', {
        type: 'dataRoom',
        id: 'room-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies an unrelated authenticated user', async () => {
    dataRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });

    shareGrantFindFirst.mockResolvedValue(null);

    await expect(
      service.assertCanRead('unrelated-1', {
        type: 'dataRoom',
        id: 'room-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(shareGrantFindFirst).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'unrelated-1',
        revokedAt: null,
        OR: [{ dataRoomId: 'room-1' }],
      },
      select: {
        id: true,
      },
    });
  });

  it('allows a direct file grant and includes inherited targets', async () => {
    fileFindUnique.mockResolvedValue({
      id: 'file-1',
      dataRoomId: 'room-1',
      folderId: 'child-folder',
      dataRoom: {
        ownerId: 'owner-1',
      },
    });

    queryRaw.mockResolvedValue([
      { id: 'child-folder' },
      { id: 'parent-folder' },
    ]);

    shareGrantFindFirst.mockResolvedValue({
      id: 'grant-1',
    });

    await expect(
      service.assertCanRead('viewer-1', {
        type: 'file',
        id: 'file-1',
      }),
    ).resolves.toBeUndefined();

    expect(shareGrantFindFirst).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'viewer-1',
        revokedAt: null,
        OR: [
          { dataRoomId: 'room-1' },
          {
            folderId: {
              in: ['child-folder', 'parent-folder'],
            },
          },
          { fileId: 'file-1' },
        ],
      },
      select: {
        id: true,
      },
    });
  });

  it('allows access inherited from a parent folder grant', async () => {
    folderFindUnique.mockResolvedValue({
      id: 'child-folder',
      dataRoomId: 'room-1',
      dataRoom: {
        ownerId: 'owner-1',
      },
    });

    queryRaw.mockResolvedValue([
      { id: 'child-folder' },
      { id: 'parent-folder' },
    ]);

    shareGrantFindFirst.mockResolvedValue({
      id: 'grant-1',
    });

    await expect(
      service.assertCanRead('viewer-1', {
        type: 'folder',
        id: 'child-folder',
      }),
    ).resolves.toBeUndefined();

    expect(shareGrantFindFirst).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'viewer-1',
        revokedAt: null,
        OR: [
          { dataRoomId: 'room-1' },
          {
            folderId: {
              in: ['child-folder', 'parent-folder'],
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });
  });

  it('allows an active public link that covers the resource', async () => {
    const now = new Date('2026-08-18T12:00:00.000Z');

    jest.useFakeTimers();
    jest.setSystemTime(now);

    fileFindUnique.mockResolvedValue({
      id: 'file-1',
      dataRoomId: 'room-1',
      folderId: null,
      dataRoom: {
        ownerId: 'owner-1',
      },
    });

    publicLinkFindFirst.mockResolvedValue({
      id: 'public-link-1',
    });

    await expect(
      service.assertCanReadPublic('token-hash', {
        type: 'file',
        id: 'file-1',
      }),
    ).resolves.toBeUndefined();

    expect(publicLinkFindFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: 'token-hash',
        revokedAt: null,
        AND: [
          {
            OR: [
              { expiresAt: null },
              {
                expiresAt: {
                  gt: now,
                },
              },
            ],
          },
          {
            OR: [{ dataRoomId: 'room-1' }, { fileId: 'file-1' }],
          },
        ],
      },
      select: {
        id: true,
      },
    });
  });

  it('denies access when no active grant exists', async () => {
    dataRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });

    // Revoked grants are excluded by revokedAt: null,
    // so Prisma returns no active matching record.
    shareGrantFindFirst.mockResolvedValue(null);

    await expect(
      service.assertCanRead('viewer-1', {
        type: 'dataRoom',
        id: 'room-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies an unavailable public link', async () => {
    dataRoomFindUnique.mockResolvedValue({
      id: 'room-1',
      ownerId: 'owner-1',
    });

    // Revoked, expired and unknown links all produce no active match.
    publicLinkFindFirst.mockResolvedValue(null);

    await expect(
      service.assertCanReadPublic('unavailable-token-hash', {
        type: 'dataRoom',
        id: 'room-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an existing recipient by normalized email', async () => {
    const recipient: User = {
      id: 'recipient-1',
      authUserId: 'auth-recipient-1',
      email: 'recipient@example.com',
      displayName: 'Recipient',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userFindUnique.mockResolvedValue(recipient);

    await expect(
      service.requireRegisteredRecipient(' Recipient@Example.com '),
    ).resolves.toEqual(recipient);

    expect(userFindUnique).toHaveBeenCalledWith({
      where: {
        email: 'recipient@example.com',
      },
    });
  });

  it('rejects sharing with an unregistered recipient', async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(
      service.requireRegisteredRecipient('missing@example.com'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('conceals a missing resource', async () => {
    dataRoomFindUnique.mockResolvedValue(null);

    await expect(
      service.assertCanRead('viewer-1', {
        type: 'dataRoom',
        id: 'missing-room',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(shareGrantFindFirst).not.toHaveBeenCalled();
  });
});
