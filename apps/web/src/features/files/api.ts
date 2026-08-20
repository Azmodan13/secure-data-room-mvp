import { apiFetch } from '@/lib/api/client';
import type {
  ConfirmedFile,
  ConfirmedFileResponse,
  FileDetails,
  FileDetailsResponse,
  FileViewUrl,
  FileViewUrlResponse,
  UploadIntent,
  UploadIntentResponse,
} from './types';

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
