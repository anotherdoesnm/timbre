/**
 * OAuth sign-in against an instance's GoTrue.
 *
 *  web    → top-level redirect to /auth/v1/authorize, callback at {origin}/auth/callback
 *  tauri  → same URL in a separate window, callback at {origin}/auth/callback inside the shell
 *
 * The callback URL must be allowlisted by the instance (`ADDITIONAL_REDIRECT_URLS`).
 * The flagship already allows the Tauri origins — that is how the official desktop app logs in.
 */

import type { InstanceInfo } from './discover';
import { challengeFor, randomVerifier } from './pkce';
import { isMobileShell, isTauriRuntime, signInViaOAuthPopup } from './tauriOAuth';

export interface Session {
  instance: string;
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  refreshToken?: string;
  provider?: string;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
}

const PENDING_KEY = 'auth.pending';
const LAST_KEY = 'auth.last';

/** Remembers where the last successful sign-in happened, to prefill the form. */
export function rememberLast(instance: string, email?: string): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ instance, email: email ?? '' }));
  } catch {
    /* storage may be unavailable */
  }
}

export function lastSignIn(): { instance: string; email: string } | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as { instance: string; email: string }) : null;
  } catch {
    return null;
  }
}
const SESSION_PREFIX = 'auth.session.';

export const isTauri = isTauriRuntime;

interface Pending {
  instance: InstanceInfo;
  provider: string;
  verifier: string;
  redirectTo: string;
}

export function redirectTarget(): string {
  // Exactly what the official app sends: `${origin}/auth/callback`, origin being the webview's
  // own (`http://tauri.localhost` on Android/Windows/Linux, `tauri://localhost` on macOS).
  // The instance's allowlist is matched against this path, so a bare origin or a fragment in
  // the middle is not the same URL to it — both were tried and both fell back to SITE_URL.
  return `${location.origin}/auth/callback`;
}

/** Same-origin fragment keeps our hash router working; GoTrue appends its own params. */
export function readCallback(search: string, hash: string): { code?: string; accessToken?: string; refreshToken?: string } {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const code = q.get('code') ?? undefined;
  const accessToken = h.get('access_token') ?? undefined;
  const refreshToken = h.get('refresh_token') ?? undefined;
  return { code, accessToken, refreshToken };
}

export async function beginSignIn(instance: InstanceInfo, provider: string): Promise<string> {
  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  const redirectTo = redirectTarget();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ instance, provider, verifier, redirectTo } satisfies Pending));

  const url = new URL(`${instance.supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', redirectTo);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 's256');
  return url.toString();
}

export async function navigateToSignIn(instance: InstanceInfo, provider: string): Promise<void> {
  const url = await beginSignIn(instance, provider);
  // Phone and browser both leave this page; nothing may touch the router afterwards, or the
  // app flashes its own shell between the click and the provider's page.
  if (isMobileShell() || !isTauriRuntime()) {
    location.assign(url);
    return;
  }
  // Desktop: a separate window, so the shell never navigates away.
  await signInViaOAuthPopup(url);
  location.hash = 'chat';
}

function pending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

/** Exchanges the auth code, or accepts implicit tokens, and stores the session per instance. */
export async function completeSignIn(params: { code?: string; accessToken?: string; refreshToken?: string }): Promise<Session> {
  const p = pending();
  if (!p) throw new Error('No sign-in in progress: start again from the sign-in screen');

  let body: Record<string, unknown> = {};
  if (params.code) {
    const res = await fetch(`${p.instance.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        apikey: p.instance.supabaseAnonKey,
        Authorization: `Bearer ${p.instance.supabaseAnonKey}`,
      },
      body: JSON.stringify({ auth_code: params.code, code_verifier: p.verifier }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Sign-in failed: ${res.status} ${text.slice(0, 120)}`);
    }
    body = (await res.json()) as Record<string, unknown>;
  } else if (params.accessToken) {
    body = { access_token: params.accessToken, refresh_token: params.refreshToken };
  } else {
    throw new Error('The instance returned nothing');
  }

  const session: Session = {
    instance: p.instance.origin,
    supabaseUrl: p.instance.supabaseUrl,
    anonKey: p.instance.supabaseAnonKey,
    accessToken: String(body.access_token ?? ''),
    refreshToken: body.refresh_token ? String(body.refresh_token) : undefined,
    provider: p.provider,
    user: (body.user as Session['user']) ?? undefined,
  };
  if (!session.accessToken) throw new Error('The instance returned no token');

  localStorage.setItem(SESSION_PREFIX + session.instance, JSON.stringify(session));
  sessionStorage.removeItem(PENDING_KEY);
  return session;
}

/** Claims of an access token, without verifying anything: exp is all we need. */
function tokenExpiry(access: string): number | null {
  try {
    const part = access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4))) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the access token is gone or about to expire (a minute of slack). */
export function sessionExpired(session: Session, slackMs = 60_000): boolean {
  const exp = tokenExpiry(session.accessToken);
  return exp === null ? true : exp - Date.now() < slackMs;
}

/**
 * Exchanges the refresh token for a fresh access token and rewrites the stored session.
 * Without this an imported session dies an hour after it was pasted, which makes the whole
 * bring-your-own-session path useless for anything longer than a test.
 */
export async function refreshSession(session: Session): Promise<Session> {
  if (!session.refreshToken) throw new Error('no refresh token');
  const res = await fetch(`${session.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: session.anonKey,
      Authorization: `Bearer ${session.anonKey}`,
    },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!body.access_token) throw new Error('refresh returned no token');
  const next: Session = {
    ...session,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? session.refreshToken,
  };
  localStorage.setItem(SESSION_PREFIX + next.instance, JSON.stringify(next));
  return next;
}

/**
 * Email and password sign-in against the instance's GoTrue.
 *
 * This is the one flow that needs nothing from the instance's redirect allowlist: the token
 * comes back in the response body, not through a browser redirect.
 */
export async function signInWithPassword(instance: InstanceInfo, email: string, password: string): Promise<Session> {
  const res = await fetch(`${instance.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: instance.supabaseAnonKey,
      Authorization: `Bearer ${instance.supabaseAnonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* keep the raw text for the error below */
  }
  if (!res.ok) {
    const msg =
      (typeof body.error_description === 'string' && body.error_description) ||
      (typeof body.msg === 'string' && body.msg) ||
      (typeof body.error === 'string' && body.error) ||
      text.slice(0, 160) ||
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  if (typeof body.access_token !== 'string') throw new Error('The instance returned no token');

  const session: Session = {
    instance: instance.origin,
    supabaseUrl: instance.supabaseUrl,
    anonKey: instance.supabaseAnonKey,
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    provider: 'password',
    user: (body.user as Session['user']) ?? undefined,
  };
  localStorage.setItem(SESSION_PREFIX + session.instance, JSON.stringify(session));
  rememberLast(session.instance, email);
  return session;
}

/**
 * Does the instance still know this token?
 *
 * A session can outlive its account: delete the user and the stored JWT is still signed and
 * still parses, while every table answers with an empty array. That looked like a blank client
 * rather than a signed-out one until this check existed.
 */
export async function sessionAlive(session: Session): Promise<boolean> {
  try {
    const res = await fetch(`${session.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: session.anonKey, Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    // A network failure is not proof of a dead account: keep the session and try again later.
    return true;
  }
}

/** Stores a session produced somewhere else (sign-up), keyed like every other session. */
export function persistSession(session: Session, email?: string): void {
  try {
    localStorage.setItem(SESSION_PREFIX + session.instance, JSON.stringify(session));
    rememberLast(session.instance, email ?? (session.user?.email as string | undefined) ?? '');
  } catch {
    /* storage may be unavailable */
  }
}

export function storedSession(instance?: string): Session | null {
  const key = instance ? SESSION_PREFIX + instance : null;
  if (key) {
    const raw = localStorage.getItem(key);
    try {
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k?.startsWith(SESSION_PREFIX)) {
      try {
        return JSON.parse(localStorage.getItem(k) ?? '') as Session;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

export function signOut(): void {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(SESSION_PREFIX)) localStorage.removeItem(k);
  }
}
