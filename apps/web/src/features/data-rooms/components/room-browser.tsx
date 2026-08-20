'use client';

import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Folder,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type DragEvent, useState } from 'react';
import { useDataRoom, useDataRoomItems } from '../queries';
import type { FileItem, FolderItem } from '../types';
import { CreateFolderDialog } from '@/features/folders/components/create-folder-dialog';
import { ChevronRight } from 'lucide-react';
import { useFolderBreadcrumbs } from '@/features/folders/queries';
import { FolderActions } from '@/features/folders/components/folder-actions';
import { PdfUpload } from '@/features/files/components/pdf-upload';
import { AccountActions } from '@/components/account-actions';
import { useFolderUpload } from '@/features/files/components/pdf-upload';

function formatFileSize(sizeBytes: string): string {
  const bytes = Number(sizeBytes);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'Unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function FileRow({ file }: { file: FileItem }) {
  return (
    <Link
      href={`/rooms/${file.dataRoomId}/files/${file.id}`}
      className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-zinc-800/70"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
        <FileText className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {file.name}
        </p>

        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {formatFileSize(file.sizeBytes)}
        </p>
      </div>
    </Link>
  );
}

type FolderRowProps = {
  dataRoomId: string;
  folder: FolderItem;
  onOpen: () => void;
};

function FolderRow({
  dataRoomId,
  folder,
  onOpen,
}: FolderRowProps) {
  const [isFileOver, setIsFileOver] = useState(false);
  const uploadToFolder = useFolderUpload();

  function acceptsFiles(event: DragEvent<HTMLElement>): boolean {
    return event.dataTransfer.types.includes('Files');
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!acceptsFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsFileOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsFileOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!acceptsFiles(event)) {
      return;
    }

    event.preventDefault();
    setIsFileOver(false);

    const files = Array.from(event.dataTransfer.files);

    if (files.length > 0) {
      uploadToFolder(folder.id, folder.name, files);
    }
  }

  return (
    <div
      data-folder-drop-target
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex items-center rounded-lg transition-colors ${
        isFileOver
          ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-950/70'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/70'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Folder className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {folder.name}
          </p>
          {isFileOver ? (
            <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">
              Drop to upload here
            </p>
          ) : null}
        </div>
      </button>

      <div className="shrink-0 pr-2">
        <FolderActions dataRoomId={dataRoomId} folder={folder} />
      </div>
    </div>
  );
}

export function RoomBrowser({ dataRoomId }: { dataRoomId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId');

  const dataRoomQuery = useDataRoom(dataRoomId);
  const itemsQuery = useDataRoomItems(dataRoomId, folderId);
  const breadcrumbsQuery = useFolderBreadcrumbs(folderId);

  function openFolder(nextFolderId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('folderId', nextFolderId);

    router.push(`/rooms/${dataRoomId}?${params.toString()}`);
  }

  function returnToRoot() {
    router.push(`/rooms/${dataRoomId}`);
  }

  if (dataRoomQuery.isPending || itemsQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <LoaderCircle className="size-5 animate-spin" />
          Loading Data Room…
        </div>
      </main>
    );
  }

  if (dataRoomQuery.isError || itemsQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/30">
          <AlertCircle className="mx-auto size-8 text-red-500" />

          <h1 className="mt-3 font-semibold text-red-950 dark:text-red-100">
            Unable to open this Data Room
          </h1>

          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            It may have been deleted or you may no longer have access.
          </p>

          <Link
            href="/rooms"
            className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Return to Data Rooms
          </Link>
        </div>
      </main>
    );
  }

  const items = itemsQuery.data.pages.flatMap((page) => page.data);
  const uploadInputId = `pdf-upload-${folderId ?? `room-${dataRoomId}`}`;

  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/rooms"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="size-4" />
              Data Rooms
            </Link>

            <AccountActions />
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                {dataRoomQuery.data.name}
              </h1>

              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Secure documents and folders
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {items.length > 0 ? (
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
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Upload className="size-4" />
                  Upload files
                </label>
              ) : null}

              <CreateFolderDialog dataRoomId={dataRoomId} parentId={folderId} />
            </div>
          </div>
        </header>

        <nav
          aria-label="Breadcrumb"
          className="flex min-h-14 items-center gap-1 overflow-x-auto border-b border-zinc-200 py-3 text-sm dark:border-zinc-800"
        >
          <button
            type="button"
            onClick={returnToRoot}
            className={
              folderId
                ? 'shrink-0 font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
                : 'shrink-0 font-medium text-zinc-950 dark:text-zinc-50'
            }
          >
            {dataRoomQuery.data.name}
          </button>

          {folderId && breadcrumbsQuery.isPending ? (
            <>
              <ChevronRight className="size-4 shrink-0 text-zinc-400" />
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </>
          ) : null}

          {folderId && breadcrumbsQuery.isError ? (
            <>
              <ChevronRight className="size-4 shrink-0 text-zinc-400" />
              <span className="shrink-0 text-red-600 dark:text-red-400">
                Folder unavailable
              </span>
            </>
          ) : null}

          {breadcrumbsQuery.data?.map((breadcrumb, index, items) => {
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
                    onClick={() => openFolder(breadcrumb.id)}
                    className="max-w-52 truncate font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    {breadcrumb.name}
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        <section className="py-6">
          <PdfUpload
            key={folderId ?? 'room-root'}
            dataRoomId={dataRoomId}
            folderId={folderId}
            inputId={uploadInputId}
            hasPersistedItems={items.length > 0}
            emptyFolderAction={
              <CreateFolderDialog
                dataRoomId={dataRoomId}
                parentId={folderId}
                variant="empty"
              />
            }
          >
            {items.map((item) =>
              item.type === 'folder' ? (
                <FolderRow
                  key={item.id}
                  dataRoomId={dataRoomId}
                  folder={item}
                  onOpen={() => openFolder(item.id)}
                />
              ) : (
                <FileRow key={item.id} file={item} />
              ),
            )}
          </PdfUpload>

          {itemsQuery.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={itemsQuery.isFetchingNextPage}
                onClick={() => itemsQuery.fetchNextPage()}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {itemsQuery.isFetchingNextPage ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {itemsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
