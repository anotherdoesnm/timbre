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
  emailAuth?: boolean;
  demo?: boolean;
}

export type DiscoveryFailure = {
  kind: 'http' | 'network' | 'timeout' | 'not-harmony' | 'bad-host';
  status?: number;
  message: string;
};

export type DiscoveryResult =
  | { ok: true; instance: InstanceInfo }
  | { ok: false; error: DiscoveryFailure };

const TIMEOUT_MS = 6000;

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

/** Auth providers are per instance: they come from GoTrue, not from our build. */
async function fetchProviders(supabaseUrl: string, anonKey: string, signal: AbortSignal): Promise<string[]> {
  try {
    const origin = new URL(supabaseUrl).host;
    const settings = (await getJson(endpoint(origin, '/auth/v1/settings'), signal, {
      apikey: anonKey ?? '',
    })) as {
      external?: Record<string, boolean>;
    };
    const enabled = Object.entries(settings.external ?? {})
      .filter(([, on]) => on)
      .map(([id]) => id);
    return enabled.filter((id) => id !== 'email' && id !== 'phone');
  } catch {
    return [];
  }
}

export async function discoverInstance(rawHost: string, opts: { demo?: boolean } = {}): Promise<DiscoveryResult> {
  let host: string;
  try {
    host = normalizeHost(rawHost);
  } catch {
    return { ok: false, error: { kind: 'bad-host', message: 'Похоже, это не адрес инстанса' } };
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
    if (body.success !== true || typeof body.supabaseUrl !== 'string' || typeof body.supabaseAnonKey !== 'string') {
      return { ok: false, error: { kind: 'not-harmony', message: `На ${host} не отвечает Harmony` } };
    }
    const providers = await fetchProviders(body.supabaseUrl, body.supabaseAnonKey, controller.signal);
    return {
      ok: true,
      instance: {
        origin: host,
        name: typeof body.name === 'string' && body.name ? body.name : host,
        domain: typeof body.domain === 'string' ? body.domain : undefined,
        version: typeof body.version === 'string' ? body.version : undefined,
        supabaseUrl: body.supabaseUrl,
        supabaseAnonKey: body.supabaseAnonKey,
        capabilities: Array.isArray(body.capabilities)
          ? body.capabilities.filter((c): c is string => typeof c === 'string')
          : [],
        providers,
      },
    };
  } catch (e) {
    const err = e as { name?: string; status?: number; message?: string };
    if (err.name === 'AbortError') {
      return { ok: false, error: { kind: 'timeout', message: `Не удалось подключиться к инстансу: таймаут` } };
    }
    if (typeof err.status === 'number') {
      // Content type is not enough: a 200 with an SPA fallback would also land here.
      return {
        ok: false,
        error: {
          kind: 'http',
          status: err.status,
          message: `Не удалось подключиться к инстансу: ${err.status} ${err.status === 403 ? 'Forbidden' : err.status === 404 ? 'Not Found' : 'Error'}`,
        },
      };
    }
    // fetch() cannot distinguish DNS failure, TLS failure and a CORS refusal.
    return {
      ok: false,
      error: {
        kind: 'network',
        message: `Не удалось подключиться к инстансу: ${host}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
