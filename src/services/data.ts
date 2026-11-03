/** Live Harmony data, mapped onto the shapes the components already render. */

import { authUserId, rest, rpc } from './api';
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
    avatarUrl: typeof row.avatar_url === 'string' && row.avatar_url ? row.avatar_url : undefined,
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
  content: string,
  replyToId?: string | null
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
      ...(replyToId ? { reply_to: replyToId } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`send: ${res.status} ${body.slice(0, 200)}`);
  }
}

export interface MessagePage {
  messages: Message[];
  /** Oldest timestamp in this page — the cursor for loading further back. */
  oldest: string | null;
  hasMore: boolean;
}

/**
 * One page of a channel: newest first from the API, oldest first in the result.
 *
 * The query used to ask for `order=created_at.asc` with a limit, which returns the *oldest*
 * messages of the channel rather than the newest — invisible on a short channel, wrong on
 * every real one.
 */
export async function fetchMessages(
  session: Session,
  channelId: string,
  opts: { limit?: number; before?: string } = {}
): Promise<MessagePage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = await rest<Row[]>(
    session,
    'messages',
    `channel_id=eq.${encodeURIComponent(channelId)}` +
      '&is_deleted=eq.false' +
      `&order=created_at.desc&limit=${limit}` +
      (opts.before ? `&created_at=lt.${encodeURIComponent(opts.before)}` : '') +
      '&select=id,created_at,content,encrypted,user_id,is_system,metadata,reply_to'
  );
  rows.reverse();

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
          '&select=id,auth_user_id,username,display_name,color,avatar_url,is_admin,is_moderator'
      ).catch(() => [] as Row[])
    : [];
  const byId = new Map<string, Row>();
  for (const p of profiles) {
    byId.set(String(p.id), p);
    if (p.auth_user_id) byId.set(String(p.auth_user_id), p);
  }

  // A reply carries `reply_to`; the parent is usually in the same page, but not when it is
  // older than the page — so missing ones are fetched once, by id, in a single query.
  const parentIds = [
    ...new Set(
      rows.map((m) => (typeof m.reply_to === 'string' ? m.reply_to : null)).filter((id): id is string => !!id)
    ),
  ];
  const missing = parentIds.filter((id) => !rows.some((r) => String(r.id) === id));
  const parentsOnly = new Set<string>();
  if (missing.length) {
    const extra = await rest<Row[]>(
      session,
      'messages',
      `id=in.(${missing.map(encodeURIComponent).join(',')})&select=id,content,user_id`
    ).catch(() => [] as Row[]);
    for (const parent of extra) {
      parentsOnly.add(String(parent.id));
      rows.push(parent);
    }
  }
  const parents = new Map<string, Row>();
  for (const row of rows) parents.set(String(row.id), row);

  const quoteOf = (m: Row): Message['replyTo'] | undefined => {
    const id = typeof m.reply_to === 'string' ? m.reply_to : null;
    if (!id) return undefined;
    const parent = parents.get(id);
    if (!parent) return { id, author: 'unknown', text: '(message not available)' };
    const parts = renderContentParts(parent.content);
    const author = toAuthor(byId.get(String(parent.user_id)) ?? { username: 'unknown' });
    return { id, author: author.name, text: parts.text.slice(0, 160) };
  };

  // Parents added above are only there for quoting; they are not part of the page.
  const visible = rows.filter((m) => !parentsOnly.has(String(m.id)));

  let prevAuthor = '';
  let prevTime = 0;
  const messages = visible.map((m) => {
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
      replyTo: quoteOf(m),
    } satisfies Message;
  });

  return {
    messages,
    oldest: visible.length ? String(visible[0].created_at) : null,
    // A full page usually means there is more behind it; a short one is the start of history.
    hasMore: visible.length === limit,
  };
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

/**
 * Reactions for a page of messages, in one call (`get_batch_message_reactions`), not one per
 * message. The instance stores native emoji in `custom_emoji_content` and custom ones in
 * `emoji_name`/`emoji_url`; both collapse to a single string here.
 */
export async function fetchReactions(
  session: Session,
  messageIds: string[]
): Promise<Record<string, ReactionSummary[]>> {
  if (!messageIds.length) return {};
  let rows: {
    message_id: string;
    emoji_name: string | null;
    custom_emoji_content: string | null;
    reaction_count: number | null;
    current_user_reacted: boolean | null;
  }[] = [];
  try {
    rows = await rpc(session, 'get_batch_message_reactions', { message_ids: messageIds });
  } catch {
    return {};
  }
  const out: Record<string, ReactionSummary[]> = {};
  for (const row of rows) {
    const emoji = row.custom_emoji_content || row.emoji_name || '';
    if (!emoji || !row.message_id) continue;
    (out[row.message_id] ??= []).push({
      emoji,
      count: Number(row.reaction_count ?? 0),
      mine: row.current_user_reacted === true,
    });
  }
  return out;
}

async function removeReaction(session: Session, messageId: string, userId: string, emoji: string): Promise<void> {
  const query =
    `message_id=eq.${encodeURIComponent(messageId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&custom_emoji_content=eq.${encodeURIComponent(emoji)}`;
  const res = await fetch(`${session.supabaseUrl}/rest/v1/reactions?${query}`, {
    method: 'DELETE',
    headers: { apikey: session.anonKey, Authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok) throw new Error(`reaction: ${res.status}`);
}

/** Adds the reaction if it is not there yet, removes it otherwise. */
export async function toggleReaction(
  session: Session,
  messageId: string,
  channelId: string,
  userId: string,
  emoji: string,
  remove: boolean
): Promise<void> {
  if (remove) {
    await removeReaction(session, messageId, userId, emoji);
    return;
  }
  const res = await fetch(`${session.supabaseUrl}/rest/v1/reactions`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ message_id: messageId, channel_id: channelId, user_id: userId, custom_emoji_content: emoji }),
  });
  // 409 is reactions_message_user_emoji_key: the reaction was already there even though the
  // chip said otherwise (it was set from another device). The tap means "toggle", so the
  // second half of the toggle is to take it away.
  if (res.status === 409) {
    await removeReaction(session, messageId, userId, emoji);
    return;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`reaction: ${res.status} ${body.slice(0, 120)}`);
  }
}

export interface UnreadState {
  channelId: string;
  unread: number;
  mentions: number;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

/** Per-channel unread counters, straight from the instance's own accounting. */
export async function fetchUnreadCounts(session: Session): Promise<Record<string, UnreadState>> {
  let rows: {
    channel_id: string | null;
    unread_messages: number | null;
    unread_mentions: number | null;
    last_read_at: string | null;
    last_read_message_id: string | null;
  }[] = [];
  try {
    rows = await rpc(session, 'get_unread_counts', {});
  } catch {
    return {};
  }
  const out: Record<string, UnreadState> = {};
  for (const row of rows) {
    if (!row.channel_id) continue;
    out[row.channel_id] = {
      channelId: row.channel_id,
      unread: Number(row.unread_messages ?? 0),
      mentions: Number(row.unread_mentions ?? 0),
      lastReadAt: row.last_read_at,
      lastReadMessageId: row.last_read_message_id,
    };
  }
  return out;
}

/** Moves the read cursor; the instance recomputes the counters from it. */
export async function markChannelRead(session: Session, channelId: string, messageId?: string | null): Promise<void> {
  try {
    await rpc(session, 'mark_channel_as_read', { p_channel_id: channelId, p_message_id: messageId ?? null });
  } catch {
    /* an unread counter is not worth breaking the screen over */
  }
}
