'use client';

import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AccountActions } from '@/components/account-actions';
import { useFile, useFileViewUrl } from '@/features/files/queries';
import { formatBytes } from '@/lib/format';

export function SharedFileViewer({ fileId }: { fileId: string }) {
  const fileQuery = useFile(fileId);
  const viewUrlQuery = useFileViewUrl(fileId, fileQuery.isSuccess);
  const [iframeFailed, setIframeFailed] = useState(false);
  if (fileQuery.isPending)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="size-5 animate-spin" />
      </main>
    );
  if (fileQuery.isError) return <SharedFileUnavailable />;
  const file = fileQuery.data;
  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <Link
              href="/shared"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              <ArrowLeft className="size-4" />
              Shared with me
            </Link>
            <AccountActions />
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2.5 text-red-600 dark:bg-red-950/40">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Read-only shared PDF
                </p>
                <h1 className="truncate text-xl font-semibold">{file.name}</h1>
                <p className="text-sm text-zinc-500">
                  {formatBytes(file.sizeBytes)}
                </p>
              </div>
            </div>
            {viewUrlQuery.data ? (
              <a
                href={viewUrlQuery.data.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
              >
                <ExternalLink className="size-4" />
                Open in new tab
              </a>
            ) : null}
          </div>
        </header>
        <section className="relative mt-6 min-h-[70vh] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {viewUrlQuery.isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoaderCircle className="size-5 animate-spin" />
            </div>
          ) : null}
          {viewUrlQuery.isError || iframeFailed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <AlertCircle className="size-8 text-zinc-400" />
              <h2 className="mt-3 font-semibold">
                This shared item is no longer available
              </h2>
            </div>
          ) : null}
          {viewUrlQuery.data && !iframeFailed ? (
            <iframe
              src={viewUrlQuery.data.url}
              title={file.name}
              onError={() => setIframeFailed(true)}
              className="h-[78vh] w-full"
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SharedFileUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="text-center">
        <AlertCircle className="mx-auto size-8 text-zinc-400" />
        <h1 className="mt-3 font-semibold">
          This shared item is no longer available
        </h1>
        <Link
          href="/shared"
          className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Return to Shared with me
        </Link>
      </div>
    </main>
  );
}
