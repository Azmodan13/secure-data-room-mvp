import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type DataRoom } from '@prisma/client';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import { decodeCursor } from '../common/pagination/cursor';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DataRoomsService } from './data-rooms.service';

type AsyncMock = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

type DataRoomTransaction = {
  dataRoom: {
    deleteMany: AsyncMock;
  };
};

type TransactionMock = jest.MockedFunction<
  (
    callback: (transaction: DataRoomTransaction) => Promise<unknown>,
  ) => Promise<unknown>
>;

const firstRoomId = '10000000-0000-4000-8000-000000000001';
const secondRoomId = '10000000-0000-4000-8000-000000000002';
const thirdRoomId = '10000000-0000-4000-8000-000000000003';

function createRoom(id: string, name: string, createdAt: Date): DataRoom {
  return {
    id,
    ownerId: 'owner-1',
    name,
    normalizedName: name.toLowerCase(),
    createdAt,
    updatedAt: createdAt,
  };
}

describe('DataRoomsService', () => {
  let service: DataRoomsService;

  let findMany: AsyncMock;
  let create: AsyncMock;
  let findUnique: AsyncMock;
  let findFirst: AsyncMock;
  let update: AsyncMock;
  let assertCanRead: AsyncMock;
  let assertCanMutate: AsyncMock;
  let fileFindMany: AsyncMock;
  let deleteMany: AsyncMock;
  let runTransaction: TransactionMock;
  let removeObjects: AsyncMock;
  let queryRaw: AsyncMock;

  beforeEach(() => {
    findMany = jest.fn();
    create = jest.fn();
    findUnique = jest.fn();
    findFirst = jest.fn();
    update = jest.fn();
    assertCanRead = jest.fn();
    assertCanMutate = jest.fn();
    fileFindMany = jest.fn();
    deleteMany = jest.fn();
    removeObjects = jest.fn();
    queryRaw = jest.fn();

    runTransaction = jest.fn(async (callback) =>
      callback({
        dataRoom: {
          deleteMany,
        },
      }),
    );

    const prisma = {
      dataRoom: {
        findMany,
        create,
        findUnique,
        findFirst,
        update,
      },
      fileRecord: {
        findMany: fileFindMany,
      },
      $queryRaw: queryRaw,
      $transaction: runTransaction,
    } as unknown as PrismaService;

    const accessPolicy = {
      assertCanRead,
      assertCanMutate,
    } as unknown as AccessPolicyService;

    const storage = {
      removeObjects,
    } as unknown as StorageService;

    service = new DataRoomsService(prisma, accessPolicy, storage);
  });

  it('returns a bounded page and an opaque next cursor', async () => {
    const first = createRoom(
      firstRoomId,
      'First',
      new Date('2026-08-19T12:00:00.000Z'),
    );
    const second = createRoom(
      secondRoomId,
      'Second',
      new Date('2026-08-19T11:00:00.000Z'),
    );
    const third = createRoom(
      thirdRoomId,
      'Third',
      new Date('2026-08-19T10:00:00.000Z'),
    );

    findMany.mockResolvedValue([first, second, third]);

    const result = await service.listOwned('owner-1', {
      limit: 2,
    });

    expect(result.items).toEqual([first, second]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();

    const cursor = decodeCursor(result.nextCursor!);

    expect(cursor).toEqual({
      id: second.id,
      createdAt: second.createdAt,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        ownerId: 'owner-1',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  });

  it('normalizes a Data Room name before creating it', async () => {
    const created = createRoom(firstRoomId, 'Acquisition', new Date());

    create.mockResolvedValue(created);

    await expect(
      service.create('owner-1', {
        name: '  Acquisition  ',
      }),
    ).resolves.toEqual(created);

    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId: 'owner-1',
        name: 'Acquisition',
        normalizedName: 'acquisition',
      },
    });
  });

  it('checks read access before returning a Data Room', async () => {
    const room = createRoom(firstRoomId, 'Room', new Date());

    assertCanRead.mockResolvedValue(undefined);
    findUnique.mockResolvedValue(room);

    await expect(service.get('viewer-1', firstRoomId)).resolves.toEqual(room);

    expect(assertCanRead).toHaveBeenCalledWith('viewer-1', {
      type: 'dataRoom',
      id: firstRoomId,
    });
  });

  it('checks owner mutation access before renaming', async () => {
    const renamed = createRoom(firstRoomId, 'Renamed room', new Date());

    assertCanMutate.mockResolvedValue(undefined);
    update.mockResolvedValue(renamed);

    await expect(
      service.rename('owner-1', firstRoomId, {
        name: ' Renamed room ',
      }),
    ).resolves.toEqual(renamed);

    expect(assertCanMutate).toHaveBeenCalledWith('owner-1', {
      type: 'dataRoom',
      id: firstRoomId,
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: firstRoomId,
      },
      data: {
        name: 'Renamed room',
        normalizedName: 'renamed room',
      },
    });
  });

  it('maps a unique conflict to 409 with an available suggestion', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      },
    );

    create.mockRejectedValue(conflict);
    findFirst
      .mockResolvedValueOnce({ id: firstRoomId })
      .mockResolvedValueOnce(null);

    const promise = service.create('owner-1', {
      name: 'Room',
    });

    await expect(promise).rejects.toBeInstanceOf(ConflictException);

    await expect(promise).rejects.toMatchObject({
      response: {
        error: {
          code: 'NAME_CONFLICT',
          details: {
            suggestedName: 'Room (2)',
          },
        },
      },
    });
  });

  it('removes Storage objects before deleting Data Room metadata', async () => {
    const storageKeys = ['rooms/room-1/file-1.pdf', 'rooms/room-1/file-2.pdf'];

    assertCanMutate.mockResolvedValue(undefined);
    fileFindMany.mockResolvedValue(
      storageKeys.map((storageKey) => ({ storageKey })),
    );
    removeObjects.mockResolvedValue(undefined);
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.delete('owner-1', firstRoomId),
    ).resolves.toBeUndefined();

    expect(removeObjects).toHaveBeenCalledWith(storageKeys);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: firstRoomId,
        ownerId: 'owner-1',
      },
    });

    const storageOrder = removeObjects.mock.invocationCallOrder[0];
    const databaseOrder = deleteMany.mock.invocationCallOrder[0];

    expect(storageOrder).toBeLessThan(databaseOrder);
  });

  it('preserves metadata when Storage deletion fails', async () => {
    const storageFailure = new Error('Storage unavailable');

    assertCanMutate.mockResolvedValue(undefined);
    fileFindMany.mockResolvedValue([{ storageKey: 'rooms/room-1/file-1.pdf' }]);
    removeObjects.mockRejectedValue(storageFailure);

    await expect(service.delete('owner-1', firstRoomId)).rejects.toBe(
      storageFailure,
    );

    expect(runTransaction).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('returns a deletion summary with a JSON-safe size', async () => {
    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue([
      {
        folderCount: 4,
        fileCount: 9,
        totalBytes: 1234567890123456789n,
      },
    ]);

    await expect(
      service.getDeleteSummary('owner-1', firstRoomId),
    ).resolves.toEqual({
      folderCount: 4,
      fileCount: 9,
      totalBytes: '1234567890123456789',
    });

    expect(assertCanMutate).toHaveBeenCalledWith('owner-1', {
      type: 'dataRoom',
      id: firstRoomId,
    });
  });

  it('returns neutral not found when a Data Room summary is unavailable', async () => {
    assertCanMutate.mockResolvedValue(undefined);
    queryRaw.mockResolvedValue([]);

    await expect(
      service.getDeleteSummary('owner-1', firstRoomId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
