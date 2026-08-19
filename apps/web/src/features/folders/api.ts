import { apiFetch } from '@/lib/api/client';
import type {
  CreateFolderInput,
  Folder,
  FolderBreadcrumb,
  FolderBreadcrumbsResponse,
  FolderResponse,
} from './types';
import type { DeletionSummary, DeletionSummaryResponse } from '@/lib/api/types';

export async function createFolder({
  dataRoomId,
  parentId,
  name,
}: CreateFolderInput): Promise<Folder> {
  const response = await apiFetch<FolderResponse>(
    `/data-rooms/${dataRoomId}/folders`,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...(parentId ? { parentId } : {}),
      }),
    },
  );

  return response.data;
}

export async function getFolderBreadcrumbs(
  folderId: string,
): Promise<FolderBreadcrumb[]> {
  const response = await apiFetch<FolderBreadcrumbsResponse>(
    `/folders/${folderId}/breadcrumbs`,
  );

  return response.data;
}

export async function renameFolder(
  folderId: string,
  name: string,
): Promise<Folder> {
  const response = await apiFetch<FolderResponse>(`/folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });

  return response.data;
}

export async function getFolderDeleteSummary(
  folderId: string,
): Promise<DeletionSummary> {
  const response = await apiFetch<DeletionSummaryResponse>(
    `/folders/${folderId}/delete-summary`,
  );

  return response.data;
}

export async function deleteFolder(folderId: string): Promise<void> {
  await apiFetch<void>(`/folders/${folderId}`, {
    method: 'DELETE',
  });
}
