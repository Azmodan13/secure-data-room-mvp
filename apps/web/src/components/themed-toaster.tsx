'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Toaster } from 'sonner';

const subscribe = () => () => {};

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const theme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <Toaster
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      mobileOffset={16}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: '!rounded-xl !border !px-4 !py-3 !shadow-xl !backdrop-blur-sm',
          title: '!text-sm !font-medium',
          description: '!text-xs !opacity-80',
          success:
            '!border-emerald-200 !bg-emerald-50 !text-emerald-950 dark:!border-emerald-900 dark:!bg-emerald-950 dark:!text-emerald-100',
          error:
            '!border-red-200 !bg-red-50 !text-red-950 dark:!border-red-900 dark:!bg-red-950 dark:!text-red-100',
          warning:
            '!border-amber-200 !bg-amber-50 !text-amber-950 dark:!border-amber-900 dark:!bg-amber-950 dark:!text-amber-100',
          info: '!border-indigo-200 !bg-indigo-50 !text-indigo-950 dark:!border-indigo-900 dark:!bg-indigo-950 dark:!text-indigo-100',
          loading:
            '!border-zinc-200 !bg-white !text-zinc-900 dark:!border-zinc-800 dark:!bg-zinc-900 dark:!text-zinc-100',
          closeButton:
            '!border-zinc-200 !bg-white !text-zinc-500 hover:!text-zinc-900 dark:!border-zinc-700 dark:!bg-zinc-900 dark:!text-zinc-400 dark:hover:!text-white',
          actionButton:
            '!rounded-md !bg-zinc-950 !px-3 !text-white dark:!bg-zinc-100 dark:!text-zinc-950',
          cancelButton:
            '!rounded-md !bg-zinc-100 !px-3 !text-zinc-700 dark:!bg-zinc-800 dark:!text-zinc-200',
        },
      }}
    />
  );
}
