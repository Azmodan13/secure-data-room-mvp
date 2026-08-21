'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileError } from 'react-dropzone';
import { toast } from 'sonner';
import { dataRoomKeys } from '@/features/data-rooms/queries';
import { ApiError } from '@/lib/api/client';
import { cancelUpload, confirmUpload, createUploadIntents } from '../api';
import type { UploadIntent, UploadQueueItem } from '../types';
import {
  MAX_UPLOAD_BATCH_SIZE,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONCURRENCY,
} from '../types';
import { uploadFileToSignedUrl } from '../upload-file';

type PendingUpload = Pick<
  UploadQueueItem,
  'clientId' | 'file' | 'destinationFolderId' | 'destinationName'
>;

export type RejectedFile = {
  file: File;
  errors: readonly FileError[];
};

type UseUploadQueueOptions = {
  dataRoomId: string;
  folderId: string | null;
};

export function useUploadQueue({
  dataRoomId,
  folderId,
}: UseUploadQueueOptions) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const activeUploads = useRef(new Map<string, AbortController>());
  const cancelledIds = useRef(new Set<string>());
  const isUnmounted = useRef(false);

  const updateItem = useCallback(
    (clientId: string, updates: Partial<UploadQueueItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.clientId === clientId ? { ...item, ...updates } : item,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const controllers = activeUploads.current;
    isUnmounted.current = false;

    return () => {
      isUnmounted.current = true;
      for (const controller of controllers.values()) controller.abort();
    };
  }, []);

  const processIntent = useCallback(
    async (pending: PendingUpload, intent: UploadIntent) => {
      const { clientId, file } = pending;

      if (isUnmounted.current || cancelledIds.current.has(clientId)) {
        await cancelUpload(dataRoomId, intent.uploadId).catch(() => undefined);
        return;
      }

      const controller = new AbortController();
      activeUploads.current.set(clientId, controller);
      updateItem(clientId, {
        displayName: intent.displayName,
        uploadId: intent.uploadId,
        status: 'uploading',
        progress: 0,
      });

      try {
        await uploadFileToSignedUrl({
          file,
          uploadUrl: intent.uploadUrl,
          signal: controller.signal,
          onProgress: (progress) => updateItem(clientId, { progress }),
        });

        if (isUnmounted.current || cancelledIds.current.has(clientId)) {
          throw new DOMException('Upload cancelled.', 'AbortError');
        }

        updateItem(clientId, { status: 'confirming', progress: 100 });
        const confirmed = await confirmUpload(
          dataRoomId,
          pending.destinationFolderId,
          intent,
          file,
        );

        await queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(dataRoomId, folderId),
        });
        if (pending.destinationFolderId !== folderId) {
          await queryClient.invalidateQueries({
            queryKey: dataRoomKeys.items(
              dataRoomId,
              pending.destinationFolderId,
            ),
          });
        }

        setItems((current) =>
          current.filter((item) => item.clientId !== clientId),
        );
        toast.success(`“${confirmed.name}” uploaded.`);
      } catch (error) {
        await cancelUpload(dataRoomId, intent.uploadId).catch(() => undefined);

        if (
          isUnmounted.current ||
          cancelledIds.current.has(clientId) ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          updateItem(clientId, {
            status: 'cancelled',
            error: null,
            retryable: true,
          });
          return;
        }

        updateItem(clientId, {
          status: 'error',
          error:
            error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Upload failed. Try again.',
          retryable: true,
        });
      } finally {
        activeUploads.current.delete(clientId);
      }
    },
    [dataRoomId, folderId, queryClient, updateItem],
  );

  const processEntries = useCallback(
    async (pendingFiles: PendingUpload[]) => {
      for (const pending of pendingFiles) {
        updateItem(pending.clientId, {
          status: 'requesting',
          progress: 0,
          error: null,
          uploadId: null,
        });
      }

      let intents: UploadIntent[];
      try {
        intents = await createUploadIntents(
          dataRoomId,
          pendingFiles[0]?.destinationFolderId ?? null,
          pendingFiles.map(({ clientId, file }) => ({
            clientId,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
          })),
        );
      } catch (error) {
        const message =
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Unable to prepare uploads. Try again.';
        for (const pending of pendingFiles) {
          if (!cancelledIds.current.has(pending.clientId)) {
            updateItem(pending.clientId, {
              status: 'error',
              error: message,
              retryable: true,
            });
          }
        }
        return;
      }

      const intentsByClientId = new Map(
        intents.map((intent) => [intent.clientId, intent]),
      );
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < pendingFiles.length) {
          const pending = pendingFiles[nextIndex];
          nextIndex += 1;
          if (!pending) return;

          const intent = intentsByClientId.get(pending.clientId);
          if (!intent) {
            updateItem(pending.clientId, {
              status: 'error',
              error: 'The server did not return an upload target.',
              retryable: true,
            });
            continue;
          }
          await processIntent(pending, intent);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(UPLOAD_CONCURRENCY, pendingFiles.length) },
          () => worker(),
        ),
      );
    },
    [dataRoomId, processIntent, updateItem],
  );

  const enqueueFiles = useCallback(
    (
      acceptedFiles: File[],
      rejections: readonly RejectedFile[],
      destinationFolderId: string | null = folderId,
      destinationName: string | null = null,
    ) => {
      const acceptedItems = acceptedFiles.map<UploadQueueItem>((file) => ({
        clientId: crypto.randomUUID(),
        file,
        destinationFolderId,
        destinationName,
        displayName: file.name,
        uploadId: null,
        progress: 0,
        status: 'queued',
        error: null,
        retryable: true,
      }));
      const rejectedItems = rejections.map<UploadQueueItem>((rejection) => ({
        clientId: crypto.randomUUID(),
        file: rejection.file,
        destinationFolderId,
        destinationName,
        displayName: rejection.file.name,
        uploadId: null,
        progress: 0,
        status: 'error',
        error: rejection.errors[0]?.message ?? 'This file cannot be uploaded.',
        retryable: false,
      }));

      setItems((current) => [...acceptedItems, ...rejectedItems, ...current]);
      if (acceptedItems.length > 0) void processEntries(acceptedItems);
      if (rejectedItems.length > 0) {
        toast.error(
          `${rejectedItems.length} file${rejectedItems.length === 1 ? '' : 's'} rejected.`,
        );
      }
    },
    [folderId, processEntries],
  );

  const validatePdf = useCallback((file: File): FileError | null => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return {
        code: 'file-extension',
        message: 'Only .pdf files are allowed.',
      };
    }
    if (file.type !== 'application/pdf') {
      return {
        code: 'file-type',
        message: 'The file must have the application/pdf MIME type.',
      };
    }
    return null;
  }, []);

  const uploadToFolder = useCallback(
    (destinationFolderId: string, destinationName: string, files: File[]) => {
      const acceptedFiles: File[] = [];
      const rejections: RejectedFile[] = [];

      files.forEach((file, index) => {
        const errors: FileError[] = [];
        const pdfError = validatePdf(file);
        if (index >= MAX_UPLOAD_BATCH_SIZE) {
          errors.push({
            code: 'too-many-files',
            message: 'Only 10 files can be uploaded in one batch.',
          });
        }
        if (file.size < 1) {
          errors.push({
            code: 'file-too-small',
            message: 'The PDF cannot be empty.',
          });
        } else if (file.size > MAX_UPLOAD_BYTES) {
          errors.push({
            code: 'file-too-large',
            message: 'The PDF must not exceed 25 MB.',
          });
        }
        if (pdfError) errors.push(pdfError);
        if (errors.length > 0) rejections.push({ file, errors });
        else acceptedFiles.push(file);
      });

      enqueueFiles(
        acceptedFiles,
        rejections,
        destinationFolderId,
        destinationName,
      );
    },
    [enqueueFiles, validatePdf],
  );

  async function cancel(item: UploadQueueItem) {
    cancelledIds.current.add(item.clientId);
    activeUploads.current.get(item.clientId)?.abort();
    updateItem(item.clientId, { status: 'cancelled', error: null });
    if (item.uploadId) {
      await cancelUpload(dataRoomId, item.uploadId).catch(() => undefined);
    }
  }

  function retry(item: UploadQueueItem) {
    cancelledIds.current.delete(item.clientId);
    void processEntries([
      {
        clientId: item.clientId,
        file: item.file,
        destinationFolderId: item.destinationFolderId,
        destinationName: item.destinationName,
      },
    ]);
  }

  function remove(clientId: string) {
    setItems((current) => current.filter((item) => item.clientId !== clientId));
  }

  return {
    items,
    enqueueFiles,
    uploadToFolder,
    validatePdf,
    cancel,
    retry,
    remove,
  };
}
