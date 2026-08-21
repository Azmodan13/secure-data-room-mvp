'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getPublicFolder,
  getPublicItems,
  getPublicRoot,
  getPublicViewUrl,
} from './public-api';

const keys = {
  root: (token: string) => ['public-share', token] as const,
  items: (token: string, folderId?: string) =>
    ['public-share', token, 'items', folderId] as const,
  folder: (token: string, folderId: string) =>
    ['public-share', token, 'folder', folderId] as const,
  view: (token: string, fileId: string) =>
    ['public-share', token, 'file', fileId] as const,
};
export function usePublicRoot(token: string) {
  return useQuery({
    queryKey: keys.root(token),
    queryFn: () => getPublicRoot(token),
    retry: false,
  });
}
export function usePublicItems(
  token: string,
  folderId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: keys.items(token, folderId),
    queryFn: () => getPublicItems(token, folderId),
    enabled,
    retry: false,
  });
}
export function usePublicFolder(token: string, folderId: string | undefined) {
  return useQuery({
    queryKey: keys.folder(token, folderId ?? ''),
    queryFn: () => getPublicFolder(token, folderId!),
    enabled: Boolean(folderId),
    retry: false,
  });
}
export function usePublicViewUrl(
  token: string,
  fileId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: keys.view(token, fileId),
    queryFn: () => getPublicViewUrl(token, fileId),
    enabled,
    retry: false,
    staleTime: 4 * 60 * 1000,
  });
}
