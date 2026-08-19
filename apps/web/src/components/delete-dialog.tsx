'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import type { DeletionSummary } from '@/lib/api/types';
import { formatBytes } from '@/lib/format';
import { ApiError } from '@/lib/api/client';

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceLabel: string;
  resourceName: string;
  summary: DeletionSummary | undefined;
  isSummaryPending: boolean;
  isSummaryError: boolean;
  onRetrySummary: () => void;
  isDeleting: boolean;
  onDelete: () => Promise<unknown>;
  onSuccess?: () => void;
};

export function DeleteDialog({
  open,
  onOpenChange,
  resourceLabel,
  resourceName,
  summary,
  isSummaryPending,
  isSummaryError,
  onRetrySummary,
  isDeleting,
  onDelete,
  onSuccess,
}: DeleteDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (isDeleting) {
      return;
    }

    setErrorMessage(null);
    onOpenChange(nextOpen);
  }

  async function handleDelete() {
    setErrorMessage(null);

    try {
      await onDelete();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : `Unable to delete this ${resourceLabel.toLowerCase()}.`,
      );
    }
  }

  const canDelete =
    Boolean(summary) && !isSummaryPending && !isSummaryError && !isDeleting;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />

        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                <AlertTriangle className="size-5" />
              </div>

              <div>
                <Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  Delete {resourceLabel}?
                </Dialog.Title>

                <Dialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  “{resourceName}” and all nested content will be permanently
                  deleted.
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={isDeleting}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6">
            {isSummaryPending ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <LoaderCircle className="size-4 animate-spin" />
                Calculating affected content…
              </div>
            ) : null}

            {isSummaryError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/60 dark:bg-red-950/30">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Unable to calculate what will be deleted.
                </p>

                <button
                  type="button"
                  onClick={onRetrySummary}
                  className="mt-3 text-sm font-medium text-red-700 underline underline-offset-4 dark:text-red-300"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {summary ? (
              <dl className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                    Folders
                  </dt>
                  <dd className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">
                    {summary.folderCount}
                  </dd>
                </div>

                <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                    Files
                  </dt>
                  <dd className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">
                    {summary.fileCount}
                  </dd>
                </div>

                <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                    Total size
                  </dt>
                  <dd className="mt-1 font-semibold text-zinc-950 dark:text-zinc-50">
                    {formatBytes(summary.totalBytes)}
                  </dd>
                </div>
              </dl>
            ) : null}

            <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-300">
              This action cannot be undone.
            </p>

            {errorMessage ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isDeleting}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </Dialog.Close>

            <button
              type="button"
              disabled={!canDelete}
              onClick={handleDelete}
              className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : null}

              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
