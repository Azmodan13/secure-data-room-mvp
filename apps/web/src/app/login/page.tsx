import { AuthForm } from '@/components/auth-form';
import { ThemeSwitcher } from '@/components/theme-switcher';

const callbackErrors: Record<string, string> = {
  missing_oauth_code: 'Google did not return an authorization code.',
  oauth_callback_failed: 'Google sign-in could not be completed.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
      <div className="absolute right-6 top-6">
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
