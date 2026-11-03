/**
 * The data plane: PostgREST with the user's own JWT.
 *
 * Every read carries `apikey` (the instance's anon key) and `Authorization: Bearer <jwt>`;
 * row level security decides what comes back, so an empty array here means "nothing is
 * visible to this account", not "the query is wrong".
 */

import type { Session } from './auth';

export async function rest<T>(session: Session, table: string, query: string): Promise<T> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${table}: ${res.status} ${body.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

/**
 * PostgREST function call. RPC is POST, not GET — `rest()` only reads tables.
 */
export async function rpc<T>(session: Session, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${fn}: ${res.status} ${body.slice(0, 160)}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** The JWT is ours to read: `sub` is the auth user id, and profiles carry it as auth_user_id. */
export function authUserId(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as { sub?: string };
    return parsed.sub ?? null;
  } catch {
    return null;
  }
}
