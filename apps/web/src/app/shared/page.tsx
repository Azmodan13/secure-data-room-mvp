import { redirect } from 'next/navigation';
import { RoomsHeader } from '@/features/data-rooms/components/rooms-header';
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
        <RoomsHeader
          email={currentUser.email}
          title="Shared with me"
          description="Read-only Data Rooms, folders, and files shared with you."
        />
        <RoomsNavigation active="shared" />
        <section className="py-6">
          <ReceivedSharesList />
        </section>
      </div>
    </main>
  );
}
