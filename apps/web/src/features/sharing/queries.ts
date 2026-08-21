import { useQuery } from '@tanstack/react-query';
import { getReceivedShares, getTargetShares } from './api';
import type { ShareTarget } from './types';

export const shareKeys = {
  all: ['shares'] as const,
  target: (target: ShareTarget) =>
    [...shareKeys.all, target.targetType, target.targetId] as const,
  received: () => [...shareKeys.all, 'received'] as const,
};

export function useTargetShares(target: ShareTarget, enabled: boolean) {
  return useQuery({
    queryKey: shareKeys.target(target),
    queryFn: () => getTargetShares(target),
    enabled,
  });
}

export function useReceivedShares() {
  return useQuery({
    queryKey: shareKeys.received(),
    queryFn: getReceivedShares,
  });
}
