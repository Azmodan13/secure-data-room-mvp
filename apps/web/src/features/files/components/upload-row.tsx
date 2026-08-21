import { CircleX, FileText, RefreshCw, X } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import type { UploadQueueItem } from '../types';

type UploadRowProps = {
  item: UploadQueueItem;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
};

export function UploadRow({
  item,
  onCancel,
  onRemove,
  onRetry,
}: UploadRowProps) {
  const isActive = ['queued', 'requesting', 'uploading', 'confirming'].includes(
    item.status,
  );

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <FileText className="mt-0.5 size-5 shrink-0 text-red-500" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {item.displayName}
          </p>
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {formatBytes(String(item.file.size))}
          </span>
        </div>

        {isActive ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width] duration-150"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {statusLabel(item)}
            </p>
          </div>
        ) : null}

        {item.status === 'cancelled' ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Cancelled
          </p>
        ) : null}

        {item.destinationName ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Destination: {item.destinationName}
          </p>
        ) : null}

        {item.status === 'error' ? (
          <p className="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
            <CircleX className="mt-0.5 size-3.5 shrink-0" />
            {item.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isActive ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label={`Cancel ${item.displayName}`}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" />
          </button>
        ) : null}

        {!isActive && item.retryable ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label={`Retry ${item.displayName}`}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <RefreshCw className="size-4" />
          </button>
        ) : null}

        {!isActive ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.displayName} from the list`}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(item: UploadQueueItem): string {
  switch (item.status) {
    case 'queued':
      return 'Queued';
    case 'requesting':
      return 'Preparing secure upload…';
    case 'uploading':
      return `Uploading ${item.progress}%`;
    case 'confirming':
      return 'Verifying PDF…';
    default:
      return '';
  }
}
