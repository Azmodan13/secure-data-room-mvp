import { redirect } from 'next/navigation';
import { SharedFolderBrowser } from '@/features/sharing/components/shared-folder-browser';
import { createClient } from '@/lib/supabase/server';

export default async function SharedFolderPage({
  params,
}: PageProps<'/shared/folders/[folderId]'>) {
  const { folderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <SharedFolderBrowser rootFolderId={folderId} />;
}
