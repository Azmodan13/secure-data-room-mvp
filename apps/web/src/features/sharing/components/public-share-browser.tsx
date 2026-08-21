'use client';

import {
  AlertCircle,
  ChevronRight,
  FileText,
  Folder,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { FileItem, FolderItem } from '@/features/data-rooms/types';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { formatBytes } from '@/lib/format';
import {
  usePublicFolder,
  usePublicItems,
  usePublicRoot,
  usePublicViewUrl,
} from '../public-queries';

export function PublicShareBrowser({
  token,
  directFileId,
}: {
  token: string;
  directFileId?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const rootQuery = usePublicRoot(token);
  const folderId = params.get('folderId') ?? undefined;
  const currentFolderQuery = usePublicFolder(token, folderId);
  const [visited, setVisited] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const root = rootQuery.data;
  const fileId = directFileId ?? (root?.type === 'file' ? root.id : undefined);
  const itemsQuery = usePublicItems(
    token,
    folderId,
    Boolean(root && root.type !== 'file' && !fileId),
  );

  if (rootQuery.isPending) return <PublicLoading />;
  if (rootQuery.isError || !root) return <PublicUnavailable />;
  if (fileId)
    return (
      <PublicFile
        token={token}
        fileId={fileId}
        name={
          root.type === 'file' && root.id === fileId ? root.name : undefined
        }
      />
    );
  if (itemsQuery.isPending || (folderId && currentFolderQuery.isPending))
    return <PublicLoading />;
  if (itemsQuery.isError || currentFolderQuery.isError)
    return <PublicUnavailable />;

  const rootId = root.id;
  const rootCrumb = { id: root.id, name: root.name };
  const current = currentFolderQuery.data
    ? { id: currentFolderQuery.data.id, name: currentFolderQuery.data.name }
    : null;
  const crumbs = [
    rootCrumb,
    ...visited.filter((crumb) => crumb.id !== root.id),
  ];
  if (current && !crumbs.some((crumb) => crumb.id === current.id))
    crumbs.push(current);

  function openFolder(folder: FolderItem) {
    setVisited((value) => [
      ...value.filter((item) => item.id !== folder.id),
      { id: folder.id, name: folder.name },
    ]);
    router.push(`/share/${token}?folderId=${folder.id}`);
  }
  function openCrumb(id: string) {
    if (id === rootId) {
      setVisited([]);
      router.push(`/share/${token}`);
    } else {
      setVisited((value) =>
        value.slice(0, value.findIndex((item) => item.id === id) + 1),
      );
      router.push(`/share/${token}?folderId=${id}`);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <PublicHeader title={root.name} />
        <nav
          aria-label="Shared content breadcrumb"
          className="flex min-h-14 items-center gap-1 overflow-x-auto border-b border-zinc-200 py-3 text-sm dark:border-zinc-800"
        >
          {crumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1">
              {index ? <ChevronRight className="size-4 text-zinc-400" /> : null}
              {index === crumbs.length - 1 ? (
                <span className="font-medium">{crumb.name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => openCrumb(crumb.id)}
                  className="font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400"
                >
                  {crumb.name}
                </button>
              )}
            </div>
          ))}
        </nav>
        <section className="py-6">
          {itemsQuery.data?.items.length ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {itemsQuery.data.items.map((item) =>
                  item.type === 'folder' ? (
                    <PublicFolderRow
                      key={item.id}
                      folder={item}
                      onOpen={() => openFolder(item)}
                    />
                  ) : (
                    <PublicFileRow key={item.id} token={token} file={item} />
                  ),
                )}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-700">
              <Folder className="mx-auto size-10 text-zinc-300" />
              <h2 className="mt-4 font-semibold">
                This shared folder is empty
              </h2>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PublicFile({
  token,
  fileId,
  name,
}: {
  token: string;
  fileId: string;
  name?: string;
}) {
  const query = usePublicViewUrl(token, fileId);
  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        <PublicHeader title={name ?? 'Shared PDF'} />
        <section className="relative mt-6 min-h-[75vh] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {query.isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoaderCircle className="size-5 animate-spin" />
            </div>
          ) : query.isError ? (
            <PublicUnavailable embedded />
          ) : query.data ? (
            <iframe
              src={query.data.url}
              title={name ?? 'Shared PDF'}
              className="h-[80vh] w-full"
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
function PublicHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
          <ShieldCheck className="size-4" />
          Read-only public share
        </p>
        <h1 className="mt-1 truncate text-3xl font-semibold">{title}</h1>
      </div>
      <ThemeSwitcher />
    </header>
  );
}
function PublicFolderRow({
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
function PublicFileRow({ token, file }: { token: string; file: FileItem }) {
  return (
    <li>
      <Link
        href={`/share/${token}/files/${file.id}`}
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
function PublicLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <LoaderCircle className="size-5 animate-spin" />
        Opening shared item…
      </div>
    </main>
  );
}
function PublicUnavailable({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <div className="text-center">
      <AlertCircle className="mx-auto size-8 text-zinc-400" />
      <h1 className="mt-3 font-semibold">
        This shared item is no longer available
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        The link may be invalid, expired, revoked, or deleted.
      </p>
    </div>
  );
  return embedded ? (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      {content}
    </div>
  ) : (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      {content}
    </main>
  );
}
