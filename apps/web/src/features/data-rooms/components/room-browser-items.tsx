'use client';

import { FileText, Folder, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { type DragEvent, useState } from 'react';
import { FileActions } from '@/features/files/components/file-actions';
import { useFolderUpload } from '@/features/files/components/pdf-upload';
import { FolderActions } from '@/features/folders/components/folder-actions';
import type { FileItem, FolderItem } from '../types';
import {
  formatFileSize,
  PERSISTED_FILES_DRAG_TYPE,
} from './room-browser.utils';

type ViewMode = 'table' | 'grid';

export function FileRow({
  file,
  canMutate,
  selected,
  onSelectedChange,
  viewMode,
}: {
  file: FileItem;
  canMutate: boolean;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  viewMode: ViewMode;
}) {
  if (viewMode === 'grid') {
    return (
      <div
        draggable={canMutate}
        onDragStart={(event) => {
          event.dataTransfer.setData(
            PERSISTED_FILES_DRAG_TYPE,
            JSON.stringify([file.id]),
          );
          event.dataTransfer.effectAllowed = 'move';
        }}
        className={`group relative flex h-48 min-w-0 flex-col overflow-hidden rounded-xl border p-2 transition-colors ${
          canMutate ? 'cursor-grab active:cursor-grabbing' : ''
        } ${
          selected
            ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/20 dark:border-indigo-700 dark:bg-indigo-950/30'
            : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70'
        }`}
      >
        {canMutate ? (
          <label
            className={`absolute left-3 top-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md bg-white/90 shadow-sm backdrop-blur dark:bg-zinc-900/90 ${selected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'}`}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectedChange(event.target.checked)}
              aria-label={`Select ${file.name}`}
              className="size-4 accent-indigo-600"
            />
          </label>
        ) : null}

        {canMutate ? (
          <div className="absolute right-3 top-3 z-10">
            <FileActions file={file} />
          </div>
        ) : null}

        <Link
          href={`/rooms/${file.dataRoomId}/files/${file.id}`}
          draggable={false}
          className="flex min-h-0 flex-1 flex-col rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-950/60">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
              <FileText className="size-7" />
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2 px-1 pb-1 pt-2.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p
                title={file.name}
                className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {file.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {formatFileSize(file.sizeBytes)} ·{' '}
                {new Date(file.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div
      draggable={canMutate}
      onDragStart={(event) => {
        event.dataTransfer.setData(
          PERSISTED_FILES_DRAG_TYPE,
          JSON.stringify([file.id]),
        );
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={`group relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center overflow-hidden rounded-lg transition-colors sm:grid-cols-[2rem_minmax(0,1fr)_8rem_7rem_3rem] ${
        canMutate ? 'cursor-grab active:cursor-grabbing' : ''
      } ${
        selected
          ? 'bg-indigo-50 dark:bg-indigo-950/40'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/70'
      }`}
    >
      {canMutate ? (
        <label
          className={`flex size-10 shrink-0 cursor-pointer items-center justify-center sm:ml-3 sm:size-5 ${selected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'}`}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
            aria-label={`Select ${file.name}`}
            className="size-4 accent-indigo-600"
          />
        </label>
      ) : (
        <span aria-hidden="true" />
      )}
      <Link
        href={`/rooms/${file.dataRoomId}/files/${file.id}`}
        draggable={false}
        className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 sm:px-3"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 w-full flex-1">
          <p
            title={file.name}
            className="w-full truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            {file.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500 sm:hidden dark:text-zinc-400">
            {new Date(file.createdAt).toLocaleDateString()} ·{' '}
            {formatFileSize(file.sizeBytes)}
          </p>
        </div>
      </Link>
      <span className="hidden text-sm text-zinc-500 sm:block">
        {new Date(file.createdAt).toLocaleDateString()}
      </span>
      <span className="hidden text-sm text-zinc-500 sm:block">
        {formatFileSize(file.sizeBytes)}
      </span>
      {canMutate ? (
        <div className="flex shrink-0 justify-center sm:pr-2">
          <FileActions file={file} />
        </div>
      ) : null}
    </div>
  );
}

type FolderRowProps = {
  dataRoomId: string;
  folder: FolderItem;
  onOpen: () => void;
  canMutate: boolean;
  isMoving: boolean;
  onPersistedFilesDrop: (fileIds: string[], folder: FolderItem) => void;
  viewMode: ViewMode;
};

export function FolderRow({
  dataRoomId,
  folder,
  onOpen,
  canMutate,
  isMoving,
  onPersistedFilesDrop,
  viewMode,
}: FolderRowProps) {
  const [isFileOver, setIsFileOver] = useState(false);
  const [dragOperation, setDragOperation] = useState<'move' | 'upload' | null>(
    null,
  );
  const uploadToFolder = useFolderUpload();
  const acceptsFiles = (event: DragEvent<HTMLElement>) =>
    event.dataTransfer.types.includes('Files');
  const acceptsPersistedFiles = (event: DragEvent<HTMLElement>) =>
    event.dataTransfer.types.includes(PERSISTED_FILES_DRAG_TYPE);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (
      !canMutate ||
      isMoving ||
      (!acceptsFiles(event) && !acceptsPersistedFiles(event))
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = acceptsPersistedFiles(event)
      ? 'move'
      : 'copy';
    setDragOperation(acceptsPersistedFiles(event) ? 'move' : 'upload');
    setIsFileOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    setIsFileOver(false);
    setDragOperation(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (
      !canMutate ||
      isMoving ||
      (!acceptsFiles(event) && !acceptsPersistedFiles(event))
    ) {
      return;
    }

    event.preventDefault();
    setIsFileOver(false);
    setDragOperation(null);
    const persistedFiles = event.dataTransfer.getData(
      PERSISTED_FILES_DRAG_TYPE,
    );

    if (persistedFiles) {
      try {
        const parsed = JSON.parse(persistedFiles) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every((item) => typeof item === 'string')
        ) {
          onPersistedFilesDrop(parsed, folder);
          return;
        }
      } catch {
        return;
      }
    }

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) uploadToFolder(folder.id, folder.name, files);
  }

  if (viewMode === 'grid') {
    return (
      <div
        data-folder-drop-target
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative flex h-48 min-w-0 flex-col overflow-hidden rounded-xl border p-2 transition-colors ${
          isMoving
            ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-500/20 dark:border-indigo-800 dark:bg-indigo-950/40'
            : isFileOver
              ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-950/60'
              : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70'
        }`}
      >
        {canMutate ? (
          <div className="absolute right-3 top-3 z-10">
            <FolderActions dataRoomId={dataRoomId} folder={folder} />
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpen}
          disabled={isMoving}
          aria-busy={isMoving}
          className="flex min-h-0 flex-1 flex-col rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <div className="flex min-h-0 w-full flex-1 items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-950/60">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              {isMoving ? (
                <LoaderCircle className="size-7 animate-spin" />
              ) : (
                <Folder className="size-7" />
              )}
            </div>
          </div>
          <div className="flex w-full min-w-0 items-start gap-2 px-1 pb-1 pt-2.5">
            <Folder className="mt-0.5 size-4 shrink-0 text-indigo-500" />
            <div className="min-w-0 flex-1">
              <p
                title={folder.name}
                className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {folder.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {isMoving
                  ? 'Moving files…'
                  : isFileOver
                    ? dragOperation === 'move'
                      ? 'Move here'
                      : 'Drop to upload here'
                    : `${formatFileSize(folder.sizeBytes)} · ${new Date(folder.createdAt).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      data-folder-drop-target
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center overflow-hidden rounded-lg transition-colors sm:grid-cols-[2rem_minmax(0,1fr)_8rem_7rem_3rem] ${
        isMoving
          ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900'
          : isFileOver
            ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-950/70'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/70'
      }`}
    >
      <span />
      <button
        type="button"
        onClick={onOpen}
        disabled={isMoving}
        aria-busy={isMoving}
        className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Folder className="size-5" />
        </div>
        <div className="min-w-0 w-full flex-1">
          <p
            title={folder.name}
            className="w-full truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            {folder.name}
          </p>
          {isMoving ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300">
              <LoaderCircle className="size-3.5 animate-spin" />
              Moving files…
            </p>
          ) : isFileOver ? (
            <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">
              {dragOperation === 'move' ? 'Move here' : 'Drop to upload here'}
            </p>
          ) : (
            <p className="mt-0.5 truncate text-xs text-zinc-500 sm:hidden dark:text-zinc-400">
              {new Date(folder.createdAt).toLocaleDateString()} ·{' '}
              {formatFileSize(folder.sizeBytes)}
            </p>
          )}
        </div>
      </button>
      <span className="hidden text-sm text-zinc-500 sm:block">
        {new Date(folder.createdAt).toLocaleDateString()}
      </span>
      <span className="hidden text-sm text-zinc-500 sm:block">
        {formatFileSize(folder.sizeBytes)}
      </span>
      {canMutate ? (
        <div className="flex shrink-0 justify-center sm:pr-2">
          <FolderActions dataRoomId={dataRoomId} folder={folder} />
        </div>
      ) : null}
    </div>
  );
}
