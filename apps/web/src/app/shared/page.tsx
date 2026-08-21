import { redirect } from 'next/navigation';
import { AccountActions } from '@/components/account-actions';
import { ReceivedSharesList } from '@/features/sharing/components/received-shares-list';
import { RoomsNavigation } from '@/features/sharing/components/rooms-navigation';
import { getCurrentUser } from '@/lib/api/server';
import { createClient } from '@/lib/supabase/server';

export default async function SharedPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect('/login');
  const currentUser = await getCurrentUser(session.access_token);

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as {currentUser.email}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-950 sm:text-3xl dark:text-zinc-50">
              Data Rooms
            </h1>
          </div>
          <AccountActions />
        </header>
        <RoomsNavigation active="shared" />
        <section className="py-6">
          <ReceivedSharesList />
        </section>
      </div>
    </main>
  );
}
