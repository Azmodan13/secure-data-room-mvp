'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDataRoom, deleteDataRoom, renameDataRoom } from './api';
import { dataRoomKeys } from './queries';

export function useCreateDataRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDataRoom,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dataRoomKeys.lists(),
      });
    },
  });
}

export function useRenameDataRoom(dataRoomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => renameDataRoom(dataRoomId, name),
    onSuccess: async (dataRoom) => {
      queryClient.setQueryData(dataRoomKeys.detail(dataRoomId), dataRoom);

      await queryClient.invalidateQueries({
        queryKey: dataRoomKeys.lists(),
      });
    },
  });
}

export function useDeleteDataRoom(dataRoomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteDataRoom(dataRoomId),
    onSuccess: async () => {
      queryClient.removeQueries({
        queryKey: dataRoomKeys.detail(dataRoomId),
      });

      await queryClient.invalidateQueries({
        queryKey: dataRoomKeys.lists(),
      });
    },
  });
}
