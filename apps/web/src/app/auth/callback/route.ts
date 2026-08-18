import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');

  const next =
    nextParam?.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/rooms';

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_oauth_code', request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=oauth_callback_failed', request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
