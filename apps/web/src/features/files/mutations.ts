'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataRoomKeys } from '@/features/data-rooms/queries';
import { folderKeys } from '@/features/folders/queries';
import {
  bulkDeleteFiles,
  bulkMoveFiles,
  deleteFile,
  moveFile,
  renameFile,
} from './api';
import { fileKeys } from './queries';

type FileLocation = {
  fileId: string;
  dataRoomId: string;
  folderId: string | null;
};

export function useRenameFile(location: FileLocation) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => renameFile(location.fileId, name),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(
            location.dataRoomId,
            location.folderId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: fileKeys.detail(location.fileId),
        }),
      ]);
    },
  });
}

export function useMoveFile(location: FileLocation) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folderId, name }: { folderId: string | null; name?: string }) =>
      moveFile(location.fileId, folderId, name),
    onSuccess: async (file) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(
            location.dataRoomId,
            location.folderId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(location.dataRoomId, file.folderId),
        }),
        queryClient.invalidateQueries({
          queryKey: fileKeys.detail(location.fileId),
        }),
        queryClient.invalidateQueries({ queryKey: folderKeys.all }),
      ]);
    },
  });
}

export function useDeleteFile(location: FileLocation) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteFile(location.fileId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: fileKeys.detail(location.fileId) });
      await queryClient.invalidateQueries({
        queryKey: dataRoomKeys.items(location.dataRoomId, location.folderId),
      });
    },
  });
}

export function useBulkMoveFiles(
  dataRoomId: string,
  sourceFolderId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      folderId,
    }: {
      files: Array<{ id: string; name?: string }>;
      folderId: string | null;
    }) => bulkMoveFiles(files, folderId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(dataRoomId, sourceFolderId),
        }),
        queryClient.invalidateQueries({
          queryKey: dataRoomKeys.items(dataRoomId, variables.folderId),
        }),
      ]);
    },
  });
}

export function useBulkDeleteFiles(
  dataRoomId: string,
  folderId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileIds: string[]) => bulkDeleteFiles(fileIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dataRoomKeys.items(dataRoomId, folderId),
      });
    },
  });
}
