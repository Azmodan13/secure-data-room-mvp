'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
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
    return <div aria-hidden className="h-10 w-[6.5rem]" />;
  }

  const selectedTheme = theme ?? 'system';
  const options = [
    { value: 'system', label: 'Use system theme', icon: Monitor },
    { value: 'light', label: 'Use light theme', icon: Sun },
    { value: 'dark', label: 'Use dark theme', icon: Moon },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const isSelected = selectedTheme === value;

        return (
          <button
            key={value}
            type="button"
            data-compact-control
            title={label}
            aria-label={label}
            aria-pressed={isSelected}
            onClick={() => setTheme(value)}
            className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
              isSelected
                ? 'bg-zinc-100 text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
            }`}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
