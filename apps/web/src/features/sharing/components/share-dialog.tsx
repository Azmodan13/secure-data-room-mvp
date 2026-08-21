'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import {
  useCreatePublicLink,
  useCreateShareGrant,
  useRevokePublicLink,
  useRevokeShareGrant,
} from '../mutations';
import { useTargetShares } from '../queries';
import type { ShareTarget } from '../types';

type Tab = 'people' | 'link';

export function ShareDialog({
  target,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  target: ShareTarget;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [tab, setTab] = useState<Tab>('people');
  const [email, setEmail] = useState('');
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shares = useTargetShares(target, open);
  const createGrant = useCreateShareGrant(target);
  const revokeGrant = useRevokeShareGrant(target);
  const createLink = useCreatePublicLink(target);
  const revokeLink = useRevokePublicLink(target);

  function handleOpenChange(nextOpen: boolean) {
    if (busy) return;
    if (!nextOpen) {
      setEmail('');
      setPublicUrl(null);
      setCopied(false);
    }
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  async function handleGrant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createGrant.mutateAsync(email);
      setEmail('');
      toast.success('Read-only access granted.');
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Unable to share with this person.',
      );
    }
  }

  async function handleCreateLink() {
    try {
      const link = await createLink.mutateAsync();
      setPublicUrl(`${window.location.origin}/share/${link.token}`);
      setCopied(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Unable to create a public link.',
      );
    }
  }

  async function handleCopy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Public link copied.');
  }

  const activeLink = shares.data?.publicLinks[0];
  const busy =
    createGrant.isPending ||
    revokeGrant.isPending ||
    createLink.isPending ||
    revokeLink.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                Share “{target.name}”
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Viewers can open and download shared PDFs, but cannot make
                changes.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            <TabButton
              active={tab === 'people'}
              onClick={() => setTab('people')}
              icon={<Users className="size-4" />}
              label="People"
            />
            <TabButton
              active={tab === 'link'}
              onClick={() => setTab('link')}
              icon={<Link2 className="size-4" />}
              label="Public link"
            />
          </div>

          {shares.isPending ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-zinc-500">
              <LoaderCircle className="size-4 animate-spin" />
              Loading access…
            </div>
          ) : shares.isError ? (
            <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              Unable to load sharing settings.{' '}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => void shares.refetch()}
              >
                Try again
              </button>
            </div>
          ) : tab === 'people' ? (
            <div className="mt-5">
              <form
                onSubmit={(event) => void handleGrant(event)}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <label
                  className="sr-only"
                  htmlFor={`share-email-${target.targetId}`}
                >
                  Email
                </label>
                <input
                  id={`share-email-${target.targetId}`}
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Registered user email"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  disabled={createGrant.isPending || !email.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
                >
                  {createGrant.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Share
                </button>
              </form>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                The recipient must already have an account.
              </p>

              <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  People with access
                </h3>
                {shares.data?.grants.length ? (
                  <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {shares.data.grants.map((grant) => (
                      <li
                        key={grant.id}
                        className="flex items-center gap-3 py-3"
                      >
                        <div className="flex size-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {grant.recipientEmail[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {grant.recipientEmail}
                          </p>
                          <p className="text-xs text-zinc-500">Viewer</p>
                        </div>
                        <button
                          type="button"
                          disabled={revokeGrant.isPending}
                          onClick={() =>
                            void revokeGrant
                              .mutateAsync(grant.id)
                              .then(() => toast.success('Access revoked.'))
                              .catch(() =>
                                toast.error('Unable to revoke access.'),
                              )
                          }
                          aria-label={`Revoke access for ${grant.recipientEmail}`}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-950">
                    Only you have permissioned access.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Link2 className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      Anyone with the link
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      No account is required. Access is read-only and includes
                      nested content.
                    </p>
                  </div>
                </div>

                {publicUrl ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={publicUrl}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : activeLink ? (
                  <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    A public link is active. Its secret token is not stored.
                    Create a new link to copy it again.
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500 dark:bg-zinc-950">
                    Public access is currently off.
                  </p>
                )}

                <div
                  className={`mt-4 grid gap-2 ${activeLink ? 'grid-cols-2' : 'grid-cols-1 sm:ml-auto sm:max-w-48'}`}
                >
                  {activeLink ? (
                    <button
                      type="button"
                      disabled={revokeLink.isPending}
                      onClick={() =>
                        void revokeLink
                          .mutateAsync(activeLink.id)
                          .then(() => {
                            setPublicUrl(null);
                            toast.success('Public link revoked.');
                          })
                          .catch(() =>
                            toast.error('Unable to revoke the public link.'),
                          )
                      }
                      className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-2 py-2 text-xs font-medium text-red-600 disabled:opacity-50 sm:gap-2 sm:px-3.5 sm:text-sm dark:border-red-900 dark:text-red-400"
                    >
                      <Trash2 className="size-4" />
                      Revoke
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={createLink.isPending}
                    onClick={() => void handleCreateLink()}
                    className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-2 py-2 text-xs font-medium text-white disabled:opacity-50 sm:gap-2 sm:px-3.5 sm:text-sm dark:bg-zinc-50 dark:text-zinc-950"
                  >
                    {createLink.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : activeLink ? (
                      <RefreshCw className="size-4" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    {activeLink ? 'Create new link' : 'Create public link'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
    >
      {icon}
      {label}
    </button>
  );
}
