import { redirect } from 'next/navigation';
import { RoomBrowser } from '@/features/data-rooms/components/room-browser';
import { createClient } from '@/lib/supabase/server';

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

  return <RoomBrowser dataRoomId={dataRoomId} />;
}
