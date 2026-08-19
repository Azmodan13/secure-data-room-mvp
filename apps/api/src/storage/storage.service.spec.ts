import { ServiceUnavailableException } from '@nestjs/common';
import { StorageService } from './storage.service';

type RemoveResult = {
  error: { message: string } | null;
};

type RemoveMock = jest.MockedFunction<
  (storageKeys: string[]) => Promise<RemoveResult>
>;

type FromMock = jest.MockedFunction<
  (bucket: string) => {
    remove: RemoveMock;
  }
>;

describe('StorageService', () => {
  let service: StorageService;
  let remove: RemoveMock;
  let from: FromMock;

  beforeEach(() => {
    remove = jest.fn();
    from = jest.fn(() => ({ remove }));

    service = Object.create(StorageService.prototype) as StorageService;

    Object.defineProperties(service, {
      bucket: {
        value: 'data-room-files',
      },
      client: {
        value: {
          storage: {
            from,
          },
        },
      },
    });
  });

  it('does not call Supabase for an empty key list', async () => {
    await expect(service.removeObjects([])).resolves.toBeUndefined();

    expect(from).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('deduplicates keys and ignores empty values', async () => {
    remove.mockResolvedValue({ error: null });

    await service.removeObjects([
      'rooms/room-1/file.pdf',
      '',
      'rooms/room-1/file.pdf',
      'rooms/room-1/other.pdf',
    ]);

    expect(from).toHaveBeenCalledWith('data-room-files');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([
      'rooms/room-1/file.pdf',
      'rooms/room-1/other.pdf',
    ]);
  });

  it('removes objects in batches of 100', async () => {
    const storageKeys = Array.from(
      { length: 205 },
      (_, index) => `rooms/room-1/file-${index}.pdf`,
    );

    remove.mockResolvedValue({ error: null });

    await service.removeObjects(storageKeys);

    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls[0]?.[0]).toEqual(storageKeys.slice(0, 100));
    expect(remove.mock.calls[1]?.[0]).toEqual(storageKeys.slice(100, 200));
    expect(remove.mock.calls[2]?.[0]).toEqual(storageKeys.slice(200));
  });

  it('treats a successful response for an already-missing object as safe', async () => {
    remove.mockResolvedValue({ error: null });

    await expect(
      service.removeObjects(['rooms/room-1/already-missing.pdf']),
    ).resolves.toBeUndefined();
  });

  it('maps a Supabase removal error to service unavailable', async () => {
    remove.mockResolvedValue({
      error: {
        message: 'Storage unavailable',
      },
    });

    await expect(
      service.removeObjects(['rooms/room-1/file.pdf']),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
