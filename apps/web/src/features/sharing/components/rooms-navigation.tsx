import Link from 'next/link';

export function RoomsNavigation({ active }: { active: 'owned' | 'shared' }) {
  return (
    <nav
      aria-label="Data Room views"
      className="mt-5 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
    >
      <Link
        href="/rooms"
        aria-current={active === 'owned' ? 'page' : undefined}
        className={`rounded-md px-3 py-2 text-sm font-medium ${active === 'owned' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
      >
        My rooms
      </Link>
      <Link
        href="/shared"
        aria-current={active === 'shared' ? 'page' : undefined}
        className={`rounded-md px-3 py-2 text-sm font-medium ${active === 'shared' ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
      >
        Shared with me
      </Link>
    </nav>
  );
}
