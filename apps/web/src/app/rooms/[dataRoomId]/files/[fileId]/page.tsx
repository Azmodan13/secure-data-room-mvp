import { redirect } from 'next/navigation';
import { PdfViewer } from '@/features/files/components/pdf-viewer';
import { createClient } from '@/lib/supabase/server';

export default async function FilePage({
  params,
}: PageProps<'/rooms/[dataRoomId]/files/[fileId]'>) {
  const { dataRoomId, fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <PdfViewer dataRoomId={dataRoomId} fileId={fileId} />;
}
