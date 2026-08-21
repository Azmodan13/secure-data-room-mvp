'use client';

import { ArrowLeft, ChevronRight, Upload } from 'lucide-react';
import Link from 'next/link';
import { AccountActions } from '@/components/account-actions';
import { CreateFolderDialog } from '@/features/folders/components/create-folder-dialog';

type Breadcrumb = { id: string; name: string };

export function RoomBrowserHeader({
  dataRoomId,
  dataRoomName,
  folderId,
  canMutate,
  hasItems,
  uploadInputId,
  breadcrumbs,
  breadcrumbsPending,
  breadcrumbsError,
  onOpenFolder,
  onReturnToRoot,
}: {
  dataRoomId: string;
  dataRoomName: string;
  folderId: string | null;
  canMutate: boolean;
  hasItems: boolean;
  uploadInputId: string;
  breadcrumbs?: Breadcrumb[];
  breadcrumbsPending: boolean;
  breadcrumbsError: boolean;
  onOpenFolder: (folderId: string) => void;
  onReturnToRoot: () => void;
}) {
  return (
    <>
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-4" />
            Data Rooms
          </Link>
          <AccountActions />
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-zinc-950 sm:text-3xl dark:text-zinc-50">
              {dataRoomName}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Secure documents and folders
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {canMutate && hasItems ? (
              <label
                htmlFor={uploadInputId}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    document.getElementById(uploadInputId)?.click();
                  }
                }}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Upload className="size-4" />
                Upload files
              </label>
            ) : null}
            {canMutate ? (
              <CreateFolderDialog dataRoomId={dataRoomId} parentId={folderId} />
            ) : null}
          </div>
        </div>
      </header>

      <nav
        aria-label="Breadcrumb"
        className="flex min-h-14 items-center gap-1 overflow-x-auto border-b border-zinc-200 py-3 text-sm dark:border-zinc-800"
      >
        <button
          type="button"
          onClick={onReturnToRoot}
          className={
            folderId
              ? 'shrink-0 font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
              : 'shrink-0 font-medium text-zinc-950 dark:text-zinc-50'
          }
        >
          {dataRoomName}
        </button>
        {folderId && breadcrumbsPending ? (
          <>
            <ChevronRight className="size-4 shrink-0 text-zinc-400" />
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </>
        ) : null}
        {folderId && breadcrumbsError ? (
          <>
            <ChevronRight className="size-4 shrink-0 text-zinc-400" />
            <span className="shrink-0 text-red-600 dark:text-red-400">
              Folder unavailable
            </span>
          </>
        ) : null}
        {breadcrumbs?.map((breadcrumb, index, items) => {
          const isCurrent = index === items.length - 1;
          return (
            <div
              key={breadcrumb.id}
              className="flex shrink-0 items-center gap-1"
            >
              <ChevronRight className="size-4 text-zinc-400" />
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="max-w-52 truncate font-medium text-zinc-950 dark:text-zinc-50"
                >
                  {breadcrumb.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenFolder(breadcrumb.id)}
                  className="max-w-52 truncate font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  {breadcrumb.name}
                </button>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
