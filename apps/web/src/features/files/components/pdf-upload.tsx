'use client';

import { LoaderCircle, Upload } from 'lucide-react';
import { type ReactNode, createContext, useContext } from 'react';
import { useDropzone } from 'react-dropzone';
import { type RejectedFile, useUploadQueue } from '../hooks/use-upload-queue';
import { MAX_UPLOAD_BATCH_SIZE, MAX_UPLOAD_BYTES } from '../types';
import { UploadRow } from './upload-row';

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
  const {
    items,
    enqueueFiles,
    uploadToFolder,
    validatePdf,
    cancel,
    retry,
    remove,
  } = useUploadQueue({ dataRoomId, folderId });

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
      enqueueFiles(acceptedFiles, rejections as readonly RejectedFile[]);
    },
    validator: validatePdf,
  });

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
