import { createClient } from '@/lib/supabase/client';

type ApiErrorBody = {
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiError('Authentication is required.', 401);
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json()) as T | ApiErrorBody;

  if (!response.ok) {
    const error = body as ApiErrorBody;

    throw new ApiError(
      error.error?.message ??
        error.message ??
        `Request failed with status ${response.status}.`,
      response.status,
      error.error?.code,
      error.error?.details,
    );
  }

  return body as T;
}

export function getSuggestedName(details: unknown): string | null {
  if (
    typeof details === 'object' &&
    details !== null &&
    'suggestedName' in details &&
    typeof details.suggestedName === 'string'
  ) {
    return details.suggestedName;
  }

  return null;
}
