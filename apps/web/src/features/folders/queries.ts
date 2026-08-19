'use client';

import { useQuery } from '@tanstack/react-query';
import { getFolderBreadcrumbs, getFolderDeleteSummary } from './api';

export const folderKeys = {
  all: ['folders'] as const,
  breadcrumbs: (folderId: string | null) =>
    [...folderKeys.all, 'breadcrumbs', folderId] as const,
  deleteSummary: (folderId: string) =>
    [...folderKeys.all, 'delete-summary', folderId] as const,
};

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
