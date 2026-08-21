'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Folder,
  LoaderCircle,
  Upload,
  FolderInput,
  Trash2,
  X,
  LayoutGrid,
  List,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type DragEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useDataRoom, useDataRoomItems } from '../queries';
import type {
  FileItem,
  FolderItem,
  ItemPageSize,
  ItemSortBy,
  SortOrder,
} from '../types';
import { CreateFolderDialog } from '@/features/folders/components/create-folder-dialog';
import { useFolderBreadcrumbs } from '@/features/folders/queries';
import { FolderActions } from '@/features/folders/components/folder-actions';
import { PdfUpload } from '@/features/files/components/pdf-upload';
import { AccountActions } from '@/components/account-actions';
import { useFolderUpload } from '@/features/files/components/pdf-upload';
import { FileActions } from '@/features/files/components/file-actions';
import { BulkMoveDialog } from '@/features/files/components/bulk-move-dialog';
import { BulkDeleteDialog } from '@/features/files/components/bulk-delete-dialog';
import {
  useBulkDeleteFiles,
  useBulkMoveFiles,
} from '@/features/files/mutations';
import type { BulkMoveConflict } from '@/features/files/types';

const PERSISTED_FILES_DRAG_TYPE = 'application/x-data-room-files';

function readBulkMoveConflicts(details: unknown): BulkMoveConflict[] | null {
  if (!details || typeof details !== 'object' || !('conflicts' in details)) {
    return null;
  }

  const conflicts = details.conflicts;

  if (!Array.isArray(conflicts)) return null;

  return conflicts.filter(
    (item): item is BulkMoveConflict =>
      typeof item === 'object' &&
      item !== null &&
      'fileId' in item &&
      typeof item.fileId === 'string' &&
      'currentName' in item &&
      typeof item.currentName === 'string' &&
      'suggestedName' in item &&
      typeof item.suggestedName === 'string',
  );
}

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

function SortFieldMenu({
  value,
  onChange,
}: {
  value: ItemSortBy;
  onChange: (value: ItemSortBy) => void;
}) {
  const labels: Record<ItemSortBy, string> = {
    name: 'Name',
    createdAt: 'Created',
    size: 'Size',
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 min-w-32 items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {labels[value]}
          <ChevronDown className="size-4 text-zinc-500" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {(Object.keys(labels) as ItemSortBy[]).map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onChange(option)}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              {labels[option]}
              {option === value ? (
                <Check className="size-4 text-indigo-600" />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function PageSizeMenu({
  value,
  onChange,
}: {
  value: ItemPageSize;
  onChange: (value: ItemPageSize) => void;
}) {
  const options: ItemPageSize[] = [10, 25, 50];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {value} per page
          <ChevronDown className="size-4 text-zinc-500" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onChange(option)}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              {option} items
              {option === value ? (
                <Check className="size-4 text-indigo-600" />
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function FileRow({
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
  viewMode: 'table' | 'grid';
}) {
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
      className={`group relative min-w-0 overflow-hidden ${viewMode === 'grid' ? 'flex min-h-36 flex-col border border-zinc-200 p-2 dark:border-zinc-800' : 'flex sm:grid sm:grid-cols-[2rem_minmax(0,1fr)_8rem_7rem_3rem] sm:items-center'} rounded-lg transition-colors ${
        canMutate ? 'cursor-grab active:cursor-grabbing' : ''
      } ${
        selected
          ? 'bg-indigo-50 dark:bg-indigo-950/40'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/70'
      }`}
    >
      {canMutate ? (
        <label
          className={`ml-2 flex size-10 shrink-0 cursor-pointer items-center justify-center sm:ml-3 sm:size-5 ${selected ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'}`}
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
      <Link
        href={`/rooms/${file.dataRoomId}/files/${file.id}`}
        draggable={false}
        className={`${viewMode === 'grid' ? 'flex w-full min-w-0 flex-1 flex-col items-start' : 'flex min-w-0 items-center gap-3'} rounded-lg px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40`}
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
          {viewMode === 'grid' ? (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {formatFileSize(file.sizeBytes)}
            </p>
          ) : null}
        </div>
      </Link>
      {viewMode === 'table' ? (
        <span className="hidden text-sm text-zinc-500 sm:block">
          {new Date(file.createdAt).toLocaleDateString()}
        </span>
      ) : null}
      {viewMode === 'table' ? (
        <span className="hidden text-sm text-zinc-500 sm:block">
          {formatFileSize(file.sizeBytes)}
        </span>
      ) : null}
      {canMutate ? (
        <div
          className={
            viewMode === 'grid' ? 'absolute right-2 top-2' : 'shrink-0 pr-2'
          }
        >
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
  viewMode: 'table' | 'grid';
};

function FolderRow({
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

  function acceptsFiles(event: DragEvent<HTMLElement>): boolean {
    return event.dataTransfer.types.includes('Files');
  }

  function acceptsPersistedFiles(event: DragEvent<HTMLElement>): boolean {
    return event.dataTransfer.types.includes(PERSISTED_FILES_DRAG_TYPE);
  }

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
      className={`relative min-w-0 overflow-hidden ${viewMode === 'grid' ? 'flex min-h-36 flex-col border border-zinc-200 p-2 dark:border-zinc-800' : 'flex sm:grid sm:grid-cols-[2rem_minmax(0,1fr)_8rem_7rem_3rem] sm:items-center'} rounded-lg transition-colors ${
        isMoving
          ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900'
          : isFileOver
            ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-950/70'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/70'
      }`}
    >
      {viewMode === 'table' ? <span className="hidden sm:block" /> : null}
      <button
        type="button"
        onClick={onOpen}
        disabled={isMoving}
        aria-busy={isMoving}
        className={`${viewMode === 'grid' ? 'flex w-full min-w-0 flex-1 flex-col items-start' : 'flex min-w-0 items-center gap-3'} rounded-lg px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40`}
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
          ) : viewMode === 'grid' ? (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {formatFileSize(folder.sizeBytes)}
            </p>
          ) : null}
        </div>
      </button>
      {viewMode === 'table' ? (
        <span className="hidden text-sm text-zinc-500 sm:block">
          {new Date(folder.createdAt).toLocaleDateString()}
        </span>
      ) : null}
      {viewMode === 'table' ? (
        <span className="hidden text-sm text-zinc-500 sm:block">
          {formatFileSize(folder.sizeBytes)}
        </span>
      ) : null}

      {canMutate ? (
        <div
          className={
            viewMode === 'grid' ? 'absolute right-2 top-2' : 'shrink-0 pr-2'
          }
        >
          <FolderActions dataRoomId={dataRoomId} folder={folder} />
        </div>
      ) : null}
    </div>
  );
}

export function RoomBrowser({
  dataRoomId,
  currentUserId,
}: {
  dataRoomId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folderId');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movingToFolderId, setMovingToFolderId] = useState<string | null>(null);
  const [initialMoveDestination, setInitialMoveDestination] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [initialMoveConflicts, setInitialMoveConflicts] = useState<
    BulkMoveConflict[]
  >([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<ItemSortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [pageSize, setPageSize] = useState<ItemPageSize>(25);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem('data-room-view');
    if (saved !== 'table' && saved !== 'grid') return;
    const timer = window.setTimeout(() => setViewMode(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function changeView(next: 'table' | 'grid') {
    setViewMode(next);
    window.localStorage.setItem('data-room-view', next);
  }

  const dataRoomQuery = useDataRoom(dataRoomId);
  const itemsQuery = useDataRoomItems(
    dataRoomId,
    folderId,
    true,
    sortBy,
    sortOrder,
    pageSize,
  );
  const breadcrumbsQuery = useFolderBreadcrumbs(folderId);
  const bulkMoveMutation = useBulkMoveFiles(dataRoomId, folderId);
  const bulkDeleteMutation = useBulkDeleteFiles(dataRoomId, folderId);
  const sortOrderLabel =
    sortBy === 'name'
      ? sortOrder === 'asc'
        ? 'A–Z'
        : 'Z–A'
      : sortBy === 'createdAt'
        ? sortOrder === 'asc'
          ? 'Oldest first'
          : 'Newest first'
        : sortOrder === 'asc'
          ? 'Smallest first'
          : 'Largest first';

  function openFolder(nextFolderId: string) {
    setSelectedFileIds(new Set());
    setPageIndex(0);
    const params = new URLSearchParams(searchParams.toString());
    params.set('folderId', nextFolderId);

    router.push(`/rooms/${dataRoomId}?${params.toString()}`);
  }

  function returnToRoot() {
    setSelectedFileIds(new Set());
    setPageIndex(0);
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

  const loadedPages = itemsQuery.data.pages;
  const effectivePageIndex = loadedPages[pageIndex] ? pageIndex : 0;
  const currentPage = loadedPages[effectivePageIndex];
  const items = currentPage?.data ?? [];
  const canMutate = dataRoomQuery.data.ownerId === currentUserId;
  const selectedFiles = items.filter(
    (item): item is FileItem =>
      item.type === 'file' && selectedFileIds.has(item.id),
  );

  function setFileSelected(fileId: string, selected: boolean) {
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (selected) next.add(fileId);
      else next.delete(fileId);
      return next;
    });
  }

  function changeSortBy(next: ItemSortBy) {
    setSelectedFileIds(new Set());
    setPageIndex(0);
    setSortBy(next);
  }

  function toggleSortOrder() {
    setSelectedFileIds(new Set());
    setPageIndex(0);
    setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'));
  }

  function changePageSize(next: ItemPageSize) {
    setSelectedFileIds(new Set());
    setPageIndex(0);
    setPageSize(next);
  }

  function showPreviousPage() {
    setSelectedFileIds(new Set());
    setPageIndex((value) => Math.max(0, value - 1));
  }

  async function showNextPage() {
    const nextIndex = effectivePageIndex + 1;

    if (!loadedPages[nextIndex] && itemsQuery.hasNextPage) {
      const result = await itemsQuery.fetchNextPage();
      if (!result.data?.pages[nextIndex]) return;
    }

    setSelectedFileIds(new Set());
    setPageIndex(nextIndex);
  }

  async function beginDropMove(fileIds: string[], folder: FolderItem) {
    const effectiveIds =
      selectedFileIds.has(fileIds[0] ?? '') && selectedFileIds.size > 0
        ? [...selectedFileIds]
        : fileIds;
    const filesToMove = items.filter(
      (item): item is FileItem =>
        item.type === 'file' && effectiveIds.includes(item.id),
    );

    setMovingToFolderId(folder.id);

    try {
      await bulkMoveMutation.mutateAsync({
        files: filesToMove.map((file) => ({ id: file.id })),
        folderId: folder.id,
      });
      toast.success(
        `${filesToMove.length} file${filesToMove.length === 1 ? '' : 's'} moved to “${folder.name}”.`,
      );
      setSelectedFileIds(new Set());
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BULK_NAME_CONFLICT') {
        const conflicts = readBulkMoveConflicts(error.details);

        if (conflicts?.length) {
          setSelectedFileIds(new Set(effectiveIds));
          setInitialMoveDestination({ id: folder.id, name: folder.name });
          setInitialMoveConflicts(conflicts);
          setMoveOpen(true);
          return;
        }
      }

      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Unable to move the selected files.',
      );
    } finally {
      setMovingToFolderId(null);
    }
  }
  const uploadInputId = `pdf-upload-${folderId ?? `room-${dataRoomId}`}`;

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
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
                {dataRoomQuery.data.name}
              </h1>

              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Secure documents and folders
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
              {canMutate && items.length > 0 ? (
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
                <CreateFolderDialog
                  dataRoomId={dataRoomId}
                  parentId={folderId}
                />
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

        <section className="relative py-6">
          {items.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SortFieldMenu value={sortBy} onChange={changeSortBy} />
                <button
                  type="button"
                  onClick={toggleSortOrder}
                  className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700"
                  aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortOrderLabel}
                </button>
              </div>
              <div
                className="flex rounded-lg border border-zinc-300 p-1 dark:border-zinc-700"
                aria-label="View mode"
              >
                <button
                  type="button"
                  onClick={() => changeView('table')}
                  aria-pressed={viewMode === 'table'}
                  aria-label="Table view"
                  className={`rounded-md p-2 ${viewMode === 'table' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
                >
                  <List className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => changeView('grid')}
                  aria-pressed={viewMode === 'grid'}
                  aria-label="Grid view"
                  className={`rounded-md p-2 ${viewMode === 'grid' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
          {selectedFiles.length > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 sm:flex sm:flex-wrap sm:items-center dark:border-indigo-900/70 dark:bg-indigo-950/40">
              <span className="col-span-2 text-sm font-medium text-indigo-950 sm:col-span-1 sm:mr-auto dark:text-indigo-100">
                {selectedFiles.length} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  setInitialMoveDestination(null);
                  setInitialMoveConflicts([]);
                  setMoveOpen(true);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
              >
                <FolderInput className="size-4" />
                Move
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm dark:bg-zinc-900 dark:text-red-400"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileIds(new Set())}
                aria-label="Clear selection"
                className="col-span-2 min-h-11 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-white sm:col-span-1 sm:size-11 sm:p-2 dark:hover:bg-zinc-900"
              >
                <X className="mx-auto size-4" />
                <span className="ml-2 sm:sr-only">Clear selection</span>
              </button>
            </div>
          ) : null}
          <PdfUpload
            key={folderId ?? 'room-root'}
            dataRoomId={dataRoomId}
            folderId={folderId}
            inputId={uploadInputId}
            hasPersistedItems={items.length > 0}
            readOnly={!canMutate}
            isRefreshing={
              itemsQuery.isFetching && !itemsQuery.isFetchingNextPage
            }
            emptyFolderAction={
              <CreateFolderDialog
                dataRoomId={dataRoomId}
                parentId={folderId}
                variant="empty"
              />
            }
          >
            {viewMode === 'table' && items.length > 0 ? (
              <div className="hidden grid-cols-[2rem_minmax(0,1fr)_8rem_7rem_3rem] border-b border-zinc-200 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:grid dark:border-zinc-800">
                <span aria-hidden="true" />
                <span className="px-3">Name</span>
                <span>Created</span>
                <span>Size</span>
                <span className="sr-only">Actions</span>
              </div>
            ) : null}
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'
                  : 'space-y-1'
              }
            >
              {items.map((item) =>
                item.type === 'folder' ? (
                  <FolderRow
                    key={item.id}
                    dataRoomId={dataRoomId}
                    folder={item}
                    onOpen={() => openFolder(item.id)}
                    canMutate={canMutate}
                    isMoving={movingToFolderId === item.id}
                    onPersistedFilesDrop={(fileIds, folder) => {
                      void beginDropMove(fileIds, folder);
                    }}
                    viewMode={viewMode}
                  />
                ) : (
                  <FileRow
                    key={item.id}
                    file={item}
                    canMutate={canMutate}
                    selected={selectedFileIds.has(item.id)}
                    onSelectedChange={(selected) =>
                      setFileSelected(item.id, selected)
                    }
                    viewMode={viewMode}
                  />
                ),
              )}
            </div>
          </PdfUpload>

          {items.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <PageSizeMenu value={pageSize} onChange={changePageSize} />
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Page {effectivePageIndex + 1}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={effectivePageIndex === 0}
                    onClick={showPreviousPage}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      itemsQuery.isFetchingNextPage ||
                      (!loadedPages[effectivePageIndex + 1] &&
                        !itemsQuery.hasNextPage)
                    }
                    onClick={() => void showNextPage()}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {itemsQuery.isFetchingNextPage ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null}
                    Next
                    {!itemsQuery.isFetchingNextPage ? (
                      <ChevronRight className="size-4" />
                    ) : null}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
        <BulkMoveDialog
          key={`${moveOpen ? 'open' : 'closed'}-${initialMoveDestination?.id ?? 'root'}`}
          open={moveOpen}
          onOpenChange={setMoveOpen}
          dataRoomId={dataRoomId}
          sourceFolderId={folderId}
          files={selectedFiles}
          initialDestination={initialMoveDestination}
          initialConflicts={initialMoveConflicts}
          isMoving={bulkMoveMutation.isPending}
          onMove={async (files, destinationFolderId) => {
            await bulkMoveMutation.mutateAsync({
              files,
              folderId: destinationFolderId,
            });
            toast.success(
              `${files.length} file${files.length === 1 ? '' : 's'} moved.`,
            );
            setSelectedFileIds(new Set());
            setInitialMoveConflicts([]);
          }}
        />
        <BulkDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          files={selectedFiles}
          isDeleting={bulkDeleteMutation.isPending}
          onDelete={async () => {
            await bulkDeleteMutation.mutateAsync(
              selectedFiles.map((file) => file.id),
            );
            toast.success(`${selectedFiles.length} files deleted.`);
            setSelectedFileIds(new Set());
          }}
        />
      </div>
    </main>
  );
}
