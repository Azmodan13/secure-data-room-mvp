import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getOwnedPublicLinks,
  getOwnedShareGrants,
  getReceivedShares,
  getTargetShares,
} from './api';
import type { ShareTarget } from './types';

export const shareKeys = {
  all: ['shares'] as const,
  target: (target: ShareTarget) =>
    [...shareKeys.all, target.targetType, target.targetId] as const,
  received: () => [...shareKeys.all, 'received'] as const,
  publicLinks: () => [...shareKeys.all, 'public-links', 'owned'] as const,
  ownedGrants: () => [...shareKeys.all, 'grants', 'owned'] as const,
};

export function useTargetShares(target: ShareTarget, enabled: boolean) {
  return useQuery({
    queryKey: shareKeys.target(target),
    queryFn: () => getTargetShares(target),
    enabled,
  });
}

export function useOwnedShareGrants(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: shareKeys.ownedGrants(),
    queryFn: ({ pageParam }) => getOwnedShareGrants(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled,
  });
}

export function useOwnedPublicLinks(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: shareKeys.publicLinks(),
    queryFn: ({ pageParam }) => getOwnedPublicLinks(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled,
  });
}

export function useReceivedShares() {
  return useQuery({
    queryKey: shareKeys.received(),
    queryFn: getReceivedShares,
  });
}
