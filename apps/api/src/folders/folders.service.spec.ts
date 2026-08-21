import { NotFoundException } from '@nestjs/common';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FoldersService } from './folders.service';

type AsyncMock = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

type FolderTransaction = {
  folder: {
    deleteMany: AsyncMock;
  };
};

type TransactionMock = jest.MockedFunction<
  (
    callback: (transaction: FolderTransaction) => Promise<unknown>,
  ) => Promise<unknown>
>;

const folderId = '20000000-0000-4000-8000-000000000001';

describe('FoldersService deletion', () => {
  let service: FoldersService;
  let assertCanMutate: AsyncMock;
  let queryRaw: AsyncMock;
  let deleteMany: AsyncMock;
  let runTransaction: TransactionMock;
  let removeObjects: AsyncMock;

  beforeEach(() => {
    assertCanMutate = jest.fn();
    queryRaw = jest.fn();
    deleteMany = jest.fn();
    removeObjects = jest.fn();
    runTransaction = jest.fn(async (callback) =>
      callback({
        folder: {
          deleteMany,
        },
      }),
    );

    const prisma = {
      $queryRaw: queryRaw,
      $transaction: runTransaction,
    } as unknown as PrismaService;

    const accessPolicy = {
      assertCanMutate,
    } as unknown as AccessPolicyService;

    const storage = {
      removeObjects,
    } as unknown as StorageService;

    service = new FoldersService(prisma, accessPolicy, storage);
  });

  it('removes every file in the folder subtree before deleting metadata', async () => {
    const storageKeys = [
      'rooms/room-1/root-file.pdf',
      'rooms/room-1/nested-file.pdf',
    ];

    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue(
      storageKeys.map((storageKey) => ({ storageKey })),
    );
    removeObjects.mockResolvedValue(undefined);
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.delete('owner-1', folderId)).resolves.toBeUndefined();

    expect(assertCanMutate).toHaveBeenCalledWith('owner-1', {
      type: 'folder',
      id: folderId,
    });
    expect(removeObjects).toHaveBeenCalledWith(storageKeys);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: folderId,
      },
    });

    const storageOrder = removeObjects.mock.invocationCallOrder[0];
    const databaseOrder = deleteMany.mock.invocationCallOrder[0];

    expect(storageOrder).toBeLessThan(databaseOrder);
  });

  it('preserves the folder subtree when Storage deletion fails', async () => {
    const storageFailure = new Error('Storage unavailable');

    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue([
      { storageKey: 'rooms/room-1/nested-file.pdf' },
    ]);
    removeObjects.mockRejectedValue(storageFailure);

    await expect(service.delete('owner-1', folderId)).rejects.toBe(
      storageFailure,
    );

    expect(runTransaction).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('deletes an empty folder without attempting a blob deletion request', async () => {
    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue([]);
    removeObjects.mockResolvedValue(undefined);
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.delete('owner-1', folderId)).resolves.toBeUndefined();

    expect(removeObjects).toHaveBeenCalledWith([]);
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it('returns a recursive deletion summary with a JSON-safe size', async () => {
    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue([
      {
        folderCount: 3,
        fileCount: 7,
        totalBytes: 987654321098765432n,
      },
    ]);

    await expect(
      service.getDeleteSummary('owner-1', folderId),
    ).resolves.toEqual({
      folderCount: 3,
      fileCount: 7,
      totalBytes: '987654321098765432',
    });
  });

  it('returns neutral not found for an unavailable folder summary', async () => {
    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue([
      {
        folderCount: 0,
        fileCount: 0,
        totalBytes: 0n,
      },
    ]);

    await expect(
      service.getDeleteSummary('owner-1', folderId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('FoldersService breadcrumbs', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const ownerId = '10000000-0000-4000-8000-000000000002';
  const dataRoomId = '30000000-0000-4000-8000-000000000001';
  const shareRootId = '20000000-0000-4000-8000-000000000002';
  const childId = '20000000-0000-4000-8000-000000000003';
  const rows = [
    { id: folderId, name: 'Private parent', depth: 2 },
    { id: shareRootId, name: 'Shared root', depth: 1 },
    { id: childId, name: 'Child', depth: 0 },
  ];

  const createService = (resolvedOwnerId: string) => {
    const assertCanRead: AsyncMock = jest.fn().mockResolvedValue(undefined);
    const findUnique: AsyncMock = jest.fn().mockResolvedValue({
      dataRoomId,
      dataRoom: { ownerId: resolvedOwnerId },
    });
    const findMany: AsyncMock = jest.fn().mockResolvedValue([]);
    const queryRaw: AsyncMock = jest.fn().mockResolvedValue(rows);

    const prisma = {
      folder: { findUnique },
      shareGrant: { findMany },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    const accessPolicy = {
      assertCanRead,
    } as unknown as AccessPolicyService;

    return {
      service: new FoldersService(prisma, accessPolicy, {} as StorageService),
      assertCanRead,
      findMany,
    };
  };

  it('returns the complete path to the owner', async () => {
    const { service, findMany } = createService(userId);

    await expect(service.getBreadcrumbs(userId, childId)).resolves.toEqual(
      rows.map(({ id, name }) => ({ id, name })),
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns the complete path to a Data Room recipient', async () => {
    const { service, findMany } = createService(ownerId);
    findMany.mockResolvedValue([{ dataRoomId, folderId: null }]);

    await expect(service.getBreadcrumbs(userId, childId)).resolves.toEqual(
      rows.map(({ id, name }) => ({ id, name })),
    );
  });

  it('hides ancestors above a directly shared folder', async () => {
    const { service, assertCanRead, findMany } = createService(ownerId);
    findMany.mockResolvedValue([{ dataRoomId: null, folderId: shareRootId }]);

    await expect(service.getBreadcrumbs(userId, childId)).resolves.toEqual([
      { id: shareRootId, name: 'Shared root' },
      { id: childId, name: 'Child' },
    ]);
    expect(assertCanRead).toHaveBeenCalledWith(userId, {
      type: 'folder',
      id: childId,
    });
  });
});
