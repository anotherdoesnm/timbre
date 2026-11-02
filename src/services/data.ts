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

/**
 * `messages.content` is jsonb: a string, an array of parts, or an object with a text field.
 * Anything else is shown as compact JSON rather than `[object Object]`.
 */
export interface RenderedContent {
  text: string;
  images: string[];
}

/** Splits a jsonb message body into its text and its attachments. */
export function renderContentParts(content: unknown): RenderedContent {
  const parts = Array.isArray(content) ? content : content ? [content] : [];
  const texts: string[] = [];
  const images: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      texts.push(part);
      continue;
    }
    if (!part || typeof part !== 'object') continue;
    const o = part as Record<string, unknown>;
    const type = String(o.type ?? '');
    if (typeof o.url === 'string' && (type.includes('image') || type.includes('media') || type.includes('file'))) {
      images.push(o.url);
      continue;
    }
    if (typeof o.text === 'string') {
      texts.push(o.text);
      continue;
    }
    if (typeof o.content === 'string') {
      texts.push(o.content);
    }
  }
  return { text: texts.join(''), images };
}

export function renderContent(content: unknown): string {
  const fromPart = (part: unknown): string => {
    if (typeof part === 'string') return part;
    if (part && typeof part === 'object') {
      const o = part as Record<string, unknown>;
      for (const key of ['text', 'content', 'value', 'body']) {
        if (typeof o[key] === 'string') return o[key] as string;
      }
      if (Array.isArray(o.parts)) return o.parts.map(fromPart).join('');
    }
    return '';
  };
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(fromPart).filter(Boolean).join('');
  if (content && typeof content === 'object') {
    const text = fromPart(content);
    if (text) return text;
    return JSON.stringify(content).slice(0, 400);
  }
  return '';
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
  const seen = new Set<string>();
  return rows
    .map((r) => r.server as Row | null)
    .filter((s): s is Row => !!s)
    .filter((s) => {
      const id = String(s.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
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
  const [rows, categories] = await Promise.all([
    rest<Row[]>(
      session,
      'channels',
      `server_id=eq.${encodeURIComponent(serverId)}&select=id,name,type,category&order=category.asc`
    ),
    rest<Row[]>(
      session,
      'channel_categories',
      `server_id=eq.${encodeURIComponent(serverId)}&select=id,name,order&order=order.asc`
    ).catch(() => [] as Row[]),
  ]);
  const names = new Map(categories.map((c) => [String(c.id), String(c.name ?? 'Channels')]));
  return rows.map((c) => ({
    id: String(c.id),
    name: String(c.name ?? 'channel'),
    kind: String(c.type).toLowerCase().includes('voice') || c.type === 1 ? 'voice' : 'text',
    // Without the join a category id would be printed as a UUID heading.
    category: names.get(String(c.category)) ?? 'Channels',
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
    // `content` is jsonb and the table enforces it with a check constraint
    // (messages_content_is_array): a plain string is rejected with 23514.
    body: JSON.stringify({
      channel_id: channelId,
      user_id: userId,
      content: [{ type: 'text', text: content }],
    }),
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
      '&select=id,created_at,content,encrypted,user_id,is_system,metadata'
  );

  // String(null) is "null", which made the in.(...) list invalid and the request 400 — the
  // catch below then returned no profiles and every author became "unknown".
  // System messages ("has joined the server") carry the actor in metadata.subject_id, not in
  // user_id, so both have to be resolved or the line says nothing about who joined.
  const subjectOf = (m: Row): string | null => {
    const meta = (m.metadata ?? null) as Record<string, unknown> | null;
    const id = meta && typeof meta.subject_id === 'string' ? meta.subject_id : null;
    return id;
  };
  const ids = [
    ...new Set(
      rows
        .flatMap((m) => [m.user_id, subjectOf(m)])
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const list = ids.map(encodeURIComponent).join(',');
  // `messages.user_id` may point at profiles.id or at the auth user id; asking for both in
  // one round trip removes the guess (and the guess was wrong: every author was "unknown").
  const profiles: Row[] = ids.length
    ? await rest<Row[]>(
        session,
        'profiles',
        `or=(id.in.(${list}),auth_user_id.in.(${list}))` +
          '&select=id,auth_user_id,username,display_name,color,is_admin,is_moderator'
      ).catch(() => [] as Row[])
    : [];
  const byId = new Map<string, Row>();
  for (const p of profiles) {
    byId.set(String(p.id), p);
    if (p.auth_user_id) byId.set(String(p.auth_user_id), p);
  }

  let prevAuthor = '';
  let prevTime = 0;
  return rows.map((m) => {
    const system = m.is_system === true;
    const author = toAuthor(byId.get(String(m.user_id)) ?? { username: system ? 'system' : 'unknown' });
    const at = new Date(String(m.created_at));
    const ms = at.getTime();
    const grouped = author.name === prevAuthor && ms - prevTime < 5 * 60 * 1000;
    prevAuthor = author.name;
    prevTime = ms;
    const parts = m.encrypted
      ? { text: 'Encrypted message — no keys on this device', images: [] as string[] }
      : renderContentParts(m.content);
    return {
      id: String(m.id),
      author,
      time: at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      text: system ? `${byId.get(String(subjectOf(m)))?.display_name ?? byId.get(String(subjectOf(m)))?.username ?? ''} ${parts.text}`.trim() : parts.text,
      images: parts.images,
      system,
      grouped: system ? false : grouped,
    } satisfies Message;
  });
}
