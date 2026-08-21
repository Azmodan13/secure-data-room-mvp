'use client';

import { AlertCircle, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BulkDeleteDialog } from '@/features/files/components/bulk-delete-dialog';
import { BulkMoveDialog } from '@/features/files/components/bulk-move-dialog';
import { PdfUpload } from '@/features/files/components/pdf-upload';
import {
  useBulkDeleteFiles,
  useBulkMoveFiles,
} from '@/features/files/mutations';
import type { BulkMoveConflict } from '@/features/files/types';
import { CreateFolderDialog } from '@/features/folders/components/create-folder-dialog';
import { useFolderBreadcrumbs } from '@/features/folders/queries';
import { ApiError } from '@/lib/api/client';
import { useDataRoom, useDataRoomItems } from '../queries';
import type {
  FileItem,
  FolderItem,
  ItemPageSize,
  ItemSortBy,
  SortOrder,
} from '../types';
import {
  BulkSelectionBar,
  PaginationControls,
  RoomItemsToolbar,
} from './room-browser-controls';
import { RoomBrowserHeader } from './room-browser-header';
import { FileRow, FolderRow } from './room-browser-items';
import { readBulkMoveConflicts } from './room-browser.utils';

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

  function resetPageState() {
    setSelectedFileIds(new Set());
    setPageIndex(0);
  }

  function changeView(next: 'table' | 'grid') {
    setViewMode(next);
    window.localStorage.setItem('data-room-view', next);
  }

  function openFolder(nextFolderId: string) {
    resetPageState();
    const params = new URLSearchParams(searchParams.toString());
    params.set('folderId', nextFolderId);
    router.push(`/rooms/${dataRoomId}?${params.toString()}`);
  }

  function returnToRoot() {
    resetPageState();
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
  const sortOrderLabel = getSortOrderLabel(sortBy, sortOrder);
  const uploadInputId = `pdf-upload-${folderId ?? `room-${dataRoomId}`}`;

  function setFileSelected(fileId: string, selected: boolean) {
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (selected) next.add(fileId);
      else next.delete(fileId);
      return next;
    });
  }

  function changeSortBy(next: ItemSortBy) {
    resetPageState();
    setSortBy(next);
  }

  function toggleSortOrder() {
    resetPageState();
    setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'));
  }

  function changePageSize(next: ItemPageSize) {
    resetPageState();
    setPageSize(next);
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

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <RoomBrowserHeader
          dataRoomId={dataRoomId}
          dataRoomName={dataRoomQuery.data.name}
          folderId={folderId}
          canMutate={canMutate}
          hasItems={items.length > 0}
          uploadInputId={uploadInputId}
          breadcrumbs={breadcrumbsQuery.data}
          breadcrumbsPending={breadcrumbsQuery.isPending}
          breadcrumbsError={breadcrumbsQuery.isError}
          onOpenFolder={openFolder}
          onReturnToRoot={returnToRoot}
        />

        <section className="relative py-6">
          {items.length > 0 ? (
            <RoomItemsToolbar
              sortBy={sortBy}
              sortOrder={sortOrder}
              sortOrderLabel={sortOrderLabel}
              viewMode={viewMode}
              onSortByChange={changeSortBy}
              onSortOrderToggle={toggleSortOrder}
              onViewModeChange={changeView}
            />
          ) : null}
          {selectedFiles.length > 0 ? (
            <BulkSelectionBar
              count={selectedFiles.length}
              onMove={() => {
                setInitialMoveDestination(null);
                setInitialMoveConflicts([]);
                setMoveOpen(true);
              }}
              onDelete={() => setDeleteOpen(true)}
              onClear={() => setSelectedFileIds(new Set())}
            />
          ) : null}

          <PdfUpload
            key={folderId ?? 'room-root'}
            dataRoomId={dataRoomId}
            folderId={folderId}
            inputId={uploadInputId}
            hasPersistedItems={items.length > 0}
            readOnly={!canMutate}
            isRefreshing={itemsQuery.isPlaceholderData}
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
                  ? 'grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
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
            <PaginationControls
              pageSize={pageSize}
              pageNumber={effectivePageIndex + 1}
              canGoPrevious={effectivePageIndex > 0}
              canGoNext={
                !itemsQuery.isFetchingNextPage &&
                (Boolean(loadedPages[effectivePageIndex + 1]) ||
                  Boolean(itemsQuery.hasNextPage))
              }
              isLoadingNext={itemsQuery.isFetchingNextPage}
              onPageSizeChange={changePageSize}
              onPrevious={() => {
                setSelectedFileIds(new Set());
                setPageIndex((value) => Math.max(0, value - 1));
              }}
              onNext={() => void showNextPage()}
            />
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

function getSortOrderLabel(sortBy: ItemSortBy, sortOrder: SortOrder) {
  if (sortBy === 'name') return sortOrder === 'asc' ? 'A–Z' : 'Z–A';
  if (sortBy === 'createdAt') {
    return sortOrder === 'asc' ? 'Oldest first' : 'Newest first';
  }
  return sortOrder === 'asc' ? 'Smallest first' : 'Largest first';
}
