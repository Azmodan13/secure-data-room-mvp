import 'server-only';

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

type CurrentUserResponse = {
  data: CurrentUser;
};

export async function getCurrentUser(
  accessToken: string,
): Promise<CurrentUser> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }

  const response = await fetch(`${apiUrl}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Current user request failed with ${response.status}.`);
  }

  const body = (await response.json()) as CurrentUserResponse;
  return body.data;
}
