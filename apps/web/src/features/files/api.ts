import { apiFetch } from '@/lib/api/client';
import type {
  ConfirmedFile,
  ConfirmedFileResponse,
  FileDetails,
  FileDetailsResponse,
  FileViewUrl,
  FileViewUrlResponse,
  FilesResponse,
  UploadIntent,
  UploadIntentResponse,
} from './types';

export async function bulkMoveFiles(
  files: Array<{ id: string; name?: string }>,
  folderId: string | null,
): Promise<FileDetails[]> {
  const response = await apiFetch<FilesResponse>('/files/bulk-move', {
    method: 'POST',
    body: JSON.stringify({ files, folderId }),
  });

  return response.data;
}

export async function bulkDeleteFiles(fileIds: string[]): Promise<void> {
  await apiFetch<void>('/files/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ fileIds }),
  });
}

export async function getFile(fileId: string): Promise<FileDetails> {
  const response = await apiFetch<FileDetailsResponse>(`/files/${fileId}`);

  return response.data;
}

export async function getFileViewUrl(fileId: string): Promise<FileViewUrl> {
  const response = await apiFetch<FileViewUrlResponse>(
    `/files/${fileId}/view-url`,
  );

  return response.data;
}

export async function renameFile(
  fileId: string,
  name: string,
): Promise<FileDetails> {
  const response = await apiFetch<FileDetailsResponse>(`/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });

  return response.data;
}

export async function moveFile(
  fileId: string,
  folderId: string | null,
  name?: string,
): Promise<FileDetails> {
  const response = await apiFetch<FileDetailsResponse>(
    `/files/${fileId}/move`,
    {
      method: 'POST',
      body: JSON.stringify({ folderId, ...(name ? { name } : {}) }),
    },
  );

  return response.data;
}

export async function deleteFile(fileId: string): Promise<void> {
  await apiFetch<void>(`/files/${fileId}`, { method: 'DELETE' });
}

type UploadDescriptor = {
  clientId: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
};

export async function createUploadIntents(
  dataRoomId: string,
  folderId: string | null,
  files: UploadDescriptor[],
): Promise<UploadIntent[]> {
  const response = await apiFetch<UploadIntentResponse>(
    `/data-rooms/${dataRoomId}/upload-intents`,
    {
      method: 'POST',
      body: JSON.stringify({
        folderId: folderId ?? undefined,
        files,
      }),
    },
  );

  return response.data;
}

export async function confirmUpload(
  dataRoomId: string,
  folderId: string | null,
  intent: UploadIntent,
  file: File,
): Promise<ConfirmedFile> {
  const response = await apiFetch<ConfirmedFileResponse>(
    `/data-rooms/${dataRoomId}/upload-intents/${intent.uploadId}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify({
        folderId: folderId ?? undefined,
        name: intent.displayName,
        sizeBytes: file.size,
        mimeType: file.type,
      }),
    },
  );

  return response.data;
}

export async function cancelUpload(
  dataRoomId: string,
  uploadId: string,
): Promise<void> {
  await apiFetch<void>(
    `/data-rooms/${dataRoomId}/upload-intents/${uploadId}`,
    { method: 'DELETE' },
  );
}
