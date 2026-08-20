'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ChevronRight, Folder, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { useFolderDestinations } from '@/features/folders/queries';
import type { BulkMoveConflict, FileDetails } from '../types';

type PathItem = { id: string; name: string };

function readConflicts(details: unknown): BulkMoveConflict[] | null {
  if (!details || typeof details !== 'object' || !('conflicts' in details)) return null;
  const conflicts = details.conflicts;
  if (!Array.isArray(conflicts)) return null;
  return conflicts.filter(
    (item): item is BulkMoveConflict =>
      typeof item === 'object' && item !== null &&
      'fileId' in item && typeof item.fileId === 'string' &&
      'currentName' in item && typeof item.currentName === 'string' &&
      'suggestedName' in item && typeof item.suggestedName === 'string',
  );
}

export function BulkMoveDialog({
  open,
  onOpenChange,
  dataRoomId,
  sourceFolderId,
  files,
  initialDestination,
  initialConflicts,
  isMoving,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId: string;
  sourceFolderId: string | null;
  files: FileDetails[];
  initialDestination: PathItem | null;
  initialConflicts: BulkMoveConflict[];
  isMoving: boolean;
  onMove: (files: Array<{ id: string; name?: string }>, folderId: string | null) => Promise<void>;
}) {
  const [path, setPath] = useState<PathItem[]>(
    initialDestination ? [initialDestination] : [],
  );
  const [conflicts, setConflicts] =
    useState<BulkMoveConflict[]>(initialConflicts);
  const [error, setError] = useState<string | null>(null);
  const folderId = path.at(-1)?.id ?? null;
  const foldersQuery = useFolderDestinations(dataRoomId, folderId, open);
  const folders = foldersQuery.data?.pages.flatMap((page) => page.data) ?? [];

  function resetConflict() {
    setConflicts([]);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (isMoving) return;
    if (next) {
      setPath(initialDestination ? [initialDestination] : []);
      resetConflict();
    }
    onOpenChange(next);
  }

  async function handleMove() {
    setError(null);
    try {
      const names = new Map(conflicts.map((item) => [item.fileId, item.suggestedName]));
      await onMove(
        files.map((file) => ({ id: file.id, name: names.get(file.id) })),
        folderId,
      );
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'BULK_NAME_CONFLICT') {
        const nextConflicts = readConflicts(caught.details);
        if (nextConflicts?.length) {
          setConflicts(nextConflicts);
          return;
        }
      }
      setError(caught instanceof ApiError ? caught.message : 'Unable to move the selected files.');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div><Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Move {files.length} files</Dialog.Title><Dialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Choose a destination folder.</Dialog.Description></div>
            <Dialog.Close asChild><button type="button" aria-label="Close" className="rounded-md p-1 text-zinc-500"><X className="size-5" /></button></Dialog.Close>
          </div>
          <div className="mt-5 flex min-h-11 items-center gap-2 border-y border-zinc-200 py-2 dark:border-zinc-800">
            {path.length ? <button type="button" aria-label="Go up" onClick={() => { resetConflict(); setPath((items) => items.slice(0, -1)); }} className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft className="size-4" /></button> : null}
            <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{path.length ? `Data Room / ${path.map((item) => item.name).join(' / ')}` : 'Data Room root'}</span>
          </div>
          <div className="mt-3 h-52 overflow-y-auto rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
            {foldersQuery.isPending ? <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" /> Loading folders…</div> : null}
            {!foldersQuery.isPending && folders.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-zinc-500">This location has no folders.</div> : null}
            {folders.map((folder) => <button key={folder.id} type="button" onClick={() => { resetConflict(); setPath((items) => [...items, { id: folder.id, name: folder.name }]); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"><Folder className="size-5 text-indigo-500" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span><ChevronRight className="size-4 text-zinc-400" /></button>)}
          </div>
          {conflicts.length ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{conflicts.length} naming conflict{conflicts.length === 1 ? '' : 's'}</p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Edit the proposed names, then confirm again.</p>
              <div className="mt-3 space-y-2">
                {conflicts.map((conflict, index) => <div key={conflict.fileId}><p className="truncate text-xs text-amber-800 dark:text-amber-300">{conflict.currentName}</p><div className="mt-1 flex rounded-md border border-amber-300 bg-white dark:border-amber-800 dark:bg-zinc-950"><input value={conflict.suggestedName.slice(0, -4)} maxLength={116} onChange={(event) => setConflicts((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, suggestedName: `${event.target.value}.pdf` } : item))} className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm outline-none" /><span className="border-l border-amber-200 px-2.5 py-2 text-sm text-amber-700 dark:border-amber-900 dark:text-amber-300">.pdf</span></div></div>)}
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-3"><Dialog.Close asChild><button type="button" disabled={isMoving} className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium dark:border-zinc-700">Cancel</button></Dialog.Close><button type="button" disabled={isMoving || folderId === sourceFolderId || conflicts.some((item) => item.suggestedName.slice(0, -4).trim().length === 0)} onClick={handleMove} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950">{isMoving ? <LoaderCircle className="size-4 animate-spin" /> : null}{isMoving ? 'Moving…' : 'Move files'}</button></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
