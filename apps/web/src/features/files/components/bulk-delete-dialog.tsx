'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { formatBytes } from '@/lib/format';
import type { FileDetails } from '../types';

export function BulkDeleteDialog({
  open,
  onOpenChange,
  files,
  isDeleting,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileDetails[];
  isDeleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const totalBytes = files.reduce(
    (sum, file) => sum + Number(file.sizeBytes),
    0,
  );

  async function handleDelete() {
    setError(null);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to delete the selected files.',
      );
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Delete {files.length} files?
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {formatBytes(String(totalBytes))} will be permanently deleted.
                This action cannot be undone.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error} You can safely try again.
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button type="button" disabled={isDeleting} className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                Cancel
              </button>
            </Dialog.Close>
            <button type="button" disabled={isDeleting} onClick={handleDelete} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {isDeleting ? 'Deleting…' : 'Delete files'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
