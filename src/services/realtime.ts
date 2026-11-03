/**
 * Live updates over the instance's Realtime websocket.
 *
 * Harmony does not use Postgres CDC: triggers write rows into `realtime.messages` and Realtime
 * broadcasts them. Verified against a live instance — the topics are
 *
 *   channel-messages-<channelId>   event `message_event`   payload {op, new, old}
 *   server-structure:<serverId>    event `server_event`
 *   server-presence:<serverId>     presence
 *
 * A topic is joined as a *private* channel (`config.private = true`) with the user's JWT:
 * joined as a public one it answers `ok` and then delivers nothing, which took a probe to
 * discover. The protocol is Phoenix channels, so this is a small amount of JSON over one
 * socket rather than a library.
 */
import type { Session } from './auth';

export interface MessageRow {
  id: string;
  channel_id: string | null;
  user_id: string | null;
  content: unknown;
  created_at: string;
  is_deleted?: boolean;
  is_system?: boolean;
}

export interface MessageEvent {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  record: MessageRow;
}

const HEARTBEAT_MS = 25_000;
const RECONNECT_MS = [1_000, 2_000, 5_000, 10_000, 20_000];

function socketUrl(session: Session): string {
  const url = new URL(session.supabaseUrl);
  const scheme = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return `${scheme}//${url.host}/realtime/v1/websocket?apikey=${encodeURIComponent(session.anonKey)}&vsn=1.0.0`;
}

interface Subscription {
  close(): void;
}

function subscribe(
  session: Session,
  topic: string,
  event: string,
  onMessage: (payload: Record<string, unknown>) => void
): Subscription {
  let ws: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closed = false;
  let ref = 0;

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* already gone */
      }
      ws = null;
    }
  };

  const open = () => {
    if (closed) return;
    const socket = new WebSocket(socketUrl(session));
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      socket.send(
        JSON.stringify({
          topic: `realtime:${topic}`,
          event: 'phx_join',
          payload: { config: { private: true, broadcast: { self: true, ack: false } }, access_token: session.accessToken },
          ref: String(++ref),
          join_ref: String(ref),
        })
      );
      heartbeat = setInterval(() => {
        try {
          socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }));
        } catch {
          /* the close handler will reconnect */
        }
      }, HEARTBEAT_MS);
    };

    socket.onmessage = (raw) => {
      let message: { event?: string; payload?: Record<string, unknown> };
      try {
        message = JSON.parse(String(raw.data));
      } catch {
        return;
      }
      if (message.event !== 'broadcast') return;
      const payload = (message.payload ?? {}) as { event?: string; payload?: Record<string, unknown> };
      if (payload.event !== event) return;
      try {
        onMessage(payload.payload ?? {});
      } catch {
        /* a broken handler must not kill the socket */
      }
    };

    socket.onclose = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      if (closed) return;
      const wait = RECONNECT_MS[Math.min(attempt++, RECONNECT_MS.length - 1)];
      retryTimer = setTimeout(open, wait);
    };
  };

  open();

  return {
    close() {
      closed = true;
      cleanup();
    },
  };
}

/** New, edited and deleted messages in one channel. */
export function subscribeChannelMessages(
  session: Session,
  channelId: string,
  onEvent: (event: MessageEvent) => void
): Subscription {
  return subscribe(session, `channel-messages-${channelId}`, 'message_event', (payload) => {
    const op = payload.op === 'UPDATE' || payload.op === 'DELETE' ? payload.op : 'INSERT';
    const record = (payload.new ?? payload.old) as MessageRow | undefined;
    if (!record) return;
    onEvent({ op, record });
  });
}
