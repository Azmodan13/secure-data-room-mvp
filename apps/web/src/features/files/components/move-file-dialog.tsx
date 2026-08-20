'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  LoaderCircle,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ApiError, getSuggestedName } from '@/lib/api/client';
import { useFolderDestinations } from '@/features/folders/queries';

type PathItem = { id: string; name: string };

type MoveFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId: string;
  currentFolderId: string | null;
  fileName: string;
  isMoving: boolean;
  onMove: (folderId: string | null, name?: string) => Promise<unknown>;
  onSuccess?: () => void;
};

export function MoveFileDialog({
  open,
  onOpenChange,
  dataRoomId,
  currentFolderId,
  fileName,
  isMoving,
  onMove,
  onSuccess,
}: MoveFileDialogProps) {
  const [path, setPath] = useState<PathItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const parentId = path.at(-1)?.id ?? null;
  const foldersQuery = useFolderDestinations(dataRoomId, parentId, open);
  const folders =
    foldersQuery.data?.pages.flatMap((page) => page.data) ?? [];

  function handleOpenChange(nextOpen: boolean) {
    if (isMoving) return;
    if (nextOpen) {
      setPath([]);
      setErrorMessage(null);
      setSuggestedName(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleMove() {
    setErrorMessage(null);

    try {
      await onMove(parentId, suggestedName ?? undefined);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NAME_CONFLICT') {
        const suggestion = getSuggestedName(error.details);

        if (suggestion) {
          setSuggestedName(suggestion);
          setErrorMessage(null);
          return;
        }
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Unable to move this file.',
      );
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Move file
              </Dialog.Title>
              <Dialog.Description className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                Choose a destination for “{fileName}”.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={isMoving}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 flex min-h-11 items-center gap-2 border-y border-zinc-200 py-2 dark:border-zinc-800">
            {path.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSuggestedName(null);
                  setPath((items) => items.slice(0, -1));
                }}
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Go up"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {path.length > 0
                ? `Data Room / ${path.map((item) => item.name).join(' / ')}`
                : 'Data Room root'}
            </span>
          </div>

          <div className="mt-3 h-64 overflow-y-auto rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
            {foldersQuery.isPending ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500">
                <LoaderCircle className="size-4 animate-spin" /> Loading folders…
              </div>
            ) : null}
            {foldersQuery.isError ? (
              <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400">
                Unable to load folders.
              </div>
            ) : null}
            {!foldersQuery.isPending && !foldersQuery.isError && folders.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                This location has no folders.
              </div>
            ) : null}
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  setSuggestedName(null);
                  setPath((items) => [
                    ...items,
                    { id: folder.id, name: folder.name },
                  ]);
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Folder className="size-5 text-indigo-500" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {folder.name}
                </span>
                <ChevronRight className="size-4 text-zinc-400" />
              </button>
            ))}
            {foldersQuery.hasNextPage ? (
              <button
                type="button"
                onClick={() => foldersQuery.fetchNextPage()}
                disabled={foldersQuery.isFetchingNextPage}
                className="mt-1 w-full rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              >
                {foldersQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {suggestedName ? (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <p className="font-medium">Name already in use</p>
              <p className="mt-1">
                A file named “{fileName}” already exists in this location. We
                suggested a free name below. You can edit it before moving.
              </p>
              <label className="mt-3 block text-xs font-medium" htmlFor="move-file-name">
                Move as
              </label>
              <div className="mt-1.5 flex items-center rounded-lg border border-amber-300 bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 dark:border-amber-800 dark:bg-zinc-950">
                <input
                  id="move-file-name"
                  autoFocus
                  value={suggestedName.slice(0, -4)}
                  maxLength={116}
                  onChange={(event) =>
                    setSuggestedName(`${event.target.value}.pdf`)
                  }
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none dark:text-zinc-50"
                />
                <span className="shrink-0 border-l border-amber-200 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:text-amber-300">
                  .pdf
                </span>
              </div>
              <p className="mt-2 text-xs">
                Click Move here again to confirm this name.
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isMoving}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={
                isMoving ||
                parentId === currentFolderId ||
                (suggestedName !== null &&
                  suggestedName.slice(0, -4).trim().length === 0)
              }
              onClick={handleMove}
              className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {isMoving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {isMoving ? 'Moving…' : 'Move here'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
