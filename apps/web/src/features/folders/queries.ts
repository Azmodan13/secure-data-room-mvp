'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getFolderBreadcrumbs,
  getFolderDeleteSummary,
  getFolderDestinations,
} from './api';

export const folderKeys = {
  all: ['folders'] as const,
  breadcrumbs: (folderId: string | null) =>
    [...folderKeys.all, 'breadcrumbs', folderId] as const,
  deleteSummary: (folderId: string) =>
    [...folderKeys.all, 'delete-summary', folderId] as const,
  destinations: (dataRoomId: string, parentId: string | null) =>
    [...folderKeys.all, 'destinations', dataRoomId, { parentId }] as const,
};

export function useFolderDestinations(
  dataRoomId: string,
  parentId: string | null,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: folderKeys.destinations(dataRoomId, parentId),
    queryFn: ({ pageParam }) =>
      getFolderDestinations(dataRoomId, parentId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.page.hasMore ? lastPage.page.nextCursor : undefined,
    enabled,
  });
}

export function useFolderBreadcrumbs(folderId: string | null) {
  return useQuery({
    queryKey: folderKeys.breadcrumbs(folderId),
    queryFn: () => getFolderBreadcrumbs(folderId!),
    enabled: Boolean(folderId),
  });
}

export function useFolderDeleteSummary(folderId: string, enabled: boolean) {
  return useQuery({
    queryKey: folderKeys.deleteSummary(folderId),
    queryFn: () => getFolderDeleteSummary(folderId),
    enabled,
    staleTime: 0,
  });
}
