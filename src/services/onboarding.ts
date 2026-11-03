/**
 * Account creation on a Harmony instance, in the same three steps the official web app uses:
 * credentials → username → a *suggested* server that the user accepts or declines.
 *
 * GoTrue's `/auth/v1/signup` only creates the auth user. The rest is ordinary PostgREST with
 * the new session, and row level security has opinions about all of it:
 *
 *   profiles_insert_own  → auth_user_id must equal auth.uid()
 *   user_servers_insert  → only a server's owner may insert a membership, so joining is done
 *                          through `join_public_server(server_id)` — and only when the person
 *                          says yes.
 *
 * An account that stops after step one has a session but no profile; the client resumes at the
 * username step instead of pretending the account is ready.
 */
import type { InstanceInfo } from './discover';
import { persistSession, type Session } from './auth';
import { authUserId, rest } from './api';

export interface ServerSuggestion {
  id: string;
  name: string;
  members: number;
}

function authHeaders(instance: InstanceInfo, token?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: instance.supabaseAnonKey,
    Authorization: `Bearer ${token ?? instance.supabaseAnonKey}`,
  };
}

async function failure(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* the raw text is the best we have */
  }
  const message =
    (typeof body.error_description === 'string' && body.error_description) ||
    (typeof body.msg === 'string' && body.msg) ||
    (typeof body.message === 'string' && body.message) ||
    (typeof body.error === 'string' && body.error) ||
    text.slice(0, 160);
  if (res.status === 422 && /already registered|user already/i.test(message)) {
    return 'An account with this address already exists — sign in instead';
  }
  if (/signups? not allowed|disable_signup/i.test(message)) {
    return 'This instance does not accept new accounts';
  }
  return message || `HTTP ${res.status}`;
}

export function validUsername(username: string): boolean {
  return /^[a-z0-9_.-]{2,32}$/i.test(username.trim());
}

/** Checked before the account is created, and again before the profile is written. */
export async function usernameTaken(instance: InstanceInfo, username: string): Promise<boolean> {
  const url = `${instance.supabaseUrl}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username.trim())}&limit=1`;
  const res = await fetch(url, { headers: authHeaders(instance), cache: 'no-store' });
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** Step 1: the auth user, and a stored session so an interrupted sign-up can be resumed. */
export async function createAccount(
  instance: InstanceInfo,
  email: string,
  password: string
): Promise<Session> {
  const res = await fetch(`${instance.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(instance),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await failure(res));

  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.access_token !== 'string') {
    throw new Error('The instance wants this address confirmed by email — check the inbox, then sign in');
  }

  const session: Session = {
    instance: instance.origin,
    supabaseUrl: instance.supabaseUrl,
    anonKey: instance.supabaseAnonKey,
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    provider: 'password',
    user: (body.user as Session['user']) ?? undefined,
  };
  persistSession(session, email);
  return session;
}

/** Step 2: the profile every policy resolves the current user through. */
export async function chooseUsername(
  session: Session,
  instance: InstanceInfo,
  username: string
): Promise<void> {
  const name = username.trim();
  if (!validUsername(name)) {
    throw new Error('2–32 characters: letters, digits, dot, dash or underscore');
  }
  if (await usernameTaken(instance, name)) throw new Error('That username is taken');

  const uid = authUserId(session.accessToken);
  if (!uid) throw new Error('The instance returned a token without a subject');
  const res = await fetch(`${instance.supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...authHeaders(instance, session.accessToken), Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: uid,
      auth_user_id: uid,
      username: name,
      display_name: name,
      domain: instance.origin,
    }),
  });
  if (!res.ok) throw new Error(await failure(res));
}

/** Candidates for step 3 — the user still has to say yes. */
export async function suggestedServers(session: Session): Promise<ServerSuggestion[]> {
  try {
    const rows = await rest<{ id: string; name: string; member_count: number | null }[]>(
      session,
      'servers',
      'select=id,name,member_count&public=is.true&is_local_server=is.true&order=member_count.desc&limit=3'
    );
    return rows.map((r) => ({ id: r.id, name: r.name, members: r.member_count ?? 0 }));
  } catch {
    return [];
  }
}

/** Step 3, only if the user accepts. */
export async function joinServer(session: Session, instance: InstanceInfo, serverId: string): Promise<void> {
  const res = await fetch(`${instance.supabaseUrl}/rest/v1/rpc/join_public_server`, {
    method: 'POST',
    headers: authHeaders(instance, session.accessToken),
    body: JSON.stringify({ p_server_id: serverId }),
  });
  if (!res.ok) throw new Error(await failure(res));
}
