import { PublicShareBrowser } from '@/features/sharing/components/public-share-browser';

export default async function PublicSharePage({
  params,
}: PageProps<'/share/[token]'>) {
  const { token } = await params;
  return <PublicShareBrowser token={token} />;
}
