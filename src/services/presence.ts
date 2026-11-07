/**
 * Who is online, and who is typing.
 *
 * Presence lives in the instance, not in this client: a tab heartbeats
 * `presence_heartbeat(p_device_id, p_status, p_is_mobile)`, reads the list through `get_presence`,
 * and takes live changes from the `server-presence:<serverId>` topic. The heartbeat is what keeps a
 * person "online" — measured on a live instance, `p_status: 1` turns `get_presence` to
 * `online: true`, and the row keeps a `last_seen_at` that the instance ages out.
 */
import { rpc } from './api';
import type { Session } from './auth';

/** The instance's own codes; 0 is reserved for "offline" and cannot be heartbeated. */
export const STATUS_ONLINE = 1;
export const STATUS_AWAY = 2;
export const STATUS_BUSY = 3;
export const STATUS_INVISIBLE = 4;

export interface PresenceEntry {
  profileId: string;
  online: boolean;
  status: number;
  isMobile: boolean;
  lastSeen?: string;
}

const DEVICE_KEY = 'timbre.device-id';
let deviceId: string | null = null;

/** Per-tab id, so two tabs do not fight over one presence row (the instance keys by it). */
export function clientDeviceId(): string {
  if (deviceId) return deviceId;
  try {
    const stored = sessionStorage.getItem(DEVICE_KEY);
    if (stored) return (deviceId = stored);
  } catch {
    /* storage disabled: a fresh id per run is fine */
  }
  const fresh =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  try {
    sessionStorage.setItem(DEVICE_KEY, fresh);
  } catch {
    /* nothing to do */
  }
  return (deviceId = fresh);
}

/** Everyone in `profileIds` the instance reports as online, plus their status. */
export async function fetchPresence(
  session: Session,
  profileIds: string[]
): Promise<PresenceEntry[]> {
  const ids = [...new Set(profileIds.filter(Boolean))].slice(0, 200);
  if (!ids.length) return [];
  try {
    const rows = await rpc<
      {
        profile_id?: string;
        online?: boolean;
        status?: number;
        is_mobile?: boolean;
        last_seen_at?: string;
      }[]
    >(session, 'get_presence', { p_profile_ids: ids });
    return (rows ?? []).map((row) => ({
      profileId: String(row.profile_id ?? ''),
      online: row.online === true,
      status: typeof row.status === 'number' ? row.status : STATUS_ONLINE,
      isMobile: row.is_mobile === true,
      lastSeen: typeof row.last_seen_at === 'string' ? row.last_seen_at : undefined,
    }));
  } catch {
    return [];
  }
}

/** Tells the instance this tab is alive. Without it everybody looks offline. */
export async function heartbeat(
  session: Session,
  status: number = STATUS_ONLINE,
  isMobile = false
): Promise<void> {
  try {
    await rpc(session, 'presence_heartbeat', {
      p_device_id: clientDeviceId(),
      p_status: status,
      p_is_mobile: isMobile,
    });
  } catch {
    /* presence is not worth a banner */
  }
}

/**
 * Clears this tab's presence. Sent with `keepalive` because it runs while the page is going away,
 * where an ordinary fetch is cancelled.
 */
export function goOffline(session: Session): void {
  try {
    void fetch(`${session.supabaseUrl}/rest/v1/rpc/presence_offline`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_device_id: clientDeviceId() }),
    }).catch(() => undefined);
  } catch {
    /* the heartbeat expires by itself */
  }
}

/** A status name for the member list's tooltip. */
export function statusLabel(status: number): string {
  if (status === STATUS_AWAY) return 'Away';
  if (status === STATUS_BUSY) return 'Busy';
  if (status === STATUS_INVISIBLE) return 'Invisible';
  return 'Online';
}
