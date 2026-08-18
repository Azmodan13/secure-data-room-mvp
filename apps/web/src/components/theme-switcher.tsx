'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';

const subscribe = () => () => {};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div aria-hidden className="h-9 w-24" />;
  }

  return (
    <label className="text-sm text-zinc-600 dark:text-zinc-400">
      <span className="sr-only">Color theme</span>
      <select
        value={theme ?? 'system'}
        onChange={(event) => setTheme(event.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
