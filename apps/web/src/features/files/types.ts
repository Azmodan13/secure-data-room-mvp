export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_SIZE = 10;
export const UPLOAD_CONCURRENCY = 3;

export type UploadIntent = {
  clientId: string;
  uploadId: string;
  uploadUrl: string;
  displayName: string;
};

export type UploadIntentResponse = {
  data: UploadIntent[];
};

export type ConfirmedFile = {
  id: string;
  dataRoomId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
  updatedAt: string;
};

export type ConfirmedFileResponse = {
  data: ConfirmedFile;
};

export type UploadQueueStatus =
  | 'queued'
  | 'requesting'
  | 'uploading'
  | 'confirming'
  | 'error'
  | 'cancelled';

export type UploadQueueItem = {
  clientId: string;
  file: File;
  destinationFolderId: string | null;
  destinationName: string | null;
  displayName: string;
  uploadId: string | null;
  progress: number;
  status: UploadQueueStatus;
  error: string | null;
  retryable: boolean;
};
