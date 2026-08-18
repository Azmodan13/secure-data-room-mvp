'use client';

import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'offline';
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export function HealthStatus() {
  const [state, setState] = useState<HealthState>(
    apiUrl ? 'checking' : 'offline',
  );

  useEffect(() => {
    if (!apiUrl) return;

    const controller = new AbortController();

    fetch(`${apiUrl}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Health check failed');
        setState('online');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setState('offline');
      });

    return () => controller.abort();
  }, []);

  const label = {
    checking: 'Checking API',
    online: 'API online',
    offline: 'API unavailable',
  }[state];

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 shadow-sm">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${
          state === 'online'
            ? 'bg-emerald-500'
            : state === 'checking'
              ? 'animate-pulse bg-amber-400'
              : 'bg-red-500'
        }`}
      />
      <span>{label}</span>
    </div>
  );
}
