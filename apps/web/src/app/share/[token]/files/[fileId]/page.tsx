import { PublicShareBrowser } from '@/features/sharing/components/public-share-browser';

export default async function PublicSharedFilePage({
  params,
}: PageProps<'/share/[token]/files/[fileId]'>) {
  const { token, fileId } = await params;
  return <PublicShareBrowser token={token} directFileId={fileId} />;
}
