import { apiFetch } from '@/lib/api/client';
import type {
  CreatedPublicLink,
  ShareGrant,
  ShareTarget,
  TargetShares,
  ReceivedShare,
} from './types';

export async function getTargetShares(target: ShareTarget) {
  const params = new URLSearchParams({
    targetType: target.targetType,
    targetId: target.targetId,
  });
  const response = await apiFetch<{ data: TargetShares }>(
    `/shares?${params.toString()}`,
  );
  return response.data;
}

export async function createPublicLink(target: ShareTarget) {
  const response = await apiFetch<{ data: CreatedPublicLink }>(
    '/shares/public-links',
    {
      method: 'POST',
      body: JSON.stringify({
        targetType: target.targetType,
        targetId: target.targetId,
      }),
    },
  );
  return response.data;
}

export function revokePublicLink(id: string) {
  return apiFetch<void>(`/shares/public-links/${id}`, { method: 'DELETE' });
}

export async function createShareGrant(target: ShareTarget, email: string) {
  const response = await apiFetch<{ data: ShareGrant }>('/shares/grants', {
    method: 'POST',
    body: JSON.stringify({
      targetType: target.targetType,
      targetId: target.targetId,
      email,
    }),
  });
  return response.data;
}

export function revokeShareGrant(id: string) {
  return apiFetch<void>(`/shares/grants/${id}`, { method: 'DELETE' });
}

export async function getReceivedShares() {
  const response = await apiFetch<{ data: ReceivedShare[] }>(
    '/shares/received',
  );
  return response.data;
}
