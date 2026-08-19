'use client';

import { AlertCircle, Database, LoaderCircle } from 'lucide-react';
import { useDataRooms } from '../queries';
import Link from 'next/link';
import { DataRoomActions } from './data-room-actions';

function DataRoomSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-5 w-2/5 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-1/4 rounded bg-zinc-100 dark:bg-zinc-800/70" />
    </div>
  );
}

export function DataRoomsList() {
  const query = useDataRooms();

  if (query.isPending) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <DataRoomSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/30">
        <AlertCircle className="mx-auto size-8 text-red-500" />

        <h2 className="mt-3 font-semibold text-red-950 dark:text-red-100">
          Unable to load Data Rooms
        </h2>

        <p className="mt-1 text-sm text-red-700 dark:text-red-300">
          Check your connection and try again.
        </p>

        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const dataRooms = query.data.pages.flatMap((page) => page.data);

  if (dataRooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
        <Database className="mx-auto size-9 text-zinc-400" />

        <h2 className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">
          No Data Rooms yet
        </h2>

        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create a Data Room to start organizing documents.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3">
        {dataRooms.map((dataRoom) => (
          <article
            key={dataRoom.id}
            className="flex items-center rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <Link href={`/rooms/${dataRoom.id}`} className="min-w-0 flex-1 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Database className="size-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                    {dataRoom.name}
                  </h2>

                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Created{' '}
                    {new Intl.DateTimeFormat('en', {
                      dateStyle: 'medium',
                    }).format(new Date(dataRoom.createdAt))}
                  </p>
                </div>
              </div>
            </Link>

            <div className="shrink-0 pr-3">
              <DataRoomActions dataRoom={dataRoom} />
            </div>
          </article>
        ))}
      </div>

      {query.hasNextPage ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {query.isFetchingNextPage ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}

            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
