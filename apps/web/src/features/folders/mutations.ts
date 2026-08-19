'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataRoomKeys } from '@/features/data-rooms/queries';
import { createFolder, deleteFolder, renameFolder } from './api';
import { folderKeys } from './queries';

export function useCreateFolder(dataRoomId: string, parentId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      createFolder({
        dataRoomId,
        parentId,
        name,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dataRoomKeys.items(dataRoomId, parentId),
      });
    },
  });
}

export function useRenameFolder({
  dataRoomId,
  parentId,
  folderId,
}: {
  dataRoomId: string;
  parentId: string | null;
  folderId: string;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => renameFolder(folderId, name),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(dataRoomId, parentId),
        }),
        queryClient.invalidateQueries({
          queryKey: folderKeys.all,
        }),
      ]);
    },
  });
}

export function useDeleteFolder({
  dataRoomId,
  parentId,
  folderId,
}: {
  dataRoomId: string;
  parentId: string | null;
  folderId: string;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteFolder(folderId),
    onSuccess: async () => {
      queryClient.removeQueries({
        queryKey: folderKeys.breadcrumbs(folderId),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(dataRoomId, parentId),
        }),
        queryClient.invalidateQueries({
          queryKey: folderKeys.all,
        }),
      ]);
    },
  });
}
