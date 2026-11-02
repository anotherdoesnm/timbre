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
import { isTauriRuntime, signInViaOAuthPopup } from './tauriOAuth';

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
  if (!isTauriRuntime()) {
    location.assign(url);
    return;
  }
  // Desktop/mobile shell: a separate window, so the app never navigates away.
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
