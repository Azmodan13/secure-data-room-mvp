'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from './query-provider';
import { ThemedToaster } from './themed-toaster';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ThemedToaster />
    </QueryProvider>
  );
}
