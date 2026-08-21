'use client';

import {
  FileText,
  Folder,
  HardDrive,
  LoaderCircle,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useReceivedShares } from '../queries';
import type { ReceivedShare } from '../types';

function describeShare(share: ReceivedShare) {
  if (share.dataRoom)
    return {
      name: share.dataRoom.name,
      label: 'Data Room',
      href: `/rooms/${share.dataRoom.id}`,
      icon: HardDrive,
    };
  if (share.folder)
    return {
      name: share.folder.name,
      label: 'Folder',
      href: `/shared/folders/${share.folder.id}`,
      icon: Folder,
    };
  if (share.file)
    return {
      name: share.file.name,
      label: 'PDF',
      href: `/shared/files/${share.file.id}`,
      icon: FileText,
    };
  return null;
}

export function ReceivedSharesList() {
  const query = useReceivedShares();

  if (query.isPending)
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500">
        <LoaderCircle className="size-5 animate-spin" />
        Loading shared items…
      </div>
    );
  if (query.isError)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/30">
        <p className="text-sm text-red-700 dark:text-red-300">
          Unable to load items shared with you.
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 text-sm font-medium text-red-700 underline dark:text-red-300"
        >
          Try again
        </button>
      </div>
    );

  const shares = query.data.flatMap((share) => {
    const details = describeShare(share);
    return details ? [{ share, details }] : [];
  });
  if (!shares.length)
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-700">
        <Share2 className="mx-auto size-10 text-zinc-300 dark:text-zinc-600" />
        <h2 className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
          Nothing shared with you yet
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Items shared with your account will appear here.
        </p>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {shares.map(({ share, details }) => {
          const Icon = details.icon;
          return (
            <li key={share.id}>
              <Link
                href={details.href}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {details.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {details.label} · Viewer
                  </p>
                </div>
                <span className="text-xs text-zinc-400">
                  Shared{' '}
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                  }).format(new Date(share.createdAt))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
