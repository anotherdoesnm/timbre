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
