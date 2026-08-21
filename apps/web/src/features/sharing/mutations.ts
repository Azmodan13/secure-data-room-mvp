import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPublicLink,
  createShareGrant,
  revokePublicLink,
  revokeShareGrant,
} from './api';
import { shareKeys } from './queries';
import type { ShareTarget } from './types';

export function useCreatePublicLink(target: ShareTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createPublicLink(target),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: shareKeys.target(target) }),
  });
}

export function useRevokePublicLink(target: ShareTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokePublicLink,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shareKeys.target(target) }),
        queryClient.invalidateQueries({ queryKey: shareKeys.publicLinks() }),
      ]);
    },
  });
}

export function useRevokeOwnedPublicLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; target: ShareTarget }) =>
      revokePublicLink(id),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shareKeys.publicLinks() }),
        queryClient.invalidateQueries({
          queryKey: shareKeys.target(variables.target),
        }),
      ]);
    },
  });
}

export function useCreateShareGrant(target: ShareTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => createShareGrant(target, email),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: shareKeys.target(target) }),
  });
}

export function useRevokeShareGrant(target: ShareTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeShareGrant,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: shareKeys.target(target) }),
  });
}

export function useRevokeOwnedShareGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; target: ShareTarget }) =>
      revokeShareGrant(id),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shareKeys.ownedGrants() }),
        queryClient.invalidateQueries({
          queryKey: shareKeys.target(variables.target),
        }),
      ]);
    },
  });
}
