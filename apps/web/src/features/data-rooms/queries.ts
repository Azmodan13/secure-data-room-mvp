'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getDataRoom,
  getDataRoomItems,
  getDataRooms,
  getDataRoomDeleteSummary,
} from './api';

export const dataRoomKeys = {
  all: ['data-rooms'] as const,
  lists: () => [...dataRoomKeys.all, 'list'] as const,
  list: () => [...dataRoomKeys.lists(), { scope: 'owned' }] as const,
  details: () => [...dataRoomKeys.all, 'detail'] as const,
  detail: (dataRoomId: string) =>
    [...dataRoomKeys.details(), dataRoomId] as const,
  items: (dataRoomId: string, folderId: string | null) =>
    [...dataRoomKeys.detail(dataRoomId), 'items', { folderId }] as const,
};

export function useDataRooms() {
  return useInfiniteQuery({
    queryKey: dataRoomKeys.list(),
    queryFn: ({ pageParam }) => getDataRooms(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
  });
}

export function useDataRoom(dataRoomId: string) {
  return useQuery({
    queryKey: dataRoomKeys.detail(dataRoomId),
    queryFn: () => getDataRoom(dataRoomId),
  });
}

export function useDataRoomItems(
  dataRoomId: string,
  folderId: string | null,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: dataRoomKeys.items(dataRoomId, folderId),
    queryFn: ({ pageParam }) =>
      getDataRoomItems(dataRoomId, folderId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled,
  });
}

export function useDataRoomDeleteSummary(dataRoomId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...dataRoomKeys.detail(dataRoomId), 'delete-summary'],
    queryFn: () => getDataRoomDeleteSummary(dataRoomId),
    enabled,
    staleTime: 0,
  });
}
