import { redirect } from 'next/navigation';
import { RoomBrowser } from '@/features/data-rooms/components/room-browser';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/api/server';

export default async function DataRoomPage({
  params,
}: PageProps<'/rooms/[dataRoomId]'>) {
  const { dataRoomId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const currentUser = await getCurrentUser(session.access_token);

  return <RoomBrowser dataRoomId={dataRoomId} currentUserId={currentUser.id} />;
}
