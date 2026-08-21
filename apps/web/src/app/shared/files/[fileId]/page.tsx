import { redirect } from 'next/navigation';
import { SharedFileViewer } from '@/features/sharing/components/shared-file-viewer';
import { createClient } from '@/lib/supabase/server';

export default async function SharedFilePage({
  params,
}: PageProps<'/shared/files/[fileId]'>) {
  const { fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <SharedFileViewer fileId={fileId} />;
}
