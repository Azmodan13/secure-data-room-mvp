'use client';

import { useQuery } from '@tanstack/react-query';
import { getFile, getFileViewUrl } from './api';

export const fileKeys = {
  all: ['files'] as const,
  detail: (fileId: string) => [...fileKeys.all, fileId] as const,
  viewUrl: (fileId: string) =>
    [...fileKeys.detail(fileId), 'view-url'] as const,
};

export function useFile(fileId: string) {
  return useQuery({
    queryKey: fileKeys.detail(fileId),
    queryFn: () => getFile(fileId),
  });
}

export function useFileViewUrl(fileId: string, enabled: boolean) {
  return useQuery({
    queryKey: fileKeys.viewUrl(fileId),
    queryFn: () => getFileViewUrl(fileId),
    enabled,
    staleTime: 4 * 60 * 1000,
  });
}
