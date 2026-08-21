'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DeleteDialog } from '@/components/delete-dialog';
import { RenameDialog } from '@/components/rename-dialog';
import type { FolderItem } from '@/features/data-rooms/types';
import { ShareDialog } from '@/features/sharing/components/share-dialog';
import { useDeleteFolder, useRenameFolder } from '../mutations';
import { useFolderDeleteSummary } from '../queries';

type FolderActionsProps = {
  dataRoomId: string;
  folder: FolderItem;
};

export function FolderActions({ dataRoomId, folder }: FolderActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const renameMutation = useRenameFolder({
    dataRoomId,
    parentId: folder.parentId,
    folderId: folder.id,
  });
  const deleteMutation = useDeleteFolder({
    dataRoomId,
    parentId: folder.parentId,
    folderId: folder.id,
  });
  const summaryQuery = useFolderDeleteSummary(folder.id, deleteOpen);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${folder.name}`}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-30 min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            <DropdownMenu.Item
              onSelect={() => setRenameOpen(true)}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 data-[highlighted]:text-zinc-950 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800 dark:data-[highlighted]:text-zinc-50"
            >
              <Pencil className="size-4" />
              Rename
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => setShareOpen(true)}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 data-[highlighted]:text-zinc-950 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800 dark:data-[highlighted]:text-zinc-50"
            >
              <Share2 className="size-4" />
              Share
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

            <DropdownMenu.Item
              onSelect={() => setDeleteOpen(true)}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-950/40 dark:data-[highlighted]:text-red-300"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={{
          targetType: 'folder',
          targetId: folder.id,
          name: folder.name,
        }}
      />

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        resourceLabel="Folder"
        currentName={folder.name}
        isPending={renameMutation.isPending}
        onRename={(name) => renameMutation.mutateAsync(name)}
        onSuccess={(name) => {
          toast.success(`Renamed to “${name}”.`);
        }}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        resourceLabel="Folder"
        resourceName={folder.name}
        summary={summaryQuery.data}
        isSummaryPending={summaryQuery.isPending}
        isSummaryError={summaryQuery.isError}
        onRetrySummary={() => {
          void summaryQuery.refetch();
        }}
        isDeleting={deleteMutation.isPending}
        onDelete={() => deleteMutation.mutateAsync()}
        onSuccess={() => {
          toast.success(`“${folder.name}” deleted.`);
        }}
      />
    </>
  );
}
