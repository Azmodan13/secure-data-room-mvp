import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/api/server';
import { createClient } from '@/lib/supabase/server';
import { DataRoomsList } from '@/features/data-rooms/components/data-rooms-list';
import { CreateDataRoomDialog } from '@/features/data-rooms/components/create-data-room-dialog';
import { RoomsHeader } from '@/features/data-rooms/components/rooms-header';
import { RoomsNavigation } from '@/features/sharing/components/rooms-navigation';

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
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <RoomsHeader
          email={currentUser.email}
          title="Data Rooms"
          description="Secure workspaces for due diligence documents."
          action={<CreateDataRoomDialog />}
        />
        <RoomsNavigation active="owned" />
        <section className="py-6">
          <DataRoomsList />
        </section>
      </div>
    </main>
  );
}
