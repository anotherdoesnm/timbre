/**
 * Account creation on a Harmony instance.
 *
 * GoTrue's `/auth/v1/signup` only creates the auth user. The rows that make that user a person
 * on the instance — a `profiles` row and a membership in a server — are written by the official
 * web app after sign-in, and row level security has opinions about both:
 *
 *   profiles_insert_own  → auth_user_id must equal auth.uid()
 *   user_servers_insert  → only the server's owner may insert, so a new account cannot simply
 *                         join; `join_public_server(server_id)` is the sanctioned way in.
 *
 * Without these two steps a fresh account signs in and then stares at an empty screen, which is
 * exactly what this module exists to prevent.
 */
import type { InstanceInfo } from './discover';
import { persistSession, type Session } from './auth';
import { authUserId, rest } from './api';

export interface SignUpResult {
  session: Session;
  /** Name of the server that was joined automatically, if any. */
  joined: string | null;
  warnings: string[];
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

/** A username has to be free before the auth user is created, or the account is born unusable. */
async function usernameTaken(instance: InstanceInfo, username: string): Promise<boolean> {
  const url = `${instance.supabaseUrl}/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&limit=1`;
  const res = await fetch(url, { headers: authHeaders(instance), cache: 'no-store' });
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

async function createProfile(session: Session, instance: InstanceInfo, username: string): Promise<void> {
  const uid = authUserId(session.accessToken);
  if (!uid) throw new Error('The instance returned a token without a subject');
  const res = await fetch(`${instance.supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...authHeaders(instance, session.accessToken), Prefer: 'return=minimal' },
    // id and auth_user_id match here; the official app keeps them equal too, and every policy
    // resolves the current user through auth_user_id anyway.
    body: JSON.stringify({
      id: uid,
      auth_user_id: uid,
      username,
      display_name: username,
      domain: instance.origin,
    }),
  });
  if (!res.ok) throw new Error(`profile: ${await failure(res)}`);
}

/** Joins the busiest public server on the instance, so a new account lands somewhere alive. */
async function joinPublicServer(session: Session, instance: InstanceInfo): Promise<string | null> {
  let candidates: { id: string; name: string }[] = [];
  try {
    candidates = await rest<{ id: string; name: string }[]>(
      session,
      'servers',
      'select=id,name&public=is.true&is_local_server=is.true&order=member_count.desc&limit=5'
    );
  } catch {
    return null;
  }
  for (const server of candidates) {
    const res = await fetch(`${instance.supabaseUrl}/rest/v1/rpc/join_public_server`, {
      method: 'POST',
      headers: authHeaders(instance, session.accessToken),
      body: JSON.stringify({ p_server_id: server.id }),
    });
    if (res.ok) return server.name;
  }
  return null;
}

export async function signUp(
  instance: InstanceInfo,
  email: string,
  password: string,
  username: string
): Promise<SignUpResult> {
  const name = username.trim();
  if (!/^[a-z0-9_.-]{2,32}$/i.test(name)) {
    throw new Error('Username: 2–32 characters, letters, digits, dot, dash or underscore');
  }
  if (await usernameTaken(instance, name)) throw new Error('That username is taken');

  const res = await fetch(`${instance.supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(instance),
    body: JSON.stringify({ email, password, data: { username: name } }),
  });
  if (!res.ok) throw new Error(await failure(res));

  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.access_token !== 'string') {
    // GoTrue created the user but wants the address confirmed first; nothing else can happen
    // until the instance lets it through.
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

  // The profile is what every policy resolves the user through, so a failure here is fatal and
  // is reported as such; the server membership is a convenience best-effort.
  await createProfile(session, instance, name);
  const warnings: string[] = [];
  let joined: string | null = null;
  try {
    joined = await joinPublicServer(session, instance);
    if (!joined) warnings.push('No public server to join yet — you start with an empty list');
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : String(e));
  }

  persistSession(session, email);
  return { session, joined, warnings };
}
