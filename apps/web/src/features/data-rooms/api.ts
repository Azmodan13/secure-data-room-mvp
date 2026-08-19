import { apiFetch } from '@/lib/api/client';
import type {
  DataRoom,
  DataRoomItemsResponse,
  DataRoomResponse,
  DataRoomsResponse,
} from './types';
import type { DeletionSummary, DeletionSummaryResponse } from '@/lib/api/types';

const PAGE_SIZE = 50;

export async function getDataRooms(
  cursor: string | null,
): Promise<DataRoomsResponse> {
  const searchParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
  });

  if (cursor) {
    searchParams.set('cursor', cursor);
  }

  return apiFetch<DataRoomsResponse>(`/data-rooms?${searchParams.toString()}`);
}

export async function createDataRoom(name: string): Promise<DataRoom> {
  const response = await apiFetch<DataRoomResponse>('/data-rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  return response.data;
}

export async function getDataRoom(dataRoomId: string): Promise<DataRoom> {
  const response = await apiFetch<DataRoomResponse>(
    `/data-rooms/${dataRoomId}`,
  );

  return response.data;
}

export async function getDataRoomItems(
  dataRoomId: string,
  folderId: string | null,
  cursor: string | null,
): Promise<DataRoomItemsResponse> {
  const searchParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
  });

  if (folderId) {
    searchParams.set('folderId', folderId);
  }

  if (cursor) {
    searchParams.set('cursor', cursor);
  }

  return apiFetch<DataRoomItemsResponse>(
    `/data-rooms/${dataRoomId}/items?${searchParams.toString()}`,
  );
}

export async function renameDataRoom(
  dataRoomId: string,
  name: string,
): Promise<DataRoom> {
  const response = await apiFetch<DataRoomResponse>(
    `/data-rooms/${dataRoomId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );

  return response.data;
}

export async function getDataRoomDeleteSummary(
  dataRoomId: string,
): Promise<DeletionSummary> {
  const response = await apiFetch<DeletionSummaryResponse>(
    `/data-rooms/${dataRoomId}/delete-summary`,
  );

  return response.data;
}

export async function deleteDataRoom(dataRoomId: string): Promise<void> {
  await apiFetch<void>(`/data-rooms/${dataRoomId}`, {
    method: 'DELETE',
  });
}
