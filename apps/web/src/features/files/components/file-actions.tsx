'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  FolderInput,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RenameDialog } from '@/components/rename-dialog';
import { ShareDialog } from '@/features/sharing/components/share-dialog';
import type { FileDetails } from '../types';
import { useDeleteFile, useMoveFile, useRenameFile } from '../mutations';
import { DeleteFileDialog } from './delete-file-dialog';
import { MoveFileDialog } from './move-file-dialog';

type FileActionsProps = {
  file: FileDetails;
  onDeleted?: () => void;
};

export function FileActions({ file, onDeleted }: FileActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const location = {
    fileId: file.id,
    dataRoomId: file.dataRoomId,
    folderId: file.folderId,
  };
  const renameMutation = useRenameFile(location);
  const moveMutation = useMoveFile(location);
  const deleteMutation = useDeleteFile(location);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${file.name}`}
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
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              <Pencil className="size-4" /> Rename
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setMoveOpen(true)}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              <FolderInput className="size-4" /> Move
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setShareOpen(true)}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-200 dark:data-[highlighted]:bg-zinc-800"
            >
              <Share2 className="size-4" /> Share
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            <DropdownMenu.Item
              onSelect={() => setDeleteOpen(true)}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-950/40"
            >
              <Trash2 className="size-4" /> Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={{ targetType: 'file', targetId: file.id, name: file.name }}
      />

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        resourceLabel="File"
        currentName={file.name}
        fixedSuffix=".pdf"
        isPending={renameMutation.isPending}
        onRename={async (name) => {
          const renamed = await renameMutation.mutateAsync(name);
          toast.success(`Renamed to “${renamed.name}”.`);
        }}
      />
      <MoveFileDialog
        key={moveOpen ? 'open' : 'closed'}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        dataRoomId={file.dataRoomId}
        currentFolderId={file.folderId}
        fileName={file.name}
        isMoving={moveMutation.isPending}
        onMove={async (folderId, name) => {
          const moved = await moveMutation.mutateAsync({ folderId, name });
          toast.success(`“${moved.name}” moved.`);
        }}
      />
      <DeleteFileDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        fileName={file.name}
        isDeleting={deleteMutation.isPending}
        onDelete={() => deleteMutation.mutateAsync()}
        onSuccess={() => {
          toast.success(`“${file.name}” deleted.`);
          onDeleted?.();
        }}
      />
    </>
  );
}
