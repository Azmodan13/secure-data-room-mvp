'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import {
  signInSchema,
  signUpSchema,
  type AuthValues,
} from '@/lib/validation/auth';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [authError, setAuthError] = useState(initialError ?? '');
  const [isGooglePending, setIsGooglePending] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(mode === 'sign-in' ? signInSchema : signUpSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setAuthError('');

    try {
      const supabase = createClient();
      const credentials = {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      };

      const result =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword(credentials)
          : await supabase.auth.signUp(credentials);

      if (result.error) {
        setAuthError(result.error.message);
        return;
      }

      router.replace('/rooms');
      router.refresh();
    } catch {
      setAuthError(
        'Unable to reach the authentication service. Check your connection and try again.',
      );
    }
  });

  async function handleGoogleSignIn() {
    setAuthError('');
    setIsGooglePending(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/rooms`,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsGooglePending(false);
        return;
      }

      if (!data.url) {
        setAuthError('Google sign-in did not return a redirect URL.');
        setIsGooglePending(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setAuthError(
        'Unable to start Google sign-in. Check your connection and try again.',
      );
      setIsGooglePending(false);
    }
  }

  function toggleMode() {
    setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'));
    setAuthError('');
    clearErrors();
    reset({ email: '', password: '' });
  }

  const pending = isSubmitting || isGooglePending;

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-8">
        <div className="mb-6 flex size-10 items-center justify-center rounded-xl bg-indigo-600 font-semibold text-white">
          DR
        </div>

        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
        </h1>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Securely organize and share due diligence documents.
        </p>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={handleGoogleSignIn}
        className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {isGooglePending ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        OR
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-indigo-950"
          />

          {errors.email ? (
            <p
              id="email-error"
              role="alert"
              className="mt-1.5 text-sm text-red-600"
            >
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            autoComplete={
              mode === 'sign-in' ? 'current-password' : 'new-password'
            }
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-indigo-950"
          />

          {errors.password ? (
            <p
              id="password-error"
              role="alert"
              className="mt-1.5 text-sm text-red-600"
            >
              {errors.password.message}
            </p>
          ) : null}
        </div>

        {authError ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            {authError}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? 'Please wait…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>

      <button
        type="button"
        disabled={pending}
        onClick={toggleMode}
        className="mt-6 w-full text-sm text-zinc-600 hover:text-zinc-950 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        {mode === 'sign-in'
          ? 'New here? Create an account'
          : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
