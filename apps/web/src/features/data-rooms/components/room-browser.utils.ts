import type { BulkMoveConflict } from '@/features/files/types';

export const PERSISTED_FILES_DRAG_TYPE = 'application/x-data-room-files';

export function readBulkMoveConflicts(
  details: unknown,
): BulkMoveConflict[] | null {
  if (!details || typeof details !== 'object' || !('conflicts' in details)) {
    return null;
  }

  const conflicts = details.conflicts;
  if (!Array.isArray(conflicts)) return null;

  return conflicts.filter(
    (item): item is BulkMoveConflict =>
      typeof item === 'object' &&
      item !== null &&
      'fileId' in item &&
      typeof item.fileId === 'string' &&
      'currentName' in item &&
      typeof item.currentName === 'string' &&
      'suggestedName' in item &&
      typeof item.suggestedName === 'string',
  );
}

export function formatFileSize(sizeBytes: string): string {
  const bytes = Number(sizeBytes);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
