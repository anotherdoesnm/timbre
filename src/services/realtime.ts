/**
 * Live updates over the instance's Realtime websocket.
 *
 * Harmony publishes through Realtime's *broadcast* path, not Postgres CDC: triggers write rows
 * into `realtime.messages` and Realtime fans them out. Measured topics on a live instance:
 *
 *   channel-messages-<channelId>   event `message_event`   payload {op, new, old}
 *   server-structure:<serverId>    event `server_event`
 *   server-presence:<serverId>      presence
 *
 * The channel has to be opened with `config.private = true` and the user's token; opened as a
 * public channel it subscribes and then delivers nothing. That is exactly what upstream does —
 * `supabase.channel(topic, { config: { private: true } })` in their stores — and doing it by
 * hand was only ever a stopgap: `@supabase/realtime-js` is the client behind supabase-js, and
 * it already speaks this protocol, keeps the socket alive and rejoins after a drop.
 *
 * One connection carries every channel: a socket per channel wasted file descriptors and, more
 * visibly, meant nothing outside the channel being read could ever raise a notification.
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
  /** Set on an answer that lives in a thread; the channel itself only lists the parents. */
  thread_id?: string | null;
  /** `mentions` and the webhook fields live here, not in the message body. */
  metadata?: unknown;
}

export interface MessageEvent {
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  record: MessageRow;
}

export interface Subscription {
  close(): void;
}

/** A `presence_event` on `server-presence:<serverId>`: somebody came online or went away. */
export interface PresenceUpdate {
  userId: string;
  online: boolean;
  status?: number;
  isMobile?: boolean;
}

/** Who is typing in one context, as the typing channel's presence state reports it. */
export interface TypingUser {
  userId: string;
  name: string;
  at: number;
}

export interface LiveConnection {
  /** Messages of one channel. Subscribing to a channel twice is a no-op. */
  subscribe(channelId: string, onEvent: (event: MessageEvent) => void): Subscription;
  /** The same for a direct conversation, whose topic is `dm-conversation-<id>`. */
  subscribeConversation(conversationId: string, onEvent: (event: MessageEvent) => void): Subscription;
  /** Who is online in a server; the instance broadcasts this on `server-presence:<id>`. */
  subscribePresence(serverId: string, onUpdate: (update: PresenceUpdate) => void): Subscription;
  /** Typing is Realtime *presence* on `typing:<kind>:<id>`, not a broadcast. */
  subscribeTyping(
    context: { kind: 'channel' | 'conversation' | 'thread'; id: string; myId: string },
    onUsers: (users: TypingUser[]) => void
  ): Subscription;
  /** Says "I am typing" in a context; the payload is what other clients read. */
  trackTyping(
    context: { kind: 'channel' | 'conversation' | 'thread'; id: string },
    payload: { userId: string; name: string }
  ): void;
  clearTyping(context: { kind: 'channel' | 'conversation' | 'thread'; id: string }): void;
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

export function connectRealtime(session: Session): LiveConnection {
  const client = clientFor(session);
  const open = new Map<string, RealtimeChannel>();

  /** One implementation for both: only the topic prefix and the key differ. */
  function subscribeTopic(
    key: string,
    topic: string,
    onEvent: (event: MessageEvent) => void
  ): Subscription {
    if (!key) return { close() {} };
    if (open.has(key)) return { close() {} };

      const channel: RealtimeChannel = client.channel(topic, {
        config: { private: true, broadcast: { self: true } },
      });
      channel
        .on('broadcast', { event: 'message_event' }, (message) => {
          const payload = (message?.payload ?? {}) as {
            op?: string;
            new?: MessageRow;
            old?: MessageRow;
          };
          const record = payload.new ?? payload.old;
          if (!record) return;
          const op = payload.op === 'UPDATE' || payload.op === 'DELETE' ? payload.op : 'INSERT';
          onEvent({ op, record });
        })
        .subscribe();

      open.set(key, channel);
      return {
        close() {
          open.delete(key);
          try {
            client.removeChannel(channel);
          } catch {
            /* already gone */
          }
        },
      };
  }

  const typing = new Map<string, RealtimeChannel>();
  const typingKey = (c: { kind: string; id: string }): string => `typing:${c.kind}:${c.id}`;

  return {
    subscribe(channelId, onEvent) {
      return subscribeTopic(channelId, `channel-messages-${channelId}`, onEvent);
    },
    subscribeConversation(conversationId, onEvent) {
      return subscribeTopic(conversationId, `dm-conversation-${conversationId}`, onEvent);
    },

    subscribePresence(serverId, onUpdate) {
      if (!serverId) return { close() {} };
      const key = `presence:${serverId}`;
      if (open.has(key)) return { close() {} };
      const channel = client.channel(`server-presence:${serverId}`, {
        config: { private: true },
      });
      channel
        .on('broadcast', { event: 'presence_event' }, (message) => {
          const payload = (message?.payload ?? {}) as {
            type?: string;
            user_id?: string;
            online?: boolean;
            status?: number;
            is_mobile?: boolean;
          };
          if (payload.type !== 'presence:update' || !payload.user_id) return;
          onUpdate({
            userId: String(payload.user_id),
            online: payload.online === true,
            status: typeof payload.status === 'number' ? payload.status : undefined,
            isMobile: payload.is_mobile === true,
          });
        })
        .subscribe();
      open.set(key, channel);
      return {
        close() {
          open.delete(key);
          try {
            client.removeChannel(channel);
          } catch {
            /* already gone */
          }
        },
      };
    },

    subscribeTyping(context, onUsers) {
      const key = typingKey(context);
      if (!context.id) return { close() {} };
      if (typing.has(key)) return { close() {} };
      const channel = client.channel(key, { config: { private: true, presence: { key: context.myId } } });
      const read = (): void => {
        const state = channel.presenceState() as Record<string, { userId?: string; name?: string; at?: number }[]>;
        const now = Date.now();
        const users: TypingUser[] = [];
        for (const [presenceKey, metas] of Object.entries(state)) {
          for (const meta of metas ?? []) {
            const userId = meta.userId ?? presenceKey;
            if (userId === context.myId) continue;
            // A typer who closed the tab never sends "stopped": the timestamp is the only thing
            // that clears them, so anything older than a few seconds is ignored.
            if (!meta.at || now - meta.at > 6000) continue;
            users.push({ userId, name: meta.name ?? '', at: meta.at });
          }
        }
        onUsers(users);
      };
      channel.on('presence', { event: 'sync' }, read).subscribe((status) => {
        if (status === 'SUBSCRIBED') read();
      });
      typing.set(key, channel);
      const sweeper = setInterval(read, 1500);
      return {
        close() {
          clearInterval(sweeper);
          typing.delete(key);
          try {
            client.removeChannel(channel);
          } catch {
            /* already gone */
          }
        },
      };
    },

    trackTyping(context, payload) {
      const key = typingKey(context);
      const channel = typing.get(key);
      if (!channel) return;
      void channel.track({ userId: payload.userId, name: payload.name, at: Date.now() });
    },

    clearTyping(context) {
      const channel = typing.get(typingKey(context));
      if (!channel) return;
      void channel.untrack();
    },

    close() {
      for (const channel of typing.values()) {
        try {
          client.removeChannel(channel);
        } catch {
          /* already gone */
        }
      }
      typing.clear();
      for (const channel of open.values()) {
        try {
          client.removeChannel(channel);
        } catch {
          /* already gone */
        }
      }
      open.clear();
      try {
        client.disconnect();
      } catch {
        /* already gone */
      }
    },
  };
}
