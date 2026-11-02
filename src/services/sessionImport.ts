/**
 * Dev escape hatch: adopt a session that was obtained elsewhere.
 *
 * The instance does not allow this client's `redirect_to`, so GoTrue finishes every OAuth
 * attempt on the instance's own frontend. Until an operator adds the URL, the only way to
 * get a real session into the app is to bring one: paste the auth blob from the official
 * web app (DevTools → Application → Local Storage → `sb-*-auth-token`) or the fragment of
 * a callback URL.
 */

import type { InstanceInfo } from './discover';
import type { Session } from './auth';

const SESSION_PREFIX = 'auth.session.';

function fromJson(value: unknown, depth = 0): { access?: string; refresh?: string } {
  if (!value || typeof value !== 'object' || depth > 3) return {};
  const o = value as Record<string, unknown>;
  if (typeof o.access_token === 'string') {
    return {
      access: o.access_token,
      refresh: typeof o.refresh_token === 'string' ? o.refresh_token : undefined,
    };
  }
  for (const key of ['currentSession', 'session', 'data', 'current_session']) {
    if (o[key]) {
      const inner = fromJson(o[key], depth + 1);
      if (inner.access) return inner;
    }
  }
  return {};
}

export function parseSessionBlob(raw: string): { access: string; refresh?: string } | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const found = fromJson(JSON.parse(text));
      if (found.access) return { access: found.access, refresh: found.refresh };
    } catch {
      /* fall through to the URL form */
    }
  }

  const params = new URLSearchParams(text.replace(/^[^#?]*[#?]/, ''));
  const access = params.get('access_token');
  if (access) return { access, refresh: params.get('refresh_token') ?? undefined };

  // A bare JWT, or the whole "Authorization: Bearer …" header copied out of the Network
  // tab: the fastest thing to get hold of, and the only thing needed to read data.
  const bare = text.replace(/^Bearer\s+/i, '').trim();
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(bare)) return { access: bare };

  return null;
}

/** Decoded claims of a JWT; null when it is not one. */
export function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The anon key is a JWT too, with `role: anon` and no `sub`. Pasting it produces a session
 * that authenticates but sees nothing, which is indistinguishable from "RLS is empty" — so
 * it is refused here, by name.
 */
export function describeToken(access: string): { ok: boolean; reason?: string; label: string } {
  const claims = jwtClaims(access);
  if (!claims) return { ok: false, reason: 'not a JWT', label: '' };
  const role = String(claims.role ?? '');
  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  const email = typeof claims.email === 'string' ? claims.email : '';
  const label = `${role || 'role?'}${email ? ' · ' + email : ''}${sub ? ' · sub=' + sub.slice(0, 8) : ''}`;
  if (role === 'anon' || role === 'service_role') {
    return { ok: false, reason: `that is the instance key (role=${role}), not your session`, label };
  }
  if (!sub) return { ok: false, reason: 'no sub claim — not a user session', label };
  return { ok: true, label };
}

export function adoptSession(instance: InstanceInfo, access: string, refresh?: string): Session {
  const session: Session = {
    instance: instance.origin,
    supabaseUrl: instance.supabaseUrl,
    anonKey: instance.supabaseAnonKey,
    accessToken: access,
    refreshToken: refresh,
    provider: 'imported',
  };
  localStorage.setItem(SESSION_PREFIX + session.instance, JSON.stringify(session));
  return session;
}
