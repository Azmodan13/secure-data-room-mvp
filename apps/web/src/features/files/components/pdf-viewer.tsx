'use client';

import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AccountActions } from '@/components/account-actions';
import { useFile, useFileViewUrl } from '../queries';
import { useDataRoom } from '@/features/data-rooms/queries';
import { FileActions } from './file-actions';

function formatFileSize(sizeBytes: string): string {
  const bytes = Number(sizeBytes);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'Unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function Unavailable({ dataRoomId }: { dataRoomId: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <AlertCircle className="mx-auto size-8 text-zinc-400" />
        <h1 className="mt-3 font-semibold text-zinc-950 dark:text-zinc-100">
          This PDF is no longer available
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          It may have been deleted or you may no longer have access.
        </p>
        <Link
          href={`/rooms/${dataRoomId}`}
          className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Return to Data Room
        </Link>
      </div>
    </main>
  );
}

export function PdfViewer({
  dataRoomId,
  fileId,
  currentUserId,
}: {
  dataRoomId: string;
  fileId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [iframeFailed, setIframeFailed] = useState(false);
  const fileQuery = useFile(fileId);
  const dataRoomQuery = useDataRoom(dataRoomId);
  const belongsToRoom = fileQuery.data?.dataRoomId === dataRoomId;
  const viewUrlQuery = useFileViewUrl(fileId, belongsToRoom);

  if (fileQuery.isError || (fileQuery.data && !belongsToRoom)) {
    return <Unavailable dataRoomId={dataRoomId} />;
  }

  if (fileQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <LoaderCircle className="size-5 animate-spin" />
          Loading PDF…
        </div>
      </main>
    );
  }

  const file = fileQuery.data;
  const backHref = file.folderId
    ? `/rooms/${dataRoomId}?folderId=${file.folderId}`
    : `/rooms/${dataRoomId}`;
  const canMutate = dataRoomQuery.data?.ownerId === currentUserId;

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="size-4" />
              Back to folder
            </Link>
            <AccountActions />
          </div>

          <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {file.name}
                </h1>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatFileSize(file.sizeBytes)} · Uploaded{' '}
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                  }).format(new Date(file.createdAt))}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewUrlQuery.data ? (
                <a
                  href={viewUrlQuery.data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="size-4" />
                  Open in new tab
                </a>
              ) : null}
              {canMutate ? (
                <FileActions
                  file={file}
                  onDeleted={() => router.push(backHref)}
                />
              ) : null}
            </div>
          </div>
        </header>

        <section className="relative mt-6 min-h-[70vh] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {viewUrlQuery.isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <LoaderCircle className="size-5 animate-spin" />
                Preparing secure preview…
              </div>
            </div>
          ) : null}

          {viewUrlQuery.isError || iframeFailed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="size-8 text-zinc-400" />
              <h2 className="mt-3 font-semibold text-zinc-950 dark:text-zinc-100">
                This PDF is no longer available
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                The preview could not be loaded. Try returning to the folder.
              </p>
            </div>
          ) : null}

          {viewUrlQuery.data && !iframeFailed ? (
            <iframe
              src={viewUrlQuery.data.url}
              title={file.name}
              onError={() => setIframeFailed(true)}
              className="h-[calc(100vh-14rem)] min-h-[70vh] w-full"
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
