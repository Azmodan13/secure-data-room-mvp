'use client';

import { signOut } from '@/app/rooms/actions';
import { ThemeSwitcher } from './theme-switcher';

export function AccountActions() {
  return (
    <div className="flex items-center gap-3">
      <ThemeSwitcher />

      <form action={signOut}>
        <button className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
          Sign out
        </button>
      </form>
    </div>
  );
}
