import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from './sharing.service';

type AsyncMock = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

describe('SharingService', () => {
  let service: SharingService;
  let assertCanMutate: AsyncMock;
  let assertCanReadPublic: AsyncMock;
  let publicUpdateMany: AsyncMock;
  let publicCreate: AsyncMock;
  let publicFindFirst: AsyncMock;
  let publicFindMany: AsyncMock;
  let publicFindUnique: AsyncMock;
  let publicRevokeMany: AsyncMock;
  let requireRegisteredRecipient: AsyncMock;
  let grantFindFirst: AsyncMock;
  let grantFindMany: AsyncMock;
  let grantFindUnique: AsyncMock;
  let grantUpdateMany: AsyncMock;
  let grantCreate: AsyncMock;
  let folderFindUnique: AsyncMock;
  let folderFindMany: AsyncMock;
  let fileFindMany: AsyncMock;

  beforeEach(() => {
    assertCanMutate = jest.fn();
    assertCanReadPublic = jest.fn();
    publicUpdateMany = jest.fn();
    publicCreate = jest.fn().mockResolvedValue({
      id: 'link-1',
      createdAt: new Date('2026-08-21T10:00:00Z'),
    });
    publicFindFirst = jest.fn();
    publicFindMany = jest.fn();
    publicFindUnique = jest.fn();
    publicRevokeMany = jest.fn();
    requireRegisteredRecipient = jest.fn();
    grantFindFirst = jest.fn();
    grantFindMany = jest.fn();
    grantFindUnique = jest.fn();
    grantUpdateMany = jest.fn();
    grantCreate = jest.fn();
    folderFindUnique = jest.fn();
    folderFindMany = jest.fn();
    fileFindMany = jest.fn();

    const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      Promise.resolve(
        callback({
          publicLink: { updateMany: publicUpdateMany, create: publicCreate },
        }),
      ),
    );
    const prisma = {
      publicLink: {
        findFirst: publicFindFirst,
        findMany: publicFindMany,
        findUnique: publicFindUnique,
        updateMany: publicRevokeMany,
      },
      shareGrant: {
        findFirst: grantFindFirst,
        findMany: grantFindMany,
        findUnique: grantFindUnique,
        updateMany: grantUpdateMany,
        create: grantCreate,
      },
      folder: { findUnique: folderFindUnique, findMany: folderFindMany },
      fileRecord: { findMany: fileFindMany },
      $transaction: transaction,
    } as unknown as PrismaService;
    const accessPolicy = {
      assertCanMutate,
      assertCanReadPublic,
      requireRegisteredRecipient,
    } as unknown as AccessPolicyService;
    service = new SharingService(prisma, accessPolicy);
  });

  it('stores only a hash and revokes the prior public link', async () => {
    const result = await service.createPublicLink('owner-1', {
      targetType: 'folder',
      targetId: '10000000-0000-4000-8000-000000000001',
    });

    expect(result.token).toHaveLength(43);
    expect(publicUpdateMany).toHaveBeenCalledWith({
      where: {
        dataRoomId: null,
        folderId: '10000000-0000-4000-8000-000000000001',
        fileId: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) as Date },
    });
    const createArgument = publicCreate.mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };
    expect(createArgument.data.tokenHash).toHaveLength(64);
    expect(createArgument.data.tokenHash).not.toBe(result.token);
  });

  it('creates a grant for a registered normalized email', async () => {
    requireRegisteredRecipient.mockResolvedValue({ id: 'recipient-1' });
    grantFindFirst.mockResolvedValue(null);
    grantCreate.mockResolvedValue({ id: 'grant-1' });

    await service.createGrant('owner-1', {
      targetType: 'file',
      targetId: '10000000-0000-4000-8000-000000000002',
      email: '  Guest@Example.COM ',
    });

    expect(grantCreate).toHaveBeenCalledWith({
      data: {
        dataRoomId: null,
        folderId: null,
        fileId: '10000000-0000-4000-8000-000000000002',
        recipientEmail: 'guest@example.com',
        recipientUserId: 'recipient-1',
      },
    });
  });

  it('rejects a grant for an unregistered email', async () => {
    requireRegisteredRecipient.mockRejectedValue(
      new UnprocessableEntityException(
        'The recipient must have an existing account.',
      ),
    );

    await expect(
      service.createGrant('owner-1', {
        targetType: 'file',
        targetId: '10000000-0000-4000-8000-000000000002',
        email: 'guest@example.com',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(grantCreate).not.toHaveBeenCalled();
  });

  it('rejects an invalid, expired, or revoked public token', async () => {
    publicFindFirst.mockResolvedValue(null);

    await expect(service.getPublicRoot('invalid-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('authorizes public folder metadata through the token ancestry policy', async () => {
    publicFindFirst.mockResolvedValue({
      id: 'link-1',
      dataRoomId: 'room-1',
      folderId: null,
      fileId: null,
      dataRoom: { id: 'room-1', name: 'Room' },
      folder: null,
      file: null,
    });
    folderFindUnique.mockResolvedValue({
      id: 'folder-1',
      dataRoomId: 'room-1',
      parentId: null,
      name: 'Folder',
    });

    const result = await service.getPublicFolder('plain-token', 'folder-1');

    expect(assertCanReadPublic).toHaveBeenCalledWith(
      service.hashToken('plain-token'),
      { type: 'folder', id: 'folder-1' },
    );
    expect(result).toEqual({
      id: 'folder-1',
      dataRoomId: 'room-1',
      parentId: null,
      name: 'Folder',
    });
  });

  it('requires owner mutation access before listing target shares', async () => {
    publicFindMany.mockResolvedValue([]);
    grantFindMany.mockResolvedValue([]);

    await service.listTargetShares('owner-1', {
      targetType: 'dataRoom',
      targetId: '10000000-0000-4000-8000-000000000003',
    });

    expect(assertCanMutate).toHaveBeenCalledWith('owner-1', {
      type: 'dataRoom',
      id: '10000000-0000-4000-8000-000000000003',
    });
  });

  it('authorizes the link target before revoking public access', async () => {
    publicFindUnique.mockResolvedValue({
      id: 'link-1',
      dataRoomId: null,
      folderId: 'folder-1',
      fileId: null,
    });
    publicRevokeMany.mockResolvedValue({ count: 1 });

    await service.revokePublicLink('owner-1', 'link-1');

    expect(assertCanMutate).toHaveBeenCalledWith('owner-1', {
      type: 'folder',
      id: 'folder-1',
    });
    expect(publicRevokeMany).toHaveBeenCalledWith({
      where: { id: 'link-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });

  it('authorizes the grant target before revoking permissioned access', async () => {
    grantFindUnique.mockResolvedValue({
      id: 'grant-1',
      dataRoomId: null,
      folderId: null,
      fileId: 'file-1',
    });
    grantUpdateMany.mockResolvedValue({ count: 1 });

    await service.revokeGrant('owner-1', 'grant-1');

    expect(assertCanMutate).toHaveBeenCalledWith('owner-1', {
      type: 'file',
      id: 'file-1',
    });
    expect(grantUpdateMany).toHaveBeenCalledWith({
      where: { id: 'grant-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });

  it('scopes public listing to the authorized folder container', async () => {
    publicFindFirst.mockResolvedValue({
      id: 'link-1',
      dataRoomId: 'room-1',
      folderId: null,
      fileId: null,
      dataRoom: { id: 'room-1', name: 'Room' },
      folder: null,
      file: null,
    });
    folderFindMany.mockResolvedValue([]);
    fileFindMany.mockResolvedValue([]);

    await service.listPublicItems('plain-token', 'folder-1');

    expect(assertCanReadPublic).toHaveBeenCalledWith(
      service.hashToken('plain-token'),
      { type: 'folder', id: 'folder-1' },
    );
    expect(folderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dataRoomId: 'room-1', parentId: 'folder-1' },
      }),
    );
    expect(fileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dataRoomId: 'room-1',
          folderId: 'folder-1',
        }) as object,
      }),
    );
  });

  it('does not list contents for a direct public file link', async () => {
    publicFindFirst.mockResolvedValue({
      id: 'link-1',
      dataRoomId: null,
      folderId: null,
      fileId: 'file-1',
      dataRoom: null,
      folder: null,
      file: { id: 'file-1' },
    });

    await expect(service.listPublicItems('plain-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(assertCanReadPublic).not.toHaveBeenCalled();
    expect(folderFindMany).not.toHaveBeenCalled();
    expect(fileFindMany).not.toHaveBeenCalled();
  });
});
