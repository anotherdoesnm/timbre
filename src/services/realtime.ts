/**
 * Live updates over the instance's Realtime websocket.
 *
 * Harmony publishes through Realtime's *broadcast* path, not Postgres CDC: triggers write rows
 * into `realtime.messages` and Realtime fans them out. Measured topics on a live instance:
 *
 *   channel-messages-<channelId>   event `message_event`   payload {op, new, old}
 *   server-structure:<serverId>    event `server_event`
 *   server-presence:<serverId>     presence
 *
 * The channel has to be opened with `config.private = true` and the user's token; opened as a
 * public channel it subscribes and then delivers nothing. That is exactly what upstream does —
 * `supabase.channel(topic, { config: { private: true } })` in their stores — and doing it by
 * hand was only ever a stopgap: `@supabase/realtime-js` is the client behind supabase-js, and
 * it already speaks this protocol, keeps the socket alive and rejoins after a drop.
 */
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
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

export interface Subscription {
  close(): void;
}

function clientFor(session: Session): RealtimeClient {
  const client = new RealtimeClient(`${session.supabaseUrl}/realtime/v1`, {
    params: { apikey: session.anonKey },
    // The socket authenticates with the user's JWT, which is what the row level policies on
    // realtime.messages are checked against.
    accessToken: async () => session.accessToken,
    heartbeatIntervalMs: 25_000,
  });
  client.connect();
  return client;
}

/** New, edited and deleted messages in one channel. */
export function subscribeChannelMessages(
  session: Session,
  channelId: string,
  onEvent: (event: MessageEvent) => void
): Subscription {
  const client = clientFor(session);
  const channel: RealtimeChannel = client.channel(`channel-messages-${channelId}`, {
    config: { private: true, broadcast: { self: true } },
  });

  channel
    .on('broadcast', { event: 'message_event' }, (message) => {
      const payload = (message?.payload ?? {}) as { op?: string; new?: MessageRow; old?: MessageRow };
      const record = payload.new ?? payload.old;
      if (!record) return;
      const op = payload.op === 'UPDATE' || payload.op === 'DELETE' ? payload.op : 'INSERT';
      onEvent({ op, record });
    })
    .subscribe();

  return {
    close() {
      try {
        client.removeChannel(channel);
      } catch {
        /* already gone */
      }
      try {
        client.disconnect();
      } catch {
        /* already gone */
      }
    },
  };
}
