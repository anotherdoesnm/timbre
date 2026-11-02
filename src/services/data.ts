/** Live Harmony data, mapped onto the shapes the components already render. */

import { authUserId, rest } from './api';
import type { Session } from './auth';
import type { Author, Channel, Message, Server } from '../data/mock';

interface Row {
  [key: string]: unknown;
}

const COLORS = ['#bdb6ec', '#85e0ba', '#e3ba91', '#e69d9d', '#9dc4e6', '#d7b3e6', '#b9e6a9', '#e6d79d'];

function colorFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function toAuthor(row: Row): Author {
  const name = String(row.display_name || row.username || 'unknown');
  return {
    name,
    initial: name.slice(0, 1).toUpperCase(),
    color: typeof row.color === 'string' && row.color ? row.color : colorFor(name),
    role: row.is_admin ? 'admin' : row.is_moderator ? 'mod' : null,
  };
}

export async function fetchMe(session: Session): Promise<Row | null> {
  const sub = authUserId(session.accessToken);
  if (!sub) return null;
  const rows = await rest<Row[]>(
    session,
    'profiles',
    `auth_user_id=eq.${encodeURIComponent(sub)}&select=id,username,display_name,avatar_url,color,is_admin,is_moderator&limit=1`
  );
  return rows[0] ?? null;
}

export async function fetchServers(session: Session, profileId: string): Promise<Server[]> {
  const rows = await rest<Row[]>(
    session,
    'user_servers',
    `user_id=eq.${encodeURIComponent(profileId)}&select=position,server:servers(id,name,icon,member_count)&order=position.asc`
  );
  return rows
    .map((r) => r.server as Row | null)
    .filter((s): s is Row => !!s)
    .map((s, i) => {
      const name = String(s.name ?? 'server');
      return {
        id: String(s.id),
        name,
        short: name.slice(0, 2).toUpperCase(),
        color: colorFor(name),
        unread: 0,
        _position: i,
      } as Server;
    });
}

export async function fetchChannels(session: Session, serverId: string): Promise<Channel[]> {
  const rows = await rest<Row[]>(
    session,
    'channels',
    `server_id=eq.${encodeURIComponent(serverId)}&select=id,name,type,category&order=category.asc`
  );
  return rows.map((c) => ({
    id: String(c.id),
    name: String(c.name ?? 'channel'),
    kind: String(c.type).toLowerCase().includes('voice') || c.type === 1 ? 'voice' : 'text',
    category: String(c.category ?? 'Text channels'),
    unread: 0,
  }));
}

/**
 * Posts a message. Harmony keeps the insert on the table (row level security decides), and
 * a refusal comes back as a PostgREST error rather than a silent no-op, which is why the
 * body is returned as-is instead of being assumed.
 */
export async function sendMessage(
  session: Session,
  channelId: string,
  userId: string,
  content: string
): Promise<void> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ channel_id: channelId, user_id: userId, content }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`send: ${res.status} ${body.slice(0, 200)}`);
  }
}

export async function fetchMessages(session: Session, channelId: string): Promise<Message[]> {
  const rows = await rest<Row[]>(
    session,
    'messages',
    `channel_id=eq.${encodeURIComponent(channelId)}` +
      '&is_deleted=eq.false&order=created_at.asc&limit=80' +
      '&select=id,created_at,content,encrypted,user_id,author:profiles!messages_user_id_fkey(username,display_name,color,is_admin,is_moderator)'
  );

  let prevAuthor = '';
  let prevTime = 0;
  return rows.map((m) => {
    const author = toAuthor((m.author as Row) ?? {});
    const at = new Date(String(m.created_at));
    const ms = at.getTime();
    const grouped = author.name === prevAuthor && ms - prevTime < 5 * 60 * 1000;
    prevAuthor = author.name;
    prevTime = ms;
    return {
      id: String(m.id),
      author,
      time: at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      text: m.encrypted ? 'Encrypted message — no keys on this device' : String(m.content ?? ''),
      grouped,
    } satisfies Message;
  });
}
