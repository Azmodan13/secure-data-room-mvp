'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CircleX,
  FileText,
  LoaderCircle,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type FileError,
  useDropzone,
} from 'react-dropzone';
import { toast } from 'sonner';
import { dataRoomKeys } from '@/features/data-rooms/queries';
import { ApiError } from '@/lib/api/client';
import { formatBytes } from '@/lib/format';
import { cancelUpload, confirmUpload, createUploadIntents } from '../api';
import type { UploadIntent, UploadQueueItem } from '../types';
import {
  MAX_UPLOAD_BATCH_SIZE,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONCURRENCY,
} from '../types';
import { uploadFileToSignedUrl } from '../upload-file';

type PdfUploadProps = {
  dataRoomId: string;
  folderId: string | null;
  inputId: string;
  hasPersistedItems: boolean;
  children: ReactNode;
  emptyFolderAction: ReactNode;
  readOnly?: boolean;
  isRefreshing?: boolean;
};

export type UploadToFolder = (
  folderId: string,
  folderName: string,
  files: File[],
) => void;

const FolderUploadContext = createContext<UploadToFolder | null>(null);

export function useFolderUpload(): UploadToFolder {
  const uploadToFolder = useContext(FolderUploadContext);

  if (!uploadToFolder) {
    throw new Error('useFolderUpload must be used within PdfUpload.');
  }

  return uploadToFolder;
}

type PendingUpload = Pick<
  UploadQueueItem,
  | 'clientId'
  | 'file'
  | 'destinationFolderId'
  | 'destinationName'
>;

type RejectedFile = {
  file: File;
  errors: readonly FileError[];
};

export function PdfUpload({
  dataRoomId,
  folderId,
  inputId,
  hasPersistedItems,
  children,
  emptyFolderAction,
  readOnly = false,
  isRefreshing = false,
}: PdfUploadProps) {
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

      for (const controller of controllers.values()) {
        controller.abort();
      }
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

          if (!pending) {
            return;
          }

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

      if (acceptedItems.length > 0) {
        void processEntries(acceptedItems);
      }

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
      return { code: 'file-extension', message: 'Only .pdf files are allowed.' };
    }

    if (file.type !== 'application/pdf') {
      return {
        code: 'file-type',
        message: 'The file must have the application/pdf MIME type.',
      };
    }

    return null;
  }, []);

  const uploadToFolder = useCallback<UploadToFolder>(
    (destinationFolderId, destinationName, files) => {
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

        if (pdfError) {
          errors.push(pdfError);
        }

        if (errors.length > 0) {
          rejections.push({ file, errors });
        } else {
          acceptedFiles.push(file);
        }
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

  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
    disabled: readOnly,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: MAX_UPLOAD_BATCH_SIZE,
    maxSize: MAX_UPLOAD_BYTES,
    minSize: 1,
    multiple: true,
    noClick: true,
    onDrop: (acceptedFiles, rejections, event) => {
      const eventTarget = event.target;

      if (
        eventTarget instanceof Element &&
        eventTarget.closest('[data-folder-drop-target]')
      ) {
        return;
      }

      enqueueFiles(acceptedFiles, rejections);
    },
    validator: validatePdf,
  });

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
    setItems((current) =>
      current.filter((item) => item.clientId !== clientId),
    );
  }

  if (readOnly) {
    return hasPersistedItems ? (
      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        <FolderUploadContext.Provider value={uploadToFolder}>
          {children}
        </FolderUploadContext.Provider>
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          This folder is empty
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasPersistedItems ? (
        <div
          {...getRootProps()}
          className={`rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
              : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'
          }`}
        >
          <input {...getInputProps({ id: inputId })} />
          <Upload className="mx-auto size-7 text-zinc-400" />
          <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {isDragActive ? 'Drop PDFs here' : 'Drag and drop PDFs here'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Up to 10 files per batch, 25 MB each
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Upload className="size-4" />
              Choose PDFs
            </button>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">or</span>
            {emptyFolderAction}
          </div>
        </div>
      ) : null}

      {items.length > 0 || hasPersistedItems ? (
        <div
          {...(hasPersistedItems ? getRootProps() : {})}
          className={`relative rounded-xl transition-shadow ${
            hasPersistedItems && isDragActive
              ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950'
              : ''
          }`}
        >
          {hasPersistedItems ? (
            <input {...getInputProps({ id: inputId })} />
          ) : null}

          <div className="relative overflow-hidden divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {items.map((item) => (
              <UploadRow
                key={item.clientId}
                item={item}
                onCancel={() => void cancel(item)}
                onRemove={() => remove(item.clientId)}
                onRetry={() => retry(item)}
              />
            ))}
            <div className="relative min-w-0 overflow-hidden">
              <FolderUploadContext.Provider value={uploadToFolder}>
                {children}
              </FolderUploadContext.Provider>
              {isRefreshing ? (
                <div className="absolute inset-0 z-20 flex min-h-48 items-center justify-center bg-white/75 backdrop-blur-[1px] dark:bg-zinc-950/75">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <LoaderCircle className="size-4 animate-spin" />
                    Sorting items…
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type UploadRowProps = {
  item: UploadQueueItem;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
};

function UploadRow({ item, onCancel, onRemove, onRetry }: UploadRowProps) {
  const isActive = ['queued', 'requesting', 'uploading', 'confirming'].includes(
    item.status,
  );

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <FileText className="mt-0.5 size-5 shrink-0 text-red-500" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {item.displayName}
          </p>
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {formatBytes(String(item.file.size))}
          </span>
        </div>

        {isActive ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width] duration-150"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {statusLabel(item)}
            </p>
          </div>
        ) : null}

        {item.status === 'cancelled' ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Cancelled
          </p>
        ) : null}

        {item.destinationName ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Destination: {item.destinationName}
          </p>
        ) : null}

        {item.status === 'error' ? (
          <p className="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
            <CircleX className="mt-0.5 size-3.5 shrink-0" />
            {item.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isActive ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label={`Cancel ${item.displayName}`}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" />
          </button>
        ) : null}

        {!isActive && item.retryable ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label={`Retry ${item.displayName}`}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <RefreshCw className="size-4" />
          </button>
        ) : null}

        {!isActive ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.displayName} from the list`}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(item: UploadQueueItem): string {
  switch (item.status) {
    case 'queued':
      return 'Queued';
    case 'requesting':
      return 'Preparing secure upload…';
    case 'uploading':
      return `Uploading ${item.progress}%`;
    case 'confirming':
      return 'Verifying PDF…';
    default:
      return '';
  }
}
