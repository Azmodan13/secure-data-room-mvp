'use client';

import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  FileText,
  Folder,
  LoaderCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AccountActions } from '@/components/account-actions';
import { useDataRoomItems } from '@/features/data-rooms/queries';
import type { FileItem, FolderItem } from '@/features/data-rooms/types';
import { useFolder } from '@/features/folders/queries';
import { formatBytes } from '@/lib/format';

type Crumb = { id: string; name: string };

export function SharedFolderBrowser({
  rootFolderId,
}: {
  rootFolderId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const requestedFolderId = params.get('folderId');
  const currentFolderId = requestedFolderId ?? rootFolderId;
  const rootQuery = useFolder(rootFolderId);
  const currentQuery = useFolder(currentFolderId);
  const itemsQuery = useDataRoomItems(
    rootQuery.data?.dataRoomId ?? '',
    currentFolderId,
    rootQuery.isSuccess,
  );
  const [visited, setVisited] = useState<Crumb[]>([]);

  const crumbs = useMemo(() => {
    if (!rootQuery.data) return [];
    const root = { id: rootQuery.data.id, name: rootQuery.data.name };
    if (currentFolderId === rootFolderId) return [root];
    const path = visited.filter((crumb) => crumb.id !== rootFolderId);
    if (
      currentQuery.data &&
      !path.some((crumb) => crumb.id === currentQuery.data.id)
    )
      path.push({ id: currentQuery.data.id, name: currentQuery.data.name });
    return [root, ...path];
  }, [
    currentFolderId,
    currentQuery.data,
    rootFolderId,
    rootQuery.data,
    visited,
  ]);

  function openFolder(folder: FolderItem) {
    setVisited((current) => [
      ...current.filter((crumb) => crumb.id !== folder.id),
      { id: folder.id, name: folder.name },
    ]);
    router.push(`/shared/folders/${rootFolderId}?folderId=${folder.id}`);
  }

  function openCrumb(crumb: Crumb) {
    setVisited((current) =>
      current.slice(0, current.findIndex((item) => item.id === crumb.id) + 1),
    );
    router.push(
      crumb.id === rootFolderId
        ? `/shared/folders/${rootFolderId}`
        : `/shared/folders/${rootFolderId}?folderId=${crumb.id}`,
    );
  }

  if (rootQuery.isPending || currentQuery.isPending || itemsQuery.isPending)
    return (
      <Centered>
        <LoaderCircle className="size-5 animate-spin" />
        Loading shared folder…
      </Centered>
    );
  if (rootQuery.isError || currentQuery.isError || itemsQuery.isError)
    return <Unavailable />;

  const items = itemsQuery.data.pages.flatMap((page) => page.data);
  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <Link
              href="/shared"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeft className="size-4" />
              Shared with me
            </Link>
            <AccountActions />
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
              Read-only shared folder
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {rootQuery.data.name}
            </h1>
          </div>
        </header>
        <nav
          aria-label="Shared folder breadcrumb"
          className="flex min-h-14 items-center gap-1 overflow-x-auto border-b border-zinc-200 py-3 text-sm dark:border-zinc-800"
        >
          {crumbs.map((crumb, index) => {
            const current = index === crumbs.length - 1;
            return (
              <div key={crumb.id} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="size-4 text-zinc-400" />
                ) : null}
                {current ? (
                  <span className="font-medium text-zinc-950 dark:text-zinc-50">
                    {crumb.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openCrumb(crumb)}
                    className="font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400"
                  >
                    {crumb.name}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
        <section className="py-6">
          {items.length ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((item) =>
                  item.type === 'folder' ? (
                    <SharedFolderRow
                      key={item.id}
                      folder={item}
                      onOpen={() => openFolder(item)}
                    />
                  ) : (
                    <SharedFileRow key={item.id} file={item} />
                  ),
                )}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-700">
              <Folder className="mx-auto size-10 text-zinc-300" />
              <h2 className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
                This folder is empty
              </h2>
            </div>
          )}
          {itemsQuery.hasNextPage ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => void itemsQuery.fetchNextPage()}
                disabled={itemsQuery.isFetchingNextPage}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {itemsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SharedFolderRow({
  folder,
  onOpen,
}: {
  folder: FolderItem;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        <Folder className="size-5 text-indigo-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {folder.name}
        </span>
        <span className="text-xs text-zinc-400">Folder</span>
      </button>
    </li>
  );
}
function SharedFileRow({ file }: { file: FileItem }) {
  return (
    <li>
      <Link
        href={`/shared/files/${file.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        <FileText className="size-5 text-red-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {file.name}
        </span>
        <span className="text-xs text-zinc-400">
          {formatBytes(file.sizeBytes)}
        </span>
      </Link>
    </li>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        {children}
      </div>
    </main>
  );
}
function Unavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <AlertCircle className="mx-auto size-8 text-zinc-400" />
        <h1 className="mt-3 font-semibold">
          This shared item is no longer available
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          It may have been deleted or your access may have been revoked.
        </p>
        <Link
          href="/shared"
          className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Return to Shared with me
        </Link>
      </div>
    </main>
  );
}
