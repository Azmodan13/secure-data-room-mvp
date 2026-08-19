import { redirect } from 'next/navigation';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { getCurrentUser } from '@/lib/api/server';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import { DataRoomsList } from '@/features/data-rooms/components/data-rooms-list';
import { CreateDataRoomDialog } from '@/features/data-rooms/components/create-data-room-dialog';

export default async function RoomsPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const currentUser = await getCurrentUser(session.access_token);

  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as {currentUser.email}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              Data Rooms
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <CreateDataRoomDialog />
            <ThemeSwitcher />

            <form action={signOut}>
              <button className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <section className="py-6">
          <DataRoomsList />
        </section>
      </div>
    </main>
  );
}
