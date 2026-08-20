import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma, UploadStatus, type FileRecord } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FilesService } from './files.service';

const ownerId = '11111111-1111-4111-8111-111111111111';
const dataRoomId = '22222222-2222-4222-8222-222222222222';
const folderId = '33333333-3333-4333-8333-333333333333';
const clientId = '44444444-4444-4444-8444-444444444444';
const uploadId = '55555555-5555-4555-8555-555555555555';

type PrismaMock = {
  $transaction: jest.Mock;
  folder: { findFirst: jest.Mock };
  fileRecord: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
};

type PolicyMock = {
  assertCanRead: jest.Mock;
  assertCanMutate: jest.Mock;
};

type StorageMock = {
  createSignedUploadUrl: jest.Mock;
  getObjectInfo: jest.Mock;
  downloadObject: jest.Mock;
  objectExists: jest.Mock;
  createSignedViewUrl: jest.Mock;
  removeObjects: jest.Mock;
};

describe('FilesService', () => {
  let service: FilesService;
  let prisma: PrismaMock;
  let policy: PolicyMock;
  let storage: StorageMock;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
      folder: { findFirst: jest.fn() },
      fileRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    policy = {
      assertCanRead: jest.fn().mockResolvedValue(undefined),
      assertCanMutate: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      createSignedUploadUrl: jest.fn(),
      getObjectInfo: jest.fn(),
      downloadObject: jest.fn(),
      objectExists: jest.fn(),
      createSignedViewUrl: jest.fn(),
      removeObjects: jest.fn().mockResolvedValue(undefined),
    };

    service = new FilesService(
      prisma as unknown as PrismaService,
      policy as unknown as AccessPolicyService,
      storage as unknown as StorageService,
    );
  });

  it('creates independent signed intents and resolves duplicate batch names', async () => {
    prisma.folder.findFirst.mockResolvedValue({ id: folderId });
    prisma.fileRecord.findFirst.mockResolvedValue(null);
    storage.createSignedUploadUrl
      .mockResolvedValueOnce('https://storage.test/first')
      .mockResolvedValueOnce('https://storage.test/second');

    const result = await service.createUploadIntents(ownerId, dataRoomId, {
      folderId,
      files: [
        {
          clientId,
          name: 'Report.pdf',
          sizeBytes: 12,
          mimeType: 'application/pdf',
        },
        {
          clientId: '66666666-6666-4666-8666-666666666666',
          name: 'report.PDF',
          sizeBytes: 15,
          mimeType: 'application/pdf',
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result.map((intent) => intent.displayName)).toEqual([
      'Report.pdf',
      'report (2).pdf',
    ]);
    expect(result[0]?.uploadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(storage.createSignedUploadUrl).toHaveBeenCalledTimes(2);
    expect(policy.assertCanMutate).toHaveBeenCalledWith(ownerId, {
      type: 'dataRoom',
      id: dataRoomId,
    });
  });

  it('rejects a non-PDF extension before creating a signed URL', async () => {
    await expect(
      service.createUploadIntents(ownerId, dataRoomId, {
        files: [
          {
            clientId,
            name: 'notes.txt',
            sizeBytes: 12,
            mimeType: 'application/pdf',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('confirms a verified PDF and creates READY metadata with checksum', async () => {
    const bytes = Buffer.from('%PDF-1.7\ncontent');
    const created = fileRecord({ sizeBytes: BigInt(bytes.length) });

    prisma.folder.findFirst.mockResolvedValue({ id: folderId });
    prisma.fileRecord.findUnique.mockResolvedValue(null);
    prisma.fileRecord.findFirst.mockResolvedValue(null);
    prisma.fileRecord.create.mockResolvedValue(created);
    storage.getObjectInfo.mockResolvedValue({
      size: bytes.length,
      contentType: 'application/pdf',
    });
    storage.downloadObject.mockResolvedValue(bytes);

    const result = await service.confirmUpload(ownerId, dataRoomId, uploadId, {
      folderId,
      name: 'Report.pdf',
      sizeBytes: bytes.length,
      mimeType: 'application/pdf',
    });

    expect(result).toBe(created);
    expect(prisma.fileRecord.create).toHaveBeenCalledWith({
      data: {
        dataRoomId,
        folderId,
        name: 'Report.pdf',
        normalizedName: 'report.pdf',
        storageKey: `rooms/${dataRoomId}/${uploadId}`,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(bytes.length),
        uploadStatus: UploadStatus.READY,
        checksum: createHash('sha256').update(bytes).digest('hex'),
      },
    });
    expect(storage.removeObjects).not.toHaveBeenCalled();
  });

  it('removes an uploaded object when its PDF signature is invalid', async () => {
    const bytes = Buffer.from('not-a-pdf');
    prisma.fileRecord.findUnique.mockResolvedValue(null);
    storage.getObjectInfo.mockResolvedValue({
      size: bytes.length,
      contentType: 'application/pdf',
    });
    storage.downloadObject.mockResolvedValue(bytes);

    await expect(
      service.confirmUpload(ownerId, dataRoomId, uploadId, {
        name: 'fake.pdf',
        sizeBytes: bytes.length,
        mimeType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

    expect(prisma.fileRecord.create).not.toHaveBeenCalled();
    expect(storage.removeObjects).toHaveBeenCalledWith([
      `rooms/${dataRoomId}/${uploadId}`,
    ]);
  });

  it('rejects a size mismatch and cleans the object', async () => {
    prisma.fileRecord.findUnique.mockResolvedValue(null);
    storage.getObjectInfo.mockResolvedValue({
      size: 20,
      contentType: 'application/pdf',
    });

    await expect(
      service.confirmUpload(ownerId, dataRoomId, uploadId, {
        name: 'report.pdf',
        sizeBytes: 10,
        mimeType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.downloadObject).not.toHaveBeenCalled();
    expect(storage.removeObjects).toHaveBeenCalledTimes(1);
  });

  it('returns existing metadata when confirm is retried', async () => {
    const existing = fileRecord();
    prisma.fileRecord.findUnique.mockResolvedValue(existing);

    await expect(
      service.confirmUpload(ownerId, dataRoomId, uploadId, {
        name: 'report.pdf',
        sizeBytes: 12,
        mimeType: 'application/pdf',
      }),
    ).resolves.toBe(existing);

    expect(storage.getObjectInfo).not.toHaveBeenCalled();
    expect(prisma.fileRecord.create).not.toHaveBeenCalled();
  });

  it('cancels only an uncommitted upload and remains idempotent', async () => {
    prisma.fileRecord.findUnique.mockResolvedValue(null);

    await service.cancelUpload(ownerId, dataRoomId, uploadId);

    expect(storage.removeObjects).toHaveBeenCalledWith([
      `rooms/${dataRoomId}/${uploadId}`,
    ]);
  });

  it('returns READY file metadata after checking read access', async () => {
    const file = fileRecord();
    prisma.fileRecord.findFirst.mockResolvedValue(file);

    await expect(service.getFile(ownerId, file.id)).resolves.toBe(file);

    expect(policy.assertCanRead).toHaveBeenCalledWith(ownerId, {
      type: 'file',
      id: file.id,
    });
    expect(prisma.fileRecord.findFirst).toHaveBeenCalledWith({
      where: { id: file.id, uploadStatus: UploadStatus.READY },
    });
  });

  it('creates a short-lived view URL only for an available object', async () => {
    const file = fileRecord();
    prisma.fileRecord.findFirst.mockResolvedValue(file);
    storage.objectExists.mockResolvedValue(true);
    storage.createSignedViewUrl.mockResolvedValue('https://storage.test/pdf');

    const before = Date.now();
    const result = await service.getViewUrl(ownerId, file.id);

    expect(result.url).toBe('https://storage.test/pdf');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + 300_000,
    );
    expect(storage.objectExists).toHaveBeenCalledWith(file.storageKey);
    expect(storage.createSignedViewUrl).toHaveBeenCalledWith(file.storageKey);
  });

  it('does not issue a view URL when the stored object is missing', async () => {
    const file = fileRecord();
    prisma.fileRecord.findFirst.mockResolvedValue(file);
    storage.objectExists.mockResolvedValue(false);

    await expect(service.getViewUrl(ownerId, file.id)).rejects.toThrow(
      'This PDF is no longer available.',
    );

    expect(storage.createSignedViewUrl).not.toHaveBeenCalled();
  });

  it('rejects a rename conflict and suggests an available suffixed name', async () => {
    const file = fileRecord();
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      },
    );
    prisma.fileRecord.findFirst
      .mockResolvedValueOnce(file)
      .mockResolvedValueOnce({ id: 'conflict' })
      .mockResolvedValueOnce(null);
    prisma.fileRecord.update.mockRejectedValue(conflict);

    const promise = service.rename(ownerId, file.id, { name: 'Summary.pdf' });

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(promise).rejects.toMatchObject({
      response: {
        error: {
          code: 'NAME_CONFLICT',
          details: { suggestedName: 'Summary (2).pdf' },
        },
      },
    });
  });

  it('rejects moving a file to a folder in another Data Room', async () => {
    const file = fileRecord();
    prisma.fileRecord.findFirst.mockResolvedValueOnce(file);
    prisma.folder.findFirst.mockResolvedValue(null);

    await expect(
      service.move(ownerId, file.id, { folderId }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.fileRecord.update).not.toHaveBeenCalled();
  });

  it('keeps the file in place and suggests a name on move conflict', async () => {
    const file = fileRecord();
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      },
    );
    prisma.fileRecord.findFirst
      .mockResolvedValueOnce(file)
      .mockResolvedValueOnce({ id: 'conflict' })
      .mockResolvedValueOnce(null);
    prisma.folder.findFirst.mockResolvedValue({ id: folderId });
    prisma.fileRecord.update.mockRejectedValue(conflict);

    const promise = service.move(ownerId, file.id, { folderId });

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(promise).rejects.toMatchObject({
      response: {
        error: {
          code: 'NAME_CONFLICT',
          details: { suggestedName: 'Report (2).pdf' },
        },
      },
    });
  });

  it('moves with the explicitly confirmed suggested name', async () => {
    const file = fileRecord();
    const moved = fileRecord({ folderId, name: 'Report (2).pdf' });
    prisma.fileRecord.findFirst.mockResolvedValueOnce(file);
    prisma.folder.findFirst.mockResolvedValue({ id: folderId });
    prisma.fileRecord.update.mockResolvedValue(moved);

    await expect(
      service.move(ownerId, file.id, {
        folderId,
        name: 'Report (2).pdf',
      }),
    ).resolves.toBe(moved);
  });

  it('keeps DELETING metadata when blob deletion fails so delete can retry', async () => {
    const file = fileRecord();
    prisma.fileRecord.findUnique.mockResolvedValue(file);
    prisma.fileRecord.updateMany.mockResolvedValue({ count: 1 });
    storage.removeObjects.mockRejectedValue(
      new ServiceUnavailableException('Storage unavailable.'),
    );

    await expect(service.delete(ownerId, file.id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(prisma.fileRecord.updateMany).toHaveBeenCalledWith({
      where: { id: file.id, uploadStatus: UploadStatus.READY },
      data: { uploadStatus: UploadStatus.DELETING },
    });
    expect(prisma.fileRecord.deleteMany).not.toHaveBeenCalled();
  });

  it('retries deletion from DELETING and removes metadata after the blob', async () => {
    const file = fileRecord({ uploadStatus: UploadStatus.DELETING });
    prisma.fileRecord.findUnique.mockResolvedValue(file);
    prisma.fileRecord.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.delete(ownerId, file.id)).resolves.toBeUndefined();

    expect(prisma.fileRecord.updateMany).not.toHaveBeenCalled();
    expect(storage.removeObjects).toHaveBeenCalledWith([file.storageKey]);
    expect(prisma.fileRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: file.id, uploadStatus: UploadStatus.DELETING },
    });
  });

  it('treats deletion of an already missing file as successful', async () => {
    prisma.fileRecord.findUnique.mockResolvedValue(null);

    await expect(service.delete(ownerId, uploadId)).resolves.toBeUndefined();

    expect(policy.assertCanMutate).not.toHaveBeenCalled();
    expect(storage.removeObjects).not.toHaveBeenCalled();
  });

  it('does not partially bulk move when any destination name conflicts', async () => {
    const first = fileRecord();
    const second = fileRecord({
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Other.pdf',
      normalizedName: 'other.pdf',
      storageKey: `rooms/${dataRoomId}/other`,
    });
    prisma.fileRecord.findMany
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([{ normalizedName: 'report.pdf' }]);
    prisma.folder.findFirst.mockResolvedValue({ id: folderId });

    const promise = service.bulkMove(ownerId, {
      folderId,
      files: [{ id: first.id }, { id: second.id }],
    });

    await expect(promise).rejects.toMatchObject({
      response: {
        error: {
          code: 'BULK_NAME_CONFLICT',
          details: {
            conflicts: [
              {
                fileId: first.id,
                suggestedName: 'Report (2).pdf',
              },
            ],
          },
        },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bulk moves all files in one database transaction after validation', async () => {
    const first = fileRecord();
    const second = fileRecord({
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Other.pdf',
      normalizedName: 'other.pdf',
      storageKey: `rooms/${dataRoomId}/other`,
    });
    prisma.fileRecord.findMany
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([]);
    prisma.folder.findFirst.mockResolvedValue({ id: folderId });
    prisma.fileRecord.update
      .mockResolvedValueOnce({ ...first, folderId })
      .mockResolvedValueOnce({ ...second, folderId });

    const moved = await service.bulkMove(ownerId, {
      folderId,
      files: [{ id: first.id }, { id: second.id }],
    });

    expect(moved).toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(policy.assertCanMutate).toHaveBeenCalledTimes(2);
  });

  it('keeps all bulk-delete records retryable when Storage fails', async () => {
    const files = [
      fileRecord(),
      fileRecord({
        id: '88888888-8888-4888-8888-888888888888',
        storageKey: `rooms/${dataRoomId}/other`,
      }),
    ];
    prisma.fileRecord.findMany.mockResolvedValue(files);
    prisma.fileRecord.updateMany.mockResolvedValue({ count: 2 });
    storage.removeObjects.mockRejectedValue(
      new ServiceUnavailableException('Storage unavailable.'),
    );

    await expect(
      service.bulkDelete(ownerId, { fileIds: files.map((file) => file.id) }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.fileRecord.deleteMany).not.toHaveBeenCalled();
  });
});

function fileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    dataRoomId,
    folderId: null,
    name: 'Report.pdf',
    normalizedName: 'report.pdf',
    storageKey: `rooms/${dataRoomId}/${uploadId}`,
    mimeType: 'application/pdf',
    sizeBytes: 12n,
    checksum: 'checksum',
    uploadStatus: UploadStatus.READY,
    createdAt: new Date('2026-08-19T00:00:00.000Z'),
    updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    ...overrides,
  };
}
