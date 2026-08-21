import type { ReactNode } from 'react';
import { AccountActions } from '@/components/account-actions';

type RoomsHeaderProps = {
  email: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function RoomsHeader({
  email,
  title,
  description,
  action,
}: RoomsHeaderProps) {
  return (
    <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
      <div className="flex items-center justify-end gap-3 sm:justify-between">
        <p className="hidden min-w-0 truncate text-sm text-zinc-500 sm:block dark:text-zinc-400">
          Signed in as {email}
        </p>

        <AccountActions />
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-zinc-950 sm:text-3xl dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>

        {action ? (
          <div className="flex shrink-0 items-center">{action}</div>
        ) : null}
      </div>
    </header>
  );
}
