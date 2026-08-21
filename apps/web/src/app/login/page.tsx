import { AuthForm } from '@/components/auth-form';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const callbackErrors: Record<string, string> = {
  missing_oauth_code: 'Google did not return an authorization code.',
  oauth_callback_failed: 'Google sign-in could not be completed.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/rooms');
  }

  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-50 px-4 pb-8 pt-24 sm:px-6 sm:py-12 dark:bg-zinc-950">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeSwitcher />
      </div>

      <AuthForm
        initialError={
          typeof error === 'string' ? callbackErrors[error] : undefined
        }
      />
    </main>
  );
}
