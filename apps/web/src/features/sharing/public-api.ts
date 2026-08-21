import type { DataRoomItem } from '@/features/data-rooms/types';
import type { FileViewUrl } from '@/features/files/types';
import type { Folder } from '@/features/folders/types';

export type PublicRoot =
  | { type: 'dataRoom'; id: string; name: string }
  | {
      type: 'folder';
      id: string;
      name: string;
      dataRoomId: string;
      parentId: string | null;
    }
  | {
      type: 'file';
      id: string;
      name: string;
      dataRoomId: string;
      folderId: string | null;
      mimeType: string;
      sizeBytes: string;
      createdAt: string;
    };

async function publicFetch<T>(path: string): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  const response = await fetch(`${apiUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('This shared item is not available.');
  return response.json() as Promise<T>;
}

export async function getPublicRoot(token: string) {
  return (
    await publicFetch<{ data: PublicRoot }>(
      `/public/${encodeURIComponent(token)}`,
    )
  ).data;
}
export async function getPublicItems(token: string, folderId?: string) {
  const params = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
  return (
    await publicFetch<{ data: { items: DataRoomItem[]; hasMore: boolean } }>(
      `/public/${encodeURIComponent(token)}/items${params}`,
    )
  ).data;
}
export async function getPublicFolder(token: string, folderId: string) {
  return (
    await publicFetch<{ data: Folder }>(
      `/public/${encodeURIComponent(token)}/folders/${folderId}`,
    )
  ).data;
}
export async function getPublicViewUrl(token: string, fileId: string) {
  return (
    await publicFetch<{ data: FileViewUrl }>(
      `/public/${encodeURIComponent(token)}/files/${fileId}/view-url`,
    )
  ).data;
}
