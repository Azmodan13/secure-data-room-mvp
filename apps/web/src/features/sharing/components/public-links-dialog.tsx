'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  ExternalLink,
  Link2,
  LoaderCircle,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import {
  useRevokeOwnedPublicLink,
  useRevokeOwnedShareGrant,
} from '../mutations';
import { useOwnedPublicLinks, useOwnedShareGrants } from '../queries';
import type { OwnedPublicLink, OwnedShareGrant, ShareTarget } from '../types';

type AccessItem = OwnedPublicLink | OwnedShareGrant;

function targetHref(link: AccessItem) {
  if (link.targetType === 'dataRoom') return `/rooms/${link.dataRoom.id}`;
  if (link.targetType === 'folder')
    return `/rooms/${link.dataRoom.id}?folderId=${link.targetId}`;
  return `/rooms/${link.dataRoom.id}/files/${link.targetId}`;
}

function targetLabel(type: OwnedPublicLink['targetType']) {
  return type === 'dataRoom'
    ? 'Data Room'
    : type === 'folder'
      ? 'Folder'
      : 'PDF';
}

export function PublicLinksDialog() {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tab, setTab] = useState<'public' | 'people'>('public');
  const publicQuery = useOwnedPublicLinks(open && tab === 'public');
  const grantsQuery = useOwnedShareGrants(open && tab === 'people');
  const query = tab === 'public' ? publicQuery : grantsQuery;
  const revokePublic = useRevokeOwnedPublicLink();
  const revokeGrant = useRevokeOwnedShareGrant();
  const revokePending = revokePublic.isPending || revokeGrant.isPending;
  const links: AccessItem[] =
    tab === 'public'
      ? (publicQuery.data?.pages.flatMap((page) => page.items) ?? [])
      : (grantsQuery.data?.pages.flatMap((page) => page.items) ?? []);
  const groups = links.reduce<
    Array<{ roomId: string; roomName: string; items: AccessItem[] }>
  >((result, link) => {
    const group = result.find((item) => item.roomId === link.dataRoom.id);
    if (group) group.items.push(link);
    else
      result.push({
        roomId: link.dataRoom.id,
        roomName: link.dataRoom.name,
        items: [link],
      });
    return result;
  }, []);

  async function handleRevoke(link: AccessItem) {
    const target: ShareTarget = {
      targetType: link.targetType,
      targetId: link.targetId,
      name: link.targetName,
    };
    try {
      if (tab === 'public')
        await revokePublic.mutateAsync({ id: link.id, target });
      else await revokeGrant.mutateAsync({ id: link.id, target });
      setConfirmId(null);
      toast.success(
        tab === 'public' ? 'Public link revoked.' : 'User access revoked.',
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Unable to revoke the link.',
      );
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setConfirmId(null);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Link2 className="size-4" />
          <span className="hidden sm:inline">Manage access</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] max-w-2xl -translate-y-1/2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
            <div>
              <Dialog.Title className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Manage access
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Review anonymous links and access granted to people.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="grid grid-cols-2 gap-1 border-b border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => {
                setTab('public');
                setConfirmId(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium ${tab === 'public' ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-zinc-500'}`}
            >
              <Link2 className="mr-2 inline size-4" />
              Public links
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('people');
                setConfirmId(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium ${tab === 'people' ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-zinc-500'}`}
            >
              <Users className="mr-2 inline size-4" />
              People
            </button>
          </div>
          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto p-5">
            {query.isPending ? (
              <div className="flex justify-center gap-2 py-12 text-sm text-zinc-500">
                <LoaderCircle className="size-4 animate-spin" />
                Loading access…
              </div>
            ) : null}
            {query.isError ? (
              <div className="py-10 text-center">
                <p className="text-sm text-red-600">Unable to load access.</p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="mt-3 text-sm font-medium underline"
                >
                  Try again
                </button>
              </div>
            ) : null}
            {!query.isPending && !query.isError && links.length === 0 ? (
              <div className="py-12 text-center">
                <Link2 className="mx-auto size-9 text-zinc-300 dark:text-zinc-600" />
                <p className="mt-3 font-medium text-zinc-900 dark:text-zinc-100">
                  {tab === 'public'
                    ? 'No active public links'
                    : 'No shared access'}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {tab === 'public'
                    ? 'Links created from Share dialogs will appear here.'
                    : 'People you share content with will appear here.'}
                </p>
              </div>
            ) : null}
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.roomId}>
                  <h3 className="mb-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {group.roomName}
                  </h3>
                  <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {group.items.map((link) => (
                      <li
                        key={link.id}
                        className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {targetLabel(link.targetType)}
                            </span>
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {link.targetName}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {'recipientEmail' in link
                              ? `${link.recipientEmail} · `
                              : ''}
                            Created{' '}
                            {new Date(link.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex min-h-11 items-center justify-end gap-2">
                          {confirmId === link.id ? (
                            <>
                              <button
                                type="button"
                                disabled={revokePending}
                                onClick={() => setConfirmId(null)}
                                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={revokePending}
                                onClick={() => handleRevoke(link)}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                              >
                                {revokePending ? (
                                  <LoaderCircle className="size-4 animate-spin" />
                                ) : null}
                                Confirm revoke
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={targetHref(link)}
                                onClick={() => setOpen(false)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
                              >
                                <ExternalLink className="size-4" />
                                Open
                              </Link>
                              <button
                                type="button"
                                onClick={() => setConfirmId(link.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="size-4" />
                                Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {query.hasNextPage ? (
              <button
                type="button"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
                className="mt-5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
