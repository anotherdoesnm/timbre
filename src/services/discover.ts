/**
 * Instance discovery for a client that does not live on the instance's origin.
 *
 *   https://{host}/api/federation/instance-info
 *     → { success, name, domain, version, supabaseUrl, supabaseAnonKey, capabilities }
 *
 * `/config.json` is deliberately not probed here: it is a same-origin document (the
 * web container writes it next to index.html) and a foreign-origin client cannot
 * read it — it has no CORS headers either. `instance-info` is the endpoint that
 * answers with everything a client needs to boot, including the capability list.
 */

export interface InstanceInfo {
  origin: string;
  name: string;
  domain?: string;
  version?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  capabilities: string[];
  /** OAuth providers only; GoTrue reports `email`/`phone` in the same map. */
  providers: string[];
  /** Set when the provider list could not be read — the instance may well have some. */
  providersError?: string;
  emailAuth?: boolean;
  demo?: boolean;
  /** True when the instance is the origin this build is served from. */
  selfHosted?: boolean;
}

export type DiscoveryFailure = {
  kind: 'http' | 'network' | 'timeout' | 'not-harmony' | 'bad-host';
  status?: number;
  message: string;
};

export type DiscoveryResult =
  | { ok: true; instance: InstanceInfo }
  | { ok: false; error: DiscoveryFailure };

const TIMEOUT_MS = 12000;

/**
 * In dev the request goes through the Vite middleware (see vite.config.ts) because the
 * instance does not answer cross-origin requests; in a built app it is a direct https call
 * (works from Tauri, and from a browser once a relay or the instance's own CORS allows it).
 */
function endpoint(host: string, path: string): string {
  return import.meta.env.DEV ? `/__instance/${host}${path}` : `https://${host}${path}`;
}

/** "https://Har.mony.lol/foo" → "har.mony.lol"; throws on hostless input. */
export function normalizeHost(raw: string): string {
  const trimmed = raw.trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '');
  const host = trimmed.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw new Error('bad host');
  return host;
}

/**
 * Builds the instance object both discovery paths share, so a field added for one cannot be
 * forgotten in the other.
 */
function instanceFromInfo(
  body: Record<string, unknown>,
  host: string,
  providers: string[],
  providersError?: string
): InstanceInfo {
  return {
    origin: host,
    name: typeof body.name === 'string' && body.name ? body.name : host,
    domain: typeof body.domain === 'string' ? body.domain : undefined,
    version: typeof body.version === 'string' ? body.version : undefined,
    supabaseUrl: body.supabaseUrl as string,
    supabaseAnonKey: body.supabaseAnonKey as string,
    capabilities: Array.isArray(body.capabilities)
      ? body.capabilities.filter((c): c is string => typeof c === 'string')
      : [],
    providers,
    providersError,
  };
}

function looksLikeHarmony(body: Record<string, unknown>): boolean {
  return body.success === true && typeof body.supabaseUrl === 'string' && typeof body.supabaseAnonKey === 'string';
}

const DEMO_CAPABILITIES = [
  'encrypted-history',
  'outgoing-webhooks',
  'channel-create-options',
  'instance-staff-roles',
  'custom-stickers',
];

function demoInstance(host: string): InstanceInfo {
  return {
    origin: host,
    name: host === 'har.mony.lol' ? 'Harmony' : host.split('.')[0],
    domain: host,
    version: '1.9.2',
    supabaseUrl: `https://db.${host}`,
    supabaseAnonKey: 'demo.anon.key',
    capabilities: DEMO_CAPABILITIES,
    providers: ['github', 'google'],
    emailAuth: true,
    demo: true,
  };
}

async function getJson(url: string, signal: AbortSignal, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...headers },
  });
  if (!res.ok) {
    const err = Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    throw err;
  }
  return res.json();
}

/**
 * Auth providers are per instance: they come from GoTrue, not from our build.
 *
 * This runs on its own deadline. Sharing one AbortController with the instance-info call
 * meant a slow link (mobile, WARP, DPI) spent the whole budget on the first request and the
 * provider list came back empty — which the UI then reported as "the instance offers no
 * sign-in methods". Wrong message, and the instance was fine.
 */
async function fetchProviders(
  supabaseUrl: string,
  anonKey: string,
  timeoutMs = 8000
): Promise<{ providers: string[]; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const origin = new URL(supabaseUrl).host;
    const settings = (await getJson(endpoint(origin, '/auth/v1/settings'), controller.signal, {
      apikey: anonKey ?? '',
    })) as { external?: Record<string, boolean> };
    const enabled = Object.entries(settings.external ?? {})
      .filter(([, on]) => on)
      .map(([id]) => id);
    return { providers: enabled.filter((id) => id !== 'email' && id !== 'phone') };
  } catch (e) {
    const err = e as { name?: string; status?: number };
    const reason =
      err.name === 'AbortError' ? 'timeout' : typeof err.status === 'number' ? `HTTP ${err.status}` : 'network';
    return { providers: [], error: reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Re-reads just the provider list, keeping the already-resolved instance. */
export async function refreshProviders(instance: InstanceInfo, opts: { demo?: boolean } = {}): Promise<InstanceInfo> {
  if (opts.demo || instance.demo) return instance;
  const { providers, error } = await fetchProviders(instance.supabaseUrl, instance.supabaseAnonKey);
  return { ...instance, providers, providersError: error };
}

export async function discoverInstance(rawHost: string, opts: { demo?: boolean } = {}): Promise<DiscoveryResult> {
  let host: string;
  try {
    host = normalizeHost(rawHost);
  } catch {
    return { ok: false, error: { kind: 'bad-host', message: 'That does not look like an instance address' } };
  }

  if (opts.demo) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, instance: demoInstance(host) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = (await getJson(endpoint(host, '/api/federation/instance-info'), controller.signal)) as Record<
      string,
      unknown
    >;
    if (!looksLikeHarmony(body)) {
      return { ok: false, error: { kind: 'not-harmony', message: `${host} does not answer as Harmony` } };
    }
    const { providers, error: providersError } = await fetchProviders(body.supabaseUrl as string, body.supabaseAnonKey as string);
    return { ok: true, instance: instanceFromInfo(body, host, providers, providersError) };
  } catch (e) {
    const err = e as { name?: string; status?: number; message?: string };
    if (err.name === 'AbortError') {
      return { ok: false, error: { kind: 'timeout', message: `Could not reach the instance: timeout` } };
    }
    if (typeof err.status === 'number') {
      // Content type is not enough: a 200 with an SPA fallback would also land here.
      return {
        ok: false,
        error: {
          kind: 'http',
          status: err.status,
          message: `Could not reach the instance: ${err.status} ${err.status === 403 ? 'Forbidden' : err.status === 404 ? 'Not Found' : 'Error'}`,
        },
      };
    }
    // fetch() cannot distinguish DNS failure, TLS failure and a CORS refusal.
    return {
      ok: false,
      error: {
        kind: 'network',
        message: `Could not reach the instance: ${host}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The host whose build this is, if any.
 *
 * When Timbre replaces the official web frontend the instance *is* the origin in the address
 * bar, and asking the user to type it is a bug. In the Tauri shell and on a dev server the
 * origin belongs to the app, not to an instance, so those are excluded.
 */
export function instanceHostFromLocation(loc: Location = location): string | null {
  if (loc.protocol === 'tauri:' || loc.protocol === 'file:') return null;
  const host = loc.hostname.toLowerCase();
  if (!host || host === 'localhost' || host === 'tauri.localhost' || /^[\d.]+$/.test(host)) return null;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

/**
 * Resolves the instance this page is served from, over a same-origin request (no CORS, no
 * proxy). Returns null when the page is not served by an instance — the caller then shows the
 * address form as before.
 */
export async function discoverHere(): Promise<InstanceInfo | null> {
  const host = instanceHostFromLocation();
  if (!host) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = (await getJson('/api/federation/instance-info', controller.signal)) as Record<string, unknown>;
    if (!looksLikeHarmony(body)) return null;
    const { providers, error } = await fetchProviders(body.supabaseUrl as string, body.supabaseAnonKey as string);
    return { ...instanceFromInfo(body, host, providers, error), selfHosted: true };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
