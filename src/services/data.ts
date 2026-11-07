/** Live Harmony data, mapped onto the shapes the components already render. */

import { authUserId, rest, rpc } from './api';
import type { Session } from './auth';
import { describeDevice } from './notify';
import type { CustomEmoji } from './emoji';
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
export interface RenderedEmoji {
  name: string;
  url?: string;
  id?: string;
}

export interface RenderedContent {
  text: string;
  images: string[];
  /** Emoji the message itself names, with the picture it shipped. */
  emojis: RenderedEmoji[];
}

/** Splits a jsonb message body into its text and its attachments. */
export function renderContentParts(content: unknown): RenderedContent {
  const parts = Array.isArray(content) ? content : content ? [content] : [];
  const texts: string[] = [];
  const images: string[] = [];
  // The parts name their own emoji with a picture and an id; dropping that and re-resolving the name
  // against this person's packs is how a foreign pack's emoji came out as `:RIP:` text.
  const emojis: RenderedEmoji[] = [];
  /** Set once a poll part was seen: the text that follows is its fallback, not a message. */
  let hasPoll = false;
  for (const part of parts) {
    if (typeof part === 'string') {
      texts.push(part);
      continue;
    }
    if (!part || typeof part !== 'object') continue;
    const o = part as Record<string, unknown>;
    const type = String(o.type ?? '');
    // A mention is a part of its own — `{type:'mention', username, domain, userId}` — with no
    // `text`, so a message that is only a mention rendered as an empty bubble: the @name was
    // there in the official client and simply absent here.
    if (type === 'mention') {
      const handle = typeof o.username === 'string' ? o.username : typeof o.name === 'string' ? o.name : '';
      if (handle) texts.push(`@${handle}`);
      continue;
    }
    // The rest of Harmony's structural parts carry no `text` either, and dropping them made whole
    // messages look empty: a bare link, a custom emoji, a `#channel` pointer.
    if (type === 'channel_mention') {
      if (typeof o.name === 'string' && o.name) texts.push(`#${o.name}`);
      continue;
    }
    if (type === 'emoji') {
      const emoji = (o.emoji ?? {}) as Record<string, unknown>;
      const name = typeof emoji.name === 'string' ? emoji.name : '';
      if (name) {
        texts.push(`:${name}:`);
        emojis.push({
          name,
          url: typeof emoji.url === 'string' ? emoji.url : undefined,
          id: typeof emoji.id === 'string' ? emoji.id : undefined,
        });
      }
      continue;
    }
    if (type === 'url' && typeof o.url === 'string' && o.url) {
      texts.push(o.url);
      continue;
    }
    // A sticker is an image with a name (`{id, url, name, width, height}`, shipped in 1.9.2). It
    // renders like any other picture here rather than as the empty bubble an unhandled type leaves.
    // A poll part is followed by a plain-text copy of the same question and answers
    // (`📊 <question>\n1. …`), written for clients that do not render polls. The card shows it, so
    // the fallback is dropped — matched by its marker, since that is the only thing distinguishing
    // it from a message somebody typed.
    if (type === 'poll') {
      hasPoll = true;
      continue;
    }
    if (hasPoll && type === 'text' && typeof o.text === 'string' && o.text.startsWith('📊 ')) continue;
    if (type === 'sticker' && typeof o.url === 'string' && o.url) {
      images.push(o.url);
      continue;
    }
    // A part with a `path` is re-signed by the caller (links expire); one without a path only has
    // its URL to go on.
    if (
      typeof o.url === 'string' &&
      typeof o.path !== 'string' &&
      (type.includes('image') || type.includes('media') || type.includes('file'))
    ) {
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
  // Whatever Harmony ships next, a message must not arrive as an empty bubble: the parts this
  // client does not know are exactly the ones a user cannot report as "invisible". An attachment
  // is the exception — it carries `path` and no text by design, and the caller signs it into an
  // image afterwards, so the placeholder would land on top of a perfectly good picture.
  const hasAttachment = parts.some(
    (part) => part && typeof part === 'object' && (part as { type?: unknown }).type === 'file'
  );
  if (!texts.length && !images.length && parts.length && !hasAttachment) {
    texts.push('[unsupported message content]');
  }
  return { text: texts.join(''), images, emojis };
}

export interface FilePart {
  path: string;
  name: string;
  contentType: string;
  size?: number;
}

export function fileParts(content: unknown): FilePart[] {
  const parts = Array.isArray(content) ? content : [];
  const out: FilePart[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const o = part as Record<string, unknown>;
    if (o.type !== 'file' || typeof o.path !== 'string') continue;
    // Two shapes exist in the wild: Harmony's own client writes `fileName`/`fileType`/`fileSize`,
    // this client used to write `name`/`contentType`/`size`. Read both, canonical first.
    const name =
      (typeof o.fileName === 'string' && o.fileName) ||
      (typeof o.name === 'string' && o.name) ||
      (o.path.split('/').pop() ?? 'file');
    const kind = typeof o.fileType === 'string' ? o.fileType : '';
    const mime = typeof o.mime_type === 'string' ? o.mime_type : typeof o.mimeType === 'string' ? o.mimeType : '';
    const contentType = mime
      ? mime
      : kind.includes('/')
        ? kind
        : kind
          ? `${kind}/`
          : typeof o.contentType === 'string'
            ? o.contentType
            : 'application/octet-stream';
    out.push({
      path: o.path,
      name,
      contentType,
      size:
        typeof o.fileSize === 'number'
          ? o.fileSize
          : typeof o.size === 'number'
            ? o.size
            : undefined,
    });
  }
  return out;
}

export function renderContent(content: unknown): string {
  const fromPart = (part: unknown): string => {
    if (typeof part === 'string') return part;
    if (part && typeof part === 'object') {
      const o = part as Record<string, unknown>;
      const kind = String(o.type ?? '');
      if (kind === 'mention') {
        const handle = typeof o.username === 'string' ? o.username : typeof o.name === 'string' ? o.name : '';
        if (handle) return `@${handle}`;
      }
      if (kind === 'channel_mention' && typeof o.name === 'string' && o.name) return `#${o.name}`;
      if (kind === 'emoji') {
        const emoji = (o.emoji ?? {}) as Record<string, unknown>;
        if (typeof emoji.name === 'string' && emoji.name) return `:${emoji.name}:`;
      }
      if (kind === 'url' && typeof o.url === 'string') return o.url;
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

/** Where a relative path can point: the instance's own files, or its storage API. */
type Origin = { instance: string; supabaseUrl: string };

/**
 * `profiles.avatar_url` has three shapes on a real instance, and each one resolves against a
 * different host:
 *
 *   `https://holos.social/media/avatars/…jpg`  a federated user, already absolute
 *   `/default_avatar.webp`                     a file on the instance itself
 *   `f930af28-…/toothy.png`                    a bare object path in the `avatars` bucket
 *
 * The last shape has no leading slash, so the earlier check dropped it and those authors fell
 * back to initials while their picture sat in storage one host away. Resolving the relative
 * case against the page is what made the APK differ from the browser: inside the shell the
 * page is `tauri.localhost`, which serves no such file.
 */
/**
 * A server's picture. Servers keep theirs in the `server_icons` bucket — not `avatars`, which is
 * where a naive reuse of `avatarUrl` sends it, and a 400 from storage is what that looks like on
 * screen.
 */
export function serverIconUrl(icon: unknown, at: Origin): string | undefined {
  if (typeof icon !== 'string' || !icon) return undefined;
  // A path to a bundled default is not an icon: older rows still carry these sentinels, and asking
  // a storage bucket for `/default_server_icon.png` is a 404 that renders as a broken image.
  if (/^\/?(default_server_icon|default_server|default_avatar)\.(png|webp)$/i.test(icon)) return undefined;
  if (/^https?:\/\//i.test(icon)) return icon;
  if (icon.startsWith('/')) return `https://${at.instance}${icon}`;
  if (!/^[\w-]+\/[\w./-]+\.(png|jpe?g|webp|gif|avif)$/i.test(icon)) return undefined;
  return `${at.supabaseUrl}/storage/v1/render/image/public/server_icons/${icon}?width=96&height=96&resize=cover&quality=80`;
}

export function avatarUrl(url: unknown, at: Origin): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `https://${at.instance}${url}`;
  // Only something that looks like an object path with an image extension is treated as one,
  // so a stray relative word cannot turn into a request against the storage API.
  if (!/^[\w-]+\/[\w./-]+\.(png|jpe?g|webp|gif|avif)$/i.test(url)) return undefined;
  const q = 'width=96&height=96&resize=cover&quality=80';
  return `${at.supabaseUrl}/storage/v1/render/image/public/avatars/${url}?${q}`;
}

function toAuthor(row: Row, at: Origin): Author {
  const name = String(row.display_name || row.username || 'unknown');
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    name,
    initial: name.slice(0, 1).toUpperCase(),
    color: typeof row.color === 'string' && row.color ? row.color : colorFor(name),
    role: row.is_admin ? 'admin' : row.is_moderator ? 'mod' : null,
    avatarUrl: avatarUrl(row.avatar_url, at),
  };
}

/** The coarse kind a part advertises: what a renderer checks before it inlines an attachment. */
function kindOf(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
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

/**
 * A profile edit is one PATCH: row-level security lets the owner (and instance staff) touch the
 * row, and every client renders `display_name`, so nothing else has to change to make a rename
 * visible.
 */
export async function updateProfile(
  session: Session,
  profileId: string,
  patch: { display_name?: string; avatar_url?: string }
): Promise<void> {
  const res = await fetch(
    `${session.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`profile: ${res.status} ${body.slice(0, 160)}`);
  }
}

/**
 * Uploads an avatar and returns the value for `profiles.avatar_url`.
 *
 * That column holds the bare object path (`<profileId>/<file>`) rather than a URL — the shape
 * `avatarUrl()` resolves for every author — so the upload is only half the job and the caller
 * patches the path in afterwards.
 */
export async function uploadAvatar(
  session: Session,
  profileId: string,
  file: File
): Promise<string> {
  const ext =
    (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const stem =
    (file.name.replace(/\.[^.]+$/, '') || 'avatar')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'avatar';
  // The timestamp keeps a re-upload from overwriting the old file while browsers still cache
  // it; the path is short because it lives in the profile row.
  const path = `${profileId}/${stem}-${Date.now().toString(36)}.${ext}`;
  const res = await fetch(`${session.supabaseUrl}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`avatar: ${res.status} ${body.slice(0, 160)}`);
  }
  return path;
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
        iconUrl: serverIconUrl(s.icon, session),
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
      // `type = 2` is a category row, not a channel: it duplicates a heading and must not be
      // listed. The order is the server's own (`"order"`), not the category's uuid, which is what
      // the previous query sorted by — hence channels in a heap and headings made of ids.
      `server_id=eq.${encodeURIComponent(serverId)}&type=neq.2` +
        '&select=id,name,type,category,"order"&order=order.asc'
    ),
    rest<Row[]>(
      session,
      'channel_categories',
      `server_id=eq.${encodeURIComponent(serverId)}&select=id,name,"order"&order=order.asc`
    ).catch(() => [] as Row[]),
  ]);

  const orderOf = new Map(categories.map((c, index) => [String(c.id), Number(c.order ?? index)] as const));
  const names = new Map(categories.map((c) => [String(c.id), String(c.name ?? 'Channels')] as const));

  const mapped = rows.map((c) => {
    const categoryId = c.category ? String(c.category) : '';
    return {
      id: String(c.id),
      name: String(c.name ?? 'channel'),
      kind: String(c.type).toLowerCase().includes('voice') || Number(c.type) === 1 ? 'voice' : 'text',
      // Without the join a category id would be printed as a UUID heading.
      category: names.get(categoryId) ?? 'Channels',
      categoryId,
      categoryOrder: orderOf.get(categoryId) ?? -1,
      position: Number(c.order ?? 0),
      unread: 0,
    } as Channel & { categoryId: string; categoryOrder: number; position: number };
  });

  // Uncategorised channels lead (as in the official client), then categories in the server's order,
  // each with its channels in the server's order.
  return mapped.sort((a, b) => {
    if (a.categoryId !== b.categoryId) {
      if (!a.categoryId) return -1;
      if (!b.categoryId) return 1;
      if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
      return a.category.localeCompare(b.category);
    }
    return a.position - b.position;
  });
}

/**
 * Turns what a person typed into message parts.
 *
 * A custom emoji is a structured part (`{type:'emoji', emoji:{name,url,id}}`), not the text
 * `:name:`: the instance's own renderers and every other client draw the picture from the part, and
 * a bare shortcode in a text part is exactly what "not sending emojis properly" looks like from the
 * other side. The shortcode stays in the text only when it matches no emoji this person has.
 */
export function composeContent(text: string, emoji: { id?: string; name: string; url: string }[]): unknown[] {
  if (!text) return [];
  if (!emoji.length) return [{ type: 'text', text }];
  const byName = new Map(emoji.map((e) => [e.name.toLowerCase(), e] as const));
  const parts: unknown[] = [];
  let last = 0;
  const pattern = /:([a-z0-9_+-]{1,64}):/gi;
  for (const match of text.matchAll(pattern)) {
    const found = byName.get(match[1].toLowerCase());
    if (!found || match.index === undefined) continue;
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) });
    parts.push({
      type: 'emoji',
      emoji: {
        ...(found.id ? { id: found.id } : {}),
        name: found.name,
        url: found.url,
      },
    });
    last = match.index + match[0].length;
  }
  if (!parts.length) return [{ type: 'text', text }];
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts;
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
  replyToId?: string | null,
  files: UploadedFile[] = [],
  /**
   * An id chosen by the caller, so a retry after a timeout cannot post the message twice: the row
   * is inserted with this primary key, and the second attempt is refused with 409 instead of
   * creating a duplicate. Omitted when the caller has nothing to retry.
   */
  id?: string,
  /** Custom emoji this person may use, so `:name:` becomes a picture part. */
  emoji: { id?: string; name: string; url: string }[] = []
): Promise<void> {
  // A year rather than the hour used for display: this URL is written into the message, where
  // other clients read it as-is and never re-sign. Harmony's own messages carry long-lived links
  // for exactly that reason.
  const signed = files.length
    ? await signMedia(session, files.map((f) => f.path), 365 * 24 * 60 * 60)
    : {};
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
      ...(id ? { id } : {}),
      channel_id: channelId,
      user_id: userId,
      // Harmony's own clients read `fileName`/`fileType`/`fileSize` and render the attachment from
      // `url`; a part carrying only `name`/`contentType` (what this client used to send) showed up
      // there as a bare file chip titled with the object's UUID.
      content: [
        ...composeContent(content, emoji ?? []),
        ...files.map((f) => ({
          type: 'file',
          path: f.path,
          // Signed for immediacy; readers that understand `path` re-sign it later anyway.
          ...(signed[f.path] ? { url: signed[f.path] } : {}),
          fileName: f.name,
          fileSize: f.size,
          // `fileType` is a *kind*, not a MIME type: the official renderer compares it to "image"
          // (voice messages carry "audio" for the same reason). Sending "image/png" there left
          // every picture as a file chip; the full type goes in `mime_type`.
          fileType: kindOf(f.contentType),
          mime_type: f.contentType,
        })),
      ],
      ...(files.length ? { media_paths: files.map((f) => f.path) } : {}),
      ...(replyToId ? { reply_to: replyToId } : {}),
    }),
  });
  // 23505/409 means this exact id is already stored: the earlier attempt did reach the instance and
  // the acknowledgement was what got lost. That is a success, not a failure to retry forever.
  if (res.status === 409 || res.status === 23505) return;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`send: ${res.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Editing rewrites the content parts and nothing else; the instance stamps `updated_at`
 * through its own trigger, and the audit trigger records the old text.
 */
export async function editMessage(session: Session, messageId: string, text: string): Promise<void> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/messages?id=eq.${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ content: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`edit: ${res.status} ${body.slice(0, 160)}`);
  }
}

/** Deleting is soft: `is_deleted` hides the message and keeps the audit trail intact. */
export async function deleteMessage(session: Session, messageId: string): Promise<void> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/messages?id=eq.${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ is_deleted: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`delete: ${res.status} ${body.slice(0, 160)}`);
  }
}

export interface UploadedFile {
  path: string;
  name: string;
  size: number;
  contentType: string;
}

/** Attachments live in the instance's `message_media` bucket, at c/<channel>/<profile>/<uuid>.<ext>. */
export async function uploadAttachment(
  session: Session,
  /**
   * The room an attachment belongs to: `c/<channelId>` or `d/<conversationId>`. The bucket's
   * policies read that first segment, and a DM's objects live under `d/`
   * (`messageMediaPath` in the official client).
   */
  room: string,
  profileId: string,
  file: File
): Promise<UploadedFile> {
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${room}/${profileId}/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${session.supabaseUrl}/storage/v1/object/message_media/${path}`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`upload: ${res.status} ${body.slice(0, 160)}`);
  }
  return { path, name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' };
}

/**
 * Storage links are signed and expire. They are fetched per path; an expired URL shows a
 * placeholder rather than breaking the message.
 */
export async function signMedia(
  session: Session,
  paths: string[],
  expiresIn = 3600
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (path) => {
      try {
        const res = await fetch(`${session.supabaseUrl}/storage/v1/object/sign/message_media/${path}`, {
          method: 'POST',
          headers: {
            apikey: session.anonKey,
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { signedURL?: string };
        if (body.signedURL) out[path] = `${session.supabaseUrl}/storage/v1${body.signedURL}`;
      } catch {
        /* an unsigned attachment renders as an unavailable chip */
      }
    })
  );
  return out;
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
  return fetchMessagePage(session, `channel_id=eq.${encodeURIComponent(channelId)}`, opts);
}

/** A joined server's welcome screen, including the rules the instance wants accepted. */
export interface ServerWelcome {
  serverId: string;
  name?: string;
  message?: string;
  rules: { title: string; description?: string }[];
  requireAcceptance: boolean;
  mustAccept: boolean;
}

/**
 * Whether this server wants its rules accepted before a message may be posted.
 *
 * `get_server_welcome` is the instance's own reading of that state: `must_accept` is already false
 * for managers, for people who joined before the rules were required, and for those who ticked the
 * box. The message insert is guarded by a trigger that raises `RULES_NOT_ACCEPTED:<server>`, so
 * without this the first thing a new member sees is a failed send.
 */
export async function fetchServerWelcome(
  session: Session,
  serverId: string
): Promise<ServerWelcome | null> {
  try {
    const row = await rpc<Record<string, unknown>>(session, 'get_server_welcome', {
      p_server_id: serverId,
    });
    if (!row) return null;
    const rawRules = Array.isArray(row.rules) ? row.rules : [];
    const rules = rawRules.map((entry) => {
      if (typeof entry === 'string') return { title: entry };
      const rule = entry as { title?: unknown; description?: unknown };
      return {
        title: String(rule.title ?? ''),
        description: typeof rule.description === 'string' ? rule.description : undefined,
      };
    });
    return {
      serverId,
      name: typeof row.name === 'string' ? row.name : undefined,
      message: typeof row.message === 'string' ? row.message : undefined,
      rules,
      requireAcceptance: row.require_acceptance === true,
      mustAccept: row.must_accept === true,
    };
  } catch {
    return null;
  }
}

/** Ticks the box: one call moves `rules_accepted_at`, which the send guard reads. */
export async function acceptServerRules(session: Session, serverId: string): Promise<void> {
  await rpc(session, 'accept_server_rules', { p_server_id: serverId });
}

/** The shape `get_invite_preview` answers with. */
export interface InvitePreview {
  code: string;
  status: string;
  name?: string;
  icon?: string;
  description?: string;
  serverId?: string;
  isMember: boolean;
  expiresAt?: string | null;
}

/**
 * Pulls an invite code out of whatever a person pasted.
 *
 * Their link (`https://har.mony.lol/invite/QBXVAGXE`), the bare code, or the same link without a
 * scheme all mean one thing; anything else is not an invite and must not be sent to the instance as
 * a code.
 */
export function parseInviteCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const link = /(?:^|\/)(?:invite|join)\/([A-Za-z0-9_-]{4,64})\b/.exec(text);
  if (link) return link[1];
  if (/^[A-Za-z0-9_-]{4,64}$/.test(text)) return text;
  return null;
}

/** Looks an invite up without joining: name, picture, rules and whether the caller is already in. */
export async function previewInvite(session: Session, code: string): Promise<InvitePreview | null> {
  try {
    const row = await rpc<Record<string, unknown>>(session, 'get_invite_preview', { p_code: code });
    if (!row) return null;
    return {
      code: String(row.code ?? code),
      status: String(row.status ?? 'unknown'),
      name: typeof row.name === 'string' ? row.name : undefined,
      icon: serverIconUrl(row.icon, session),
      description: typeof row.description === 'string' ? row.description : undefined,
      serverId: typeof row.server_id === 'string' ? row.server_id : undefined,
      isMember: row.is_member === true,
      expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    };
  } catch {
    return null;
  }
}

/**
 * Redeems an invite. The instance checks the code, counts the use and adds the membership in one
 * transaction (`redeem_invite`), so being already a member is a success rather than an error.
 */
export async function redeemInvite(session: Session, code: string): Promise<string> {
  try {
    const row = await rpc<{ server_id?: string }>(session, 'redeem_invite', { p_code: code });
    const serverId = row?.server_id;
    if (!serverId) throw new Error('the instance did not return a server');
    return serverId;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // The instance speaks in markers; a person gets a sentence.
    const known: [string, string][] = [
      ['INVITE_EXHAUSTED', 'This invite has been used up'],
      ['INVITE_REVOKED', 'This invite was revoked'],
      ['INVITE_EXPIRED', 'This invite has expired'],
      ['INVITE_NOT_FOUND', 'No such invite'],
      ['BANNED_FROM_SERVER', 'You are banned from that server'],
      ['SERVER_SUSPENDED', 'That server is suspended'],
    ];
    for (const [marker, text] of known) {
      if (message.includes(marker)) throw new Error(text);
    }
    // An instance older than invites-by-RPC answers 404/PGRST202; say so instead of "failed".
    if (/PGRST202|does not exist|42883/.test(message)) {
      throw new Error('This instance is too old to join by invite from here');
    }
    throw new Error(message.slice(0, 160));
  }
}

/**
 * Custom emoji this person may use: the instance's own, plus those of the servers they are in.
 *
 * `emojis_select_all` is `USING (true)`, so the table hands out every server's pack and the scoping
 * has to happen here. Showing another guild's emoji in this one is not a feature — it is somebody
 * else's pack, and it is also the thing that made this client look different from the official one.
 */
export async function fetchCustomEmojis(
  session: Session,
  serverIds: string[] = []
): Promise<CustomEmoji[]> {
  const scope = serverIds.length
    ? `or=(server_id.is.null,server_id.in.(${serverIds.map(encodeURIComponent).join(',')}))&`
    : 'server_id=is.null&';
  const rows = await rest<Record<string, unknown>[]>(
    session,
    'emojis',
    `${scope}select=id,name,url,scope,server_id&order=name.asc&limit=800`
  ).catch(() => [] as Record<string, unknown>[]);
  const out: CustomEmoji[] = [];
  for (const row of rows) {
    if (typeof row.name !== 'string' || typeof row.url !== 'string') continue;
    out.push({
      id: typeof row.id === 'string' ? row.id : undefined,
      name: row.name,
      url: row.url,
      scope: typeof row.scope === 'string' ? row.scope : undefined,
      serverId: typeof row.server_id === 'string' ? row.server_id : undefined,
    });
  }
  return out;
}

/**
 * Creates a server owned by this person.
 *
 * The instance does the rest: a trigger builds the default `Text Channels`/`Voice Channels`
 * categories with `general` and `voice chat`, and the owner's membership row is theirs to insert
 * (`user_servers_insert_self`).
 */
export async function createServer(
  session: Session,
  profileId: string,
  name: string,
  isPublic: boolean
): Promise<string> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/servers`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ name: name.trim(), owner: profileId, public: isPublic }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`create server: ${res.status} ${body.slice(0, 160)}`);
  }
  const rows = (await res.json().catch(() => [])) as { id?: string }[];
  const id = rows[0]?.id;
  if (!id) throw new Error('the instance did not return the new server');

  // The instance already puts the owner in the new server (a membership row exists the moment the
  // server does), so there is nothing to join here.
  return id;
}

/** Adds a channel to a server this person owns (`channels_insert_owner` enforces that). */
export async function createChannel(
  session: Session,
  serverId: string,
  channel: { name: string; type: 0 | 1; categoryId?: string | null; position?: number }
): Promise<string> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/channels`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      server_id: serverId,
      name: channel.name.trim().toLowerCase().replace(/\s+/g, '-'),
      type: channel.type,
      ...(channel.categoryId ? { category: channel.categoryId } : {}),
      order: channel.position ?? 0,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`create channel: ${res.status} ${body.slice(0, 160)}`);
  }
  const rows = (await res.json().catch(() => [])) as { id?: string }[];
  if (!rows[0]?.id) throw new Error('the instance did not return the new channel');
  return rows[0].id;
}

/** A new invite code, in the alphabet the instance accepts (`^[A-Za-z0-9_-]{1,64}$`). */
function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/** Creates an invite link for a server and returns the code. */
export async function createInvite(
  session: Session,
  serverId: string,
  profileId: string,
  channelId?: string | null
): Promise<string> {
  const code = inviteCode();
  const res = await fetch(`${session.supabaseUrl}/rest/v1/invites`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      code,
      server_id: serverId,
      created_by: profileId,
      ...(channelId ? { channel_id: channelId } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`create invite: ${res.status} ${body.slice(0, 160)}`);
  }
  return code;
}

/** Per-server notification defaults: the row the instance keeps for "this whole server". */
export interface ServerNotification {
  muted: boolean;
  /** `all`, `mentions` or `none` — the same vocabulary channel overrides use. */
  level: string;
}

export async function fetchServerNotification(
  session: Session,
  profileId: string,
  serverId: string
): Promise<ServerNotification | null> {
  const rows = await rest<Row[]>(
    session,
    'notification_channels',
    `user_id=eq.${encodeURIComponent(profileId)}&server_id=eq.${encodeURIComponent(serverId)}` +
      '&channel_id=is.null&conversation_id=is.null&select=muted,notification_level&limit=1'
  ).catch(() => [] as Row[]);
  const row = rows[0];
  if (!row) return null;
  return {
    muted: row.muted === true,
    level: typeof row.notification_level === 'string' ? row.notification_level : 'mentions',
  };
}

/**
 * Writes a server's defaults. The unique indexes are partial — one per channel, one per
 * conversation — so there is no conflict target for a server row: update the existing one, insert
 * when there is none.
 */
export async function setServerNotification(
  session: Session,
  profileId: string,
  serverId: string,
  patch: { muted?: boolean; level?: string }
): Promise<void> {
  const body = {
    ...(patch.muted === undefined ? {} : { muted: patch.muted }),
    ...(patch.level === undefined ? {} : { notification_level: patch.level }),
  };
  const filter =
    `user_id=eq.${encodeURIComponent(profileId)}&server_id=eq.${encodeURIComponent(serverId)}` +
    '&channel_id=is.null&conversation_id=is.null';
  const res = await fetch(`${session.supabaseUrl}/rest/v1/notification_channels?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`server notifications: ${res.status} ${text.slice(0, 140)}`);
  }
  const rows = (await res.json().catch(() => [])) as unknown[];
  if (Array.isArray(rows) && rows.length) return;
  const insert = await fetch(`${session.supabaseUrl}/rest/v1/notification_channels`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: profileId, server_id: serverId, ...body }),
  });
  if (!insert.ok) {
    const text = await insert.text().catch(() => '');
    throw new Error(`server notifications: ${insert.status} ${text.slice(0, 140)}`);
  }
}

/** A server anybody may join, as the discover list shows it. */
export interface PublicServer {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  members?: number;
  isMember: boolean;
}

/**
 * Servers marked public on this instance.
 *
 * `servers` is readable by everyone (`Enable read access for all users`) and visibility is an
 * application-level decision, so the filter on `public` is what keeps the list honest. Membership is
 * worked out against the servers this person already has.
 */
export async function fetchPublicServers(
  session: Session,
  myServerIds: string[]
): Promise<PublicServer[]> {
  const rows = await rest<Row[]>(
    session,
    'servers',
    'public=eq.true&select=id,name,description,icon,member_count&order=member_count.desc&limit=60'
  ).catch(() => [] as Row[]);
  const mine = new Set(myServerIds);
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? 'server'),
    description: typeof row.description === 'string' ? row.description : undefined,
    iconUrl: serverIconUrl(row.icon, session),
    members: typeof row.member_count === 'number' ? row.member_count : undefined,
    isMember: mine.has(String(row.id)),
  }));
}

/** Joining a public server goes through the instance's own RPC; its refusal is the message. */
export async function joinPublicServer(session: Session, serverId: string): Promise<void> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/rpc/join_public_server`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_server_id: serverId }),
  });
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw new Error(body.includes('already') ? 'You are already a member' : `join: ${res.status} ${body.slice(0, 120)}`);
}

/** A sticker of this instance: a picture in the public `stickers` bucket with a row around it. */
export interface Sticker {
  id: string;
  name: string;
  /** Required by the instance's sticker-part guard, so the picker carries it through. */
  description?: string;
  url: string;
  width?: number;
  height?: number;
  mimeType?: string;
  scope?: string;
}

/** Stickers this person may use — the instance's, their server's and their own. */
export async function fetchStickers(session: Session): Promise<Sticker[]> {
  const rows = await rest<Row[]>(
    session,
    'stickers',
    'select=id,name,description,url,width,height,mime_type,scope&order=created_at.desc&limit=300'
  ).catch(() => [] as Row[]);
  return rows
    .filter((row) => typeof row.url === 'string' && typeof row.name === 'string')
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : undefined,
      url: String(row.url),
      width: typeof row.width === 'number' ? row.width : undefined,
      height: typeof row.height === 'number' ? row.height : undefined,
      mimeType: typeof row.mime_type === 'string' ? row.mime_type : undefined,
      scope: typeof row.scope === 'string' ? row.scope : undefined,
    }));
}

/**
 * Uploads a personal sticker: the object goes to `stickers/user/<profile>/<uuid>.<ext>` and the row
 * through `create_sticker`, which insists on a description of 1 to 300 characters.
 */
export async function uploadSticker(
  session: Session,
  profileId: string,
  file: File,
  name: string
): Promise<Sticker> {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  if (!/^(png|apng|webp|gif)$/.test(ext)) throw new Error('stickers must be png, apng, webp or gif');
  const path = `user/${profileId}/${crypto.randomUUID()}.${ext}`;
  const url = `${session.supabaseUrl}/storage/v1/object/stickers/${path}`;
  const upload = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!upload.ok) {
    const body = await upload.text().catch(() => '');
    // The bucket policies refuse politely; the caller says what to do about it.
    throw new Error(`sticker upload: ${upload.status} ${body.slice(0, 120)}`);
  }
  const publicUrl = `${session.supabaseUrl}/storage/v1/object/public/stickers/${path}`;
  const row = await rpc<Row>(session, 'create_sticker', {
    p_scope: 'user',
    p_server_id: null,
    p_path: path,
    p_url: publicUrl,
    p_name: name.slice(0, 40) || 'sticker',
    p_description: `Uploaded from Timbre`,
    p_width: null,
    p_height: null,
    p_duration_ms: null,
  });
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? name),
    description: typeof row.description === 'string' ? row.description : 'Uploaded from Timbre',
    url: String(row.url ?? publicUrl),
    scope: 'user',
  };
}

/** Sends a sticker: a message whose content is one `sticker` part. */
export async function sendSticker(
  session: Session,
  target: { channelId?: string; conversationId?: string },
  userId: string,
  sticker: Sticker,
  id?: string
): Promise<void> {
  const res = await fetch(`${session.supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...(id ? { id } : {}),
      ...(target.channelId
        ? { channel_id: target.channelId }
        : { conversation_id: target.conversationId }),
      user_id: userId,
      content: [
        {
          type: 'sticker',
          id: sticker.id,
          url: sticker.url,
          name: sticker.name,
          description: sticker.description ?? sticker.name,
          ...(sticker.width ? { width: sticker.width } : {}),
          ...(sticker.height ? { height: sticker.height } : {}),
        },
      ],
    }),
  });
  if (res.status === 409 || res.status === 23505) return;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`sticker send: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** A thread: its id and counters, keyed by the message it hangs off. */
export interface ThreadInfo {
  id: string;
  parentMessageId: string;
  messageCount: number;
  locked: boolean;
  archived: boolean;
}

/** Threads of a channel that are still open, so the parent message can say "3 replies". */
export async function fetchChannelThreads(
  session: Session,
  channelId: string
): Promise<Record<string, ThreadInfo>> {
  const rows = await rest<Row[]>(
    session,
    'active_threads_view',
    `channel_id=eq.${encodeURIComponent(channelId)}&select=id,parent_message_id,message_count,locked,archived&limit=200`
  ).catch(() => [] as Row[]);
  const out: Record<string, ThreadInfo> = {};
  for (const row of rows) {
    const parent = String(row.parent_message_id ?? '');
    if (!parent) continue;
    out[parent] = {
      id: String(row.id),
      parentMessageId: parent,
      messageCount: Number(row.message_count ?? 0),
      locked: row.locked === true,
      archived: row.archived === true,
    };
  }
  return out;
}

/** A thread as the list shows it: what it is called, what it hangs off, and how alive it is. */
export interface ThreadSummary {
  id: string;
  parentMessageId: string;
  name: string;
  replies: number;
  lastAt: string;
  unread: boolean;
  locked: boolean;
}

/**
 * Open threads of a channel with this person's read state.
 *
 * `active_threads_view` gives the counters and `thread_members` holds `last_read_at` per person —
 * the instance does not compute thread unread for us, so the comparison happens here: a thread is
 * unread when its last message is newer than the last time it was opened.
 */
export async function fetchThreadSummaries(
  session: Session,
  channelId: string,
  profileId: string
): Promise<ThreadSummary[]> {
  const rows = await rest<Row[]>(
    session,
    'active_threads_view',
    `channel_id=eq.${encodeURIComponent(channelId)}` +
      '&archived=is.false&select=id,parent_message_id,name,message_count,last_message_at,locked&limit=100'
  ).catch(() => [] as Row[]);
  if (!rows.length) return [];

  const ids = rows.map((r) => String(r.id));
  const [parents, memberRows] = await Promise.all([
    rest<Row[]>(
      session,
      'messages',
      `id=in.(${rows.map((r) => encodeURIComponent(String(r.parent_message_id))).join(',')})` +
        '&select=id,content'
    ).catch(() => [] as Row[]),
    rest<Row[]>(
      session,
      'thread_members',
      `thread_id=in.(${ids.map(encodeURIComponent).join(',')})` +
        `&user_id=eq.${encodeURIComponent(profileId)}&select=thread_id,last_read_at`
    ).catch(() => [] as Row[]),
  ]);

  const textOf = new Map(parents.map((m) => [String(m.id), renderContentParts(m.content).text] as const));
  const readAt = new Map(
    memberRows.map((m) => [String(m.thread_id), String(m.last_read_at ?? '')] as const)
  );

  return rows
    .map((row) => {
      const id = String(row.id);
      const parentId = String(row.parent_message_id ?? '');
      const lastAt = String(row.last_message_at ?? '');
      const seen = readAt.get(id);
      const snippet = (textOf.get(parentId) ?? '').trim().slice(0, 120);
      return {
        id,
        parentMessageId: parentId,
        name: (typeof row.name === 'string' && row.name.trim()) || snippet || 'Thread',
        replies: Number(row.message_count ?? 0),
        lastAt,
        // No membership row means it was never opened here, which reads as unread.
        unread: lastAt ? (!seen || seen < lastAt) : false,
        locked: row.locked === true,
      } satisfies ThreadSummary;
    })
    .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
}

/** Records that this person has read a thread up to now. */
export async function markThreadRead(
  session: Session,
  threadId: string,
  profileId: string
): Promise<void> {
  const now = new Date().toISOString();
  const patch = async (): Promise<boolean> => {
    const res = await fetch(
      `${session.supabaseUrl}/rest/v1/thread_members?thread_id=eq.${encodeURIComponent(threadId)}` +
        `&user_id=eq.${encodeURIComponent(profileId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: session.anonKey,
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ last_read_at: now }),
      }
    );
    if (!res.ok) return false;
    const rows = (await res.json().catch(() => [])) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  };
  try {
    // The row may not exist yet: joining a thread is an insert, and the policies allow both.
    if (await patch()) return;
    await fetch(`${session.supabaseUrl}/rest/v1/thread_members`, {
      method: 'POST',
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ thread_id: threadId, user_id: profileId, last_read_at: now }),
    });
  } catch {
    /* a read marker is not worth an error banner */
  }
}

/** The thread of a message, if one exists. */
export async function fetchThreadForMessage(
  session: Session,
  messageId: string
): Promise<ThreadInfo | null> {
  const rows = await rest<Row[]>(
    session,
    'threads',
    `parent_message_id=eq.${encodeURIComponent(messageId)}&select=id,parent_message_id,message_count,locked,archived&limit=1`
  ).catch(() => [] as Row[]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    parentMessageId: String(row.parent_message_id ?? messageId),
    messageCount: Number(row.message_count ?? 0),
    locked: row.locked === true,
    archived: row.archived === true,
  };
}

/**
 * Opens the thread of a message, creating it the first time somebody replies in it.
 *
 * The instance refuses a blank name (`threads name must not be blank`), so the parent message's
 * opening words become the thread's name — which is also what the thread list shows.
 */
export async function ensureThread(
  session: Session,
  messageId: string,
  name?: string
): Promise<string | null> {
  const existing = await fetchThreadForMessage(session, messageId);
  if (existing) return existing.id;
  const title = (name ?? '').trim().slice(0, 80) || 'Thread';
  const id = await rpc<string>(session, 'create_thread', {
    p_message_id: messageId,
    p_name: title,
    p_auto_archive_duration: 1440,
  });
  return typeof id === 'string' && id ? id : null;
}

/** The thread's own messages: `messages.thread_id`, newest page first read the other way round. */
export async function fetchThreadMessages(
  session: Session,
  threadId: string,
  opts: { limit?: number; before?: string } = {}
): Promise<MessagePage> {
  return fetchMessagePage(session, `thread_id=eq.${encodeURIComponent(threadId)}`, opts);
}

/** A message inside a thread: it belongs to the parent channel and names its thread. */
export async function sendThreadMessage(
  session: Session,
  threadId: string,
  channelId: string,
  userId: string,
  content: string,
  id?: string,
  files: UploadedFile[] = [],
  emoji: { id?: string; name: string; url: string }[] = []
): Promise<void> {
  const signed = files.length
    ? await signMedia(session, files.map((f) => f.path), 365 * 24 * 60 * 60)
    : {};
  const res = await fetch(`${session.supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...(id ? { id } : {}),
      channel_id: channelId,
      thread_id: threadId,
      user_id: userId,
      content: [
        ...composeContent(content, emoji ?? []),
        ...files.map((f) => ({
          type: 'file',
          path: f.path,
          ...(signed[f.path] ? { url: signed[f.path] } : {}),
          fileName: f.name,
          fileSize: f.size,
          fileType: kindOf(f.contentType),
          mime_type: f.contentType,
        })),
      ],
      ...(files.length ? { media_paths: files.map((f) => f.path) } : {}),
    }),
  });
  if (res.status === 409 || res.status === 23505) return;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`thread send: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** The same page, from a direct conversation: `messages.conversation_id` instead of a channel. */
export async function fetchConversationMessages(
  session: Session,
  conversationId: string,
  opts: { limit?: number; before?: string } = {}
): Promise<MessagePage> {
  return fetchMessagePage(session, `conversation_id=eq.${encodeURIComponent(conversationId)}`, opts);
}

async function fetchMessagePage(
  session: Session,
  scope: string,
  opts: { limit?: number; before?: string } = {}
): Promise<MessagePage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = await rest<Row[]>(
    session,
    'messages',
    `${scope}&is_deleted=eq.false` +
      `&order=created_at.desc&limit=${limit}` +
      (opts.before ? `&created_at=lt.${encodeURIComponent(opts.before)}` : '') +
      '&select=id,created_at,updated_at,content,encrypted,user_id,is_system,metadata,reply_to'
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

  // A webhook post has no profile at all: `user_id` is null and the presentation lives in
  // `metadata.webhook` (`{id, name, avatar_url}`, with `metadata.bot` true). Resolving authors in
  // `profiles` alone is why every CI announcement in #new-builds read "unknown".
  const authorOf = (m: Row): Author => {
    const row = byId.get(String(m.user_id));
    if (row) return toAuthor(row, session);
    const meta = (m.metadata ?? null) as Record<string, unknown> | null;
    const hook =
      meta && typeof meta.webhook === 'object' && meta.webhook
        ? (meta.webhook as Record<string, unknown>)
        : null;
    const name = hook && typeof hook.name === 'string' ? hook.name : '';
    if (name) {
      const raw = hook && typeof hook.avatar_url === 'string' ? hook.avatar_url : '';
      return {
        name,
        initial: name.slice(0, 1).toUpperCase(),
        color: colorFor(name),
        role: null,
        bot: meta?.bot === true,
        avatarUrl: raw ? avatarUrl(raw, session) : undefined,
      };
    }
    return toAuthor({ username: m.is_system === true ? 'system' : 'unknown' }, session);
  };

  const quoteOf = (m: Row): Message['replyTo'] | undefined => {
    const id = typeof m.reply_to === 'string' ? m.reply_to : null;
    if (!id) return undefined;
    const parent = parents.get(id);
    if (!parent) return { id, author: 'unknown', text: '(message not available)' };
    const parts = renderContentParts(parent.content);
    return { id, author: authorOf(parent).name, text: parts.text.slice(0, 160) };
  };

  // Parents added above are only there for quoting; they are not part of the page.
  const visible = rows.filter((m) => !parentsOnly.has(String(m.id)));

  let prevAuthor = '';
  let prevTime = 0;
  const messages: Message[] = visible.map((m) => {
    const system = m.is_system === true;
    const author = authorOf(m);
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
      // The message knows which emoji it shipped, picture included; that beats re-resolving a name
      // against this person's own packs (a foreign pack's `:RIP:` otherwise comes out as text).
      ...('emojis' in parts && parts.emojis.length ? { emojis: parts.emojis } : {}),
      edited:
        typeof m.updated_at === 'string' &&
        typeof m.created_at === 'string' &&
        new Date(m.updated_at).getTime() - new Date(m.created_at).getTime() > 1000,
      system,
      grouped: system ? false : grouped,
      replyTo: quoteOf(m),
    };
  });

  // Polls: the part names the poll, the aggregate comes from one RPC for the whole page.
  const pollIds: string[] = [];
  for (const row of visible) {
    if (!Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'poll') {
        const id = (part as { pollId?: unknown }).pollId;
        if (typeof id === 'string') pollIds.push(id);
      }
    }
  }
  if (pollIds.length) {
    const polls = await fetchPolls(session, pollIds);
    for (const message of messages) {
      const poll = polls[message.id];
      if (poll) message.poll = poll;
    }
  }

  // Attachments: images become normal images, everything else a download chip. The bucket is
  // private, so every path needs its own signed URL — one call per path, in parallel.
  const filePathByMessage = new Map<string, FilePart[]>();
  for (const m of visible) {
    const parts = fileParts(m.content);
    if (parts.length) filePathByMessage.set(String(m.id), parts);
  }
  if (filePathByMessage.size) {
    const signed = await signMedia(
      session,
      [...filePathByMessage.values()].flat().map((p) => p.path)
    );
    for (const message of messages) {
      const parts = filePathByMessage.get(message.id);
      if (!parts?.length) continue;
      const images: string[] = [];
      const files: { name: string; url?: string }[] = [];
      for (const part of parts) {
        const url = signed[part.path];
        if (part.contentType.startsWith('image/') && url) images.push(url);
        else files.push({ name: part.name, url });
      }
      if (images.length) message.images = [...(message.images ?? []), ...images];
      if (files.length) message.files = files;
    }
  }

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
    emoji_id: string | null;
    emoji_name: string | null;
    emoji_url: string | null;
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
    // A native emoji lives in `custom_emoji_content`; a custom one has a name and a picture, and the
    // RPC hands both over — without the URL the chip could only print `toothy` as text.
    const emoji = row.custom_emoji_content || row.emoji_name || '';
    if (!emoji || !row.message_id) continue;
    const rawUrl = typeof row.emoji_url === 'string' && row.emoji_url ? row.emoji_url : undefined;
    const url = rawUrl
      ? /^https?:\/\//i.test(rawUrl)
        ? rawUrl
        : `https://${session.instance}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
      : undefined;
    (out[row.message_id] ??= []).push({
      emoji,
      ...(url ? { url } : {}),
      ...(typeof row.emoji_id === 'string' ? { emojiId: row.emoji_id } : {}),
      count: Number(row.reaction_count ?? 0),
      mine: row.current_user_reacted === true,
    });
  }
  return out;
}

async function removeReaction(
  session: Session,
  messageId: string,
  userId: string,
  emoji: string,
  emojiId?: string
): Promise<void> {
  const base =
    `message_id=eq.${encodeURIComponent(messageId)}` + `&user_id=eq.${encodeURIComponent(userId)}`;
  const remove = async (filter: string): Promise<number> => {
    const res = await fetch(`${session.supabaseUrl}/rest/v1/reactions?${base}${filter}`, {
      method: 'DELETE',
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        // Ask how many rows went: a client-side delete that matched nothing looks exactly like a
        // successful one, which is how a reaction can refuse to come off.
        Prefer: 'return=representation',
      },
    });
    if (!res.ok) throw new Error(`reaction: ${res.status} ${(await res.text()).slice(0, 120)}`);
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  };

  const byContent = await remove(`&custom_emoji_content=eq.${encodeURIComponent(emoji)}`);
  if (byContent > 0) return;
  // A custom emoji reaction written by another client (or the official one) points at `emoji_id`
  // and leaves `custom_emoji_content` empty, so the first delete matches nothing.
  if (emojiId) await remove(`&emoji_id=eq.${encodeURIComponent(emojiId)}`);
}

/** Adds the reaction if it is not there yet, removes it otherwise. */
export async function toggleReaction(
  session: Session,
  messageId: string,
  target: { channelId?: string; conversationId?: string },
  userId: string,
  emoji: string,
  remove: boolean,
  emojiId?: string
): Promise<void> {
  if (remove) {
    await removeReaction(session, messageId, userId, emoji, emojiId);
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
    // A conversation reaction names the conversation; a channel reaction names the channel. The
    // wrong column is accepted by the table but makes the row useless to everything that reads it.
    body: JSON.stringify({
      message_id: messageId,
      ...(target.conversationId ? { conversation_id: target.conversationId } : { channel_id: target.channelId }),
      user_id: userId,
      // A custom emoji is a reference (`emoji_id`), not a name: the name-only form creates a second
      // row that the aggregate reports as a separate chip, which is why two `RIP`s appeared where
      // one was expected instead of the tap joining the group.
      ...(emojiId ? { emoji_id: emojiId } : { custom_emoji_content: emoji }),
    }),
  });
  // 409 is reactions_message_user_emoji_key: the reaction was already there even though the
  // chip said otherwise (it was set from another device). The tap means "toggle", so the
  // second half of the toggle is to take it away.
  if (res.status === 409) {
    await removeReaction(session, messageId, userId, emoji, emojiId);
    return;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`reaction: ${res.status} ${body.slice(0, 120)}`);
  }
}

export interface SearchHit {
  messageId: string;
  channelId: string;
  text: string;
  createdAt: string;
  fuzzy: boolean;
}

/**
 * Message search on the instance (`search_messages`): full text with a fuzzy fallback, scoped
 * by channel or by server. It returns ids and text, not authors — the caller maps what it
 * already knows.
 */
export async function searchMessages(
  session: Session,
  query: string,
  opts: { channelId?: string; serverId?: string; limit?: number } = {}
): Promise<SearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const row = await rpc<
    { message_id: string; content_text: string; channel_id: string; created_at: string; fuzzy: boolean | null }[]
  >(session, 'search_messages', {
    p_query: term,
    p_channel_id: opts.channelId ?? null,
    p_server_id: opts.serverId ?? null,
    p_limit: opts.limit ?? 30,
  });
  return (row ?? []).map((r) => ({
    messageId: r.message_id,
    channelId: r.channel_id,
    text: r.content_text ?? '',
    createdAt: r.created_at,
    fuzzy: r.fuzzy === true,
  }));
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
    conversation_id: string | null;
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
    // The same RPC answers for conversations: `channel_id` is null and `conversation_id` is set,
    // and the sidebar keys both by id, so one map serves the two lists.
    const key = row.channel_id ?? row.conversation_id;
    if (!key) continue;
    out[key] = {
      channelId: key,
      unread: Number(row.unread_messages ?? 0),
      mentions: Number(row.unread_mentions ?? 0),
      lastReadAt: row.last_read_at,
      lastReadMessageId: row.last_read_message_id,
    };
  }
  return out;
}

/**
 * Mute or unmute one channel.
 *
 * The unique index behind `notification_channels` is partial (`WHERE channel_id IS NOT NULL
 * AND conversation_id IS NULL`), which PostgREST's `on_conflict` cannot address, so this tries an
 * update first and inserts only when no row was returned. `muted_until` is cleared both ways: an
 * indefinite mute, and un-muting something that was muted until Friday.
 */
export async function setChannelMute(
  session: Session,
  profileId: string,
  serverId: string,
  channelId: string,
  muted: boolean
): Promise<void> {
  const filter = `user_id=eq.${encodeURIComponent(profileId)}&channel_id=eq.${encodeURIComponent(channelId)}`;
  const body = JSON.stringify({ muted, muted_until: null });
  const patch = await fetch(`${session.supabaseUrl}/rest/v1/notification_channels?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body,
  });
  if (!patch.ok) {
    const text = await patch.text().catch(() => '');
    throw new Error(`mute: ${patch.status} ${text.slice(0, 120)}`);
  }
  const updated = (await patch.json().catch(() => [])) as unknown[];
  if (Array.isArray(updated) && updated.length) return;

  const insert = await fetch(`${session.supabaseUrl}/rest/v1/notification_channels`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: profileId, server_id: serverId, channel_id: channelId, muted, muted_until: null }),
  });
  if (!insert.ok) {
    const text = await insert.text().catch(() => '');
    throw new Error(`mute: ${insert.status} ${text.slice(0, 120)}`);
  }
}

/**
 * Channels this person has muted, from `notification_channels`.
 *
 * It is a separate query because `get_unread_counts()` returns a row only for channels that have
 * unread messages (`WHERE n > 0 OR mentions > 0`) — so the channel you muted precisely because it
 * was quiet would be missing from it, and the switch would read as off.
 */
export async function fetchMutedChannels(
  session: Session,
  profileId: string
): Promise<Record<string, true>> {
  const now = Date.now();
  const rows = await rest<Row[]>(
    session,
    'notification_channels',
    `user_id=eq.${encodeURIComponent(profileId)}` +
      '&muted=eq.true&select=channel_id,conversation_id,muted_until'
  ).catch(() => [] as Row[]);
  const out: Record<string, true> = {};
  for (const row of rows) {
    const id = typeof row.channel_id === 'string' ? row.channel_id : null;
    if (!id) continue;
    // A mute with an end date is only a mute until then; the instance keeps the row.
    const until = typeof row.muted_until === 'string' ? Date.parse(row.muted_until) : null;
    if (until !== null && Number.isFinite(until) && until <= now) continue;
    out[id] = true;
  }
  return out;
}

/**
 * The person's notification settings, of which this client honours the one that changes what a
 * message is allowed to do: do-not-disturb, including its daily window. The instance stores the
 * window as two times and expects the client to decide whether "now" falls inside it.
 */
export interface NotificationPrefs {
  /** Which events may raise a system notification. */
  desktop: { mentions: boolean; replies: boolean; dms: boolean; reactions: boolean; messages: boolean };
  /** Which of them may also make a sound. */
  sound: { mentions: boolean; replies: boolean; dms: boolean; reactions: boolean; messages: boolean };
  dndEnabled: boolean;
  /** `HH:MM:SS` as Postgres prints a `time`, or null when the window was never set. */
  dndStart: string | null;
  dndEnd: string | null;
  pushMentions: boolean;
  pushDms: boolean;
}

/**
 * One profile by handle, for the card behind a tapped `@mention`. A mention can name someone who
 * is not in the current page (or not in this channel at all), so it is looked up rather than read
 * out of whatever happens to be rendered.
 */
/**
 * Everybody who has joined a server, as the client should draw them.
 *
 * `user_servers_select_co_members` lets a member read the rows of servers they belong to, so one
 * query answers "who is here" — no per-channel guessing. Rows are ordered by join time, which is
 * also the only ordering the server offers.
 */
export async function fetchServerMembers(session: Session, serverId: string): Promise<Author[]> {
  const rows = await rest<Row[]>(
    session,
    'user_servers',
    `server_id=eq.${encodeURIComponent(serverId)}&status=eq.accepted` +
      '&select=created_at,user:profiles(id,username,display_name,avatar_url,color,is_admin,is_moderator)' +
      '&order=created_at.asc&limit=200'
  ).catch(() => [] as Row[]);
  const people: Author[] = [];
  for (const row of rows) {
    const profile = row.user as Row | null;
    if (!profile) continue;
    people.push(toAuthor(profile, session));
  }
  return people;
}

export async function fetchProfileByUsername(
  session: Session,
  username: string
): Promise<(Author & { username?: string; domain?: string }) | null> {
  const handle = username.replace(/^@/, '').trim();
  if (!handle) return null;
  const query = (columns: string): string =>
    `username=eq.${encodeURIComponent(handle)}&select=${columns}&limit=1`;
  // `domain` is not on every version's profile row, and a missing column is a 400 rather than a
  // default — ask for it, and fall back to the columns every instance has.
  let rows = await rest<Row[]>(
    session,
    'profiles',
    query('id,username,display_name,avatar_url,color,is_admin,is_moderator,domain')
  ).catch(() => [] as Row[]);
  if (!rows.length) {
    rows = await rest<Row[]>(
      session,
      'profiles',
      query('id,username,display_name,avatar_url,color,is_admin,is_moderator')
    ).catch(() => [] as Row[]);
  }
  const row = rows[0];
  if (!row) return null;
  return {
    ...toAuthor(row, session),
    username: typeof row.username === 'string' ? row.username : undefined,
    domain: typeof row.domain === 'string' ? row.domain : undefined,
  };
}

const SECURITY_TITLES: Record<string, string> = {
  new_sign_in: 'New sign-in',
  mfa_enabled: 'Two-factor enabled',
  mfa_disabled: 'Two-factor disabled',
  recovery_code_used: 'Recovery code used',
  recovery_codes_regenerated: 'Recovery codes regenerated',
  password_changed: 'Password changed',
};

/** One poll of a message, with the aggregate the instance computes for the caller. */
export interface Poll {
  id: string;
  messageId: string;
  question: string;
  allowMultiple: boolean;
  closed: boolean;
  expiresAt: string | null;
  totalVoters: number;
  options: { id: string; text: string; votes: number }[];
  myOptionIds: string[];
  isAuthor: boolean;
}

/**
 * Polls for a page of messages, keyed by message id.
 *
 * The message part only names the poll (`pollId`); counts, the caller's own votes and whether the
 * poll closed come from `get_message_polls`, which takes up to a hundred ids in one call.
 */
export async function fetchPolls(
  session: Session,
  pollIds: string[]
): Promise<Record<string, Poll>> {
  const ids = [...new Set(pollIds.filter(Boolean))].slice(0, 100);
  if (!ids.length) return {};
  const rows = await rpc<
    {
      poll_id?: string;
      message_id?: string;
      question?: string;
      allow_multiple?: boolean;
      expires_at?: string | null;
      closed?: boolean;
      total_voters?: number;
      options?: unknown;
      my_option_ids?: string[];
      is_author?: boolean;
    }[]
  >(session, 'get_message_polls', { p_poll_ids: ids }).catch(() => []);

  const out: Record<string, Poll> = {};
  for (const row of rows ?? []) {
    const messageId = String(row.message_id ?? '');
    if (!messageId) continue;
    const options = Array.isArray(row.options)
      ? (row.options as { id?: unknown; text?: unknown; votes?: unknown }[]).map((o) => ({
          id: String(o.id ?? ''),
          text: String(o.text ?? ''),
          votes: Number(o.votes ?? 0),
        }))
      : [];
    out[messageId] = {
      id: String(row.poll_id ?? ''),
      messageId,
      question: String(row.question ?? ''),
      allowMultiple: row.allow_multiple === true,
      closed: row.closed === true,
      expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
      totalVoters: Number(row.total_voters ?? 0),
      options,
      myOptionIds: Array.isArray(row.my_option_ids) ? row.my_option_ids.map(String) : [],
      isAuthor: row.is_author === true,
    };
  }
  return out;
}

/** Votes on a poll; the instance replaces the caller's previous choice. */
export async function votePoll(session: Session, pollId: string, optionIds: string[]): Promise<void> {
  await rpc(session, 'vote_message_poll', { p_poll_id: pollId, p_option_ids: optionIds });
}

/** Posts a poll — the instance writes the message too, poll part and text fallback included. */
export async function createPoll(
  session: Session,
  target: { channelId?: string; conversationId?: string },
  poll: { question: string; options: string[]; allowMultiple: boolean; durationHours: number },
  replyTo?: string | null
): Promise<void> {
  await rpc(session, 'create_message_poll', {
    p_channel_id: target.channelId ?? null,
    p_conversation_id: target.conversationId ?? null,
    p_question: poll.question,
    p_options: poll.options,
    p_allow_multiple: poll.allowMultiple,
    p_duration_hours: poll.durationHours,
    p_reply_to: replyTo ?? null,
  });
}

/** A pinned message, with enough context to name its author and show the text. */
export interface PinnedMessage {
  id: string;
  author: string;
  initial: string;
  color: string;
  avatarUrl?: string;
  text: string;
  pinnedAt: string;
}

/**
 * Pinned messages of a channel or a conversation.
 *
 * The official client reads them straight from `messages` (`is_pinned`, ordered by `pinned_at`)
 * rather than the view, and that keeps the row shape the rest of this file already understands.
 * The count comes from `count_pinned_messages`, which is cheaper than asking for the list.
 */
export async function fetchPinnedMessages(
  session: Session,
  scope: { channelId?: string; conversationId?: string }
): Promise<PinnedMessage[]> {
  const filter = scope.conversationId
    ? `conversation_id=eq.${encodeURIComponent(scope.conversationId)}`
    : `channel_id=eq.${encodeURIComponent(scope.channelId ?? '')}`;
  const rows = await rest<Row[]>(
    session,
    'messages',
    `${filter}&is_pinned=eq.true&is_deleted=eq.false&order=pinned_at.desc&limit=50` +
      '&select=id,created_at,pinned_at,content,user_id'
  ).catch(() => [] as Row[]);

  const ids = [...new Set(rows.map((r) => String(r.user_id ?? '')).filter(Boolean))];
  const profiles: Row[] = ids.length
    ? await rest<Row[]>(
        session,
        'profiles',
        `or=(id.in.(${ids.map(encodeURIComponent).join(',')}),auth_user_id.in.(${ids
          .map(encodeURIComponent)
          .join(',')}))&select=id,auth_user_id,username,display_name,avatar_url,color`
      ).catch(() => [] as Row[])
    : [];
  const byId = new Map<string, Row>();
  for (const p of profiles) {
    byId.set(String(p.id), p);
    if (p.auth_user_id) byId.set(String(p.auth_user_id), p);
  }

  return rows.map((row) => {
    const author = toAuthor(byId.get(String(row.user_id)) ?? { username: 'unknown' }, session);
    return {
      id: String(row.id),
      author: author.name,
      initial: author.initial,
      color: author.color,
      avatarUrl: author.avatarUrl,
      text: renderContentParts(row.content).text.slice(0, 200),
      pinnedAt: typeof row.pinned_at === 'string' ? row.pinned_at : '',
    };
  });
}

export async function countPinnedMessages(
  session: Session,
  scope: { channelId?: string; conversationId?: string }
): Promise<number> {
  try {
    const count = await rpc<number>(session, 'count_pinned_messages', {
      p_channel_id: scope.channelId ?? null,
      p_conversation_id: scope.conversationId ?? null,
    });
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

/** Pinning is a permission on the instance; a refusal surfaces as an error, not a silent no-op. */
export async function setPinned(session: Session, messageId: string, pinned: boolean): Promise<void> {
  await rpc(session, pinned ? 'pin_message' : 'unpin_message', { p_message_id: messageId });
}

/** One direct conversation, as the sidebar needs it. */
export interface Conversation {
  id: string;
  type: string;
  title: string;
  /** The other person in a direct conversation; absent for a group. */
  other?: { id?: string; name: string; initial: string; color: string; avatarUrl?: string; handle: string };
  lastText: string;
  lastAt: string;
  unread: number;
  mentions: number;
  muted: boolean;
}

/**
 * The account's conversations, in one call (`get_user_conversations` brings the participants, the
 * last message and the counters together). Hidden conversations are dropped, as the official
 * client does: hiding one is a deliberate act.
 */
export async function fetchConversations(session: Session): Promise<Conversation[]> {
  const rows = await rpc<
    {
      conversation_id?: string;
      type?: string;
      name?: string | null;
      is_muted?: boolean;
      hidden_at?: string | null;
      last_message?: Record<string, unknown> | null;
      other_participants?: unknown;
      unread_messages?: number;
      unread_mentions?: number;
      updated_at?: string;
    }[]
  >(session, 'get_user_conversations', {});

  return (rows ?? [])
    .filter((row) => typeof row.conversation_id === 'string' && !row.hidden_at)
    .map((row) => {
      const others = Array.isArray(row.other_participants) ? row.other_participants : [];
      const profiles = others
        .map((entry) => {
          const wrapper = entry as { profile?: Row } | Row;
          return (wrapper as { profile?: Row }).profile ?? (wrapper as Row);
        })
        .filter((p): p is Row => !!p && typeof p === 'object' && typeof (p as Row).id === 'string');
      const first = profiles[0];
      const author = first ? toAuthor(first, session) : null;
      const handle = first
        ? `@${String(first.username ?? '')}${typeof first.domain === 'string' && first.domain ? `@${first.domain}` : ''}`
        : '';
      const last = (row.last_message ?? {}) as Record<string, unknown>;
      const parts = Array.isArray(last.content) ? renderContentParts(last.content) : { text: '' };
      const title = author?.name || (typeof row.name === 'string' && row.name) || 'Conversation';
      return {
        id: String(row.conversation_id),
        type: String(row.type ?? 'direct'),
        title,
        other: author ? { id: author.id, name: author.name, initial: author.initial, color: author.color, avatarUrl: author.avatarUrl, handle } : undefined,
        lastText: String(parts.text ?? '').slice(0, 140),
        lastAt: String(last.created_at ?? row.updated_at ?? ''),
        unread: Number(row.unread_messages ?? 0),
        mentions: Number(row.unread_mentions ?? 0),
        muted: row.is_muted === true,
      } satisfies Conversation;
    })
    .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
}

/** Opens the direct conversation with somebody, creating it the first time. */
export async function createDirectConversation(
  session: Session,
  meId: string,
  otherId: string
): Promise<string | null> {
  const id = await rpc<string>(session, 'create_or_get_direct_conversation', {
    user1_uuid: meId,
    user2_uuid: otherId,
  });
  return typeof id === 'string' && id ? id : null;
}

/** A message in a direct conversation. Same shape as a channel message, different column. */
export async function sendConversationMessage(
  session: Session,
  conversationId: string,
  userId: string,
  content: string,
  id?: string,
  files: UploadedFile[] = [],
  emoji: { id?: string; name: string; url: string }[] = []
): Promise<void> {
  // The same part shape a channel message uses: other clients render the attachment from `url` and
  // classify it by `fileType`, and a year-long link is what they read verbatim.
  const signed = files.length
    ? await signMedia(session, files.map((f) => f.path), 365 * 24 * 60 * 60)
    : {};
  const res = await fetch(`${session.supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...(id ? { id } : {}),
      conversation_id: conversationId,
      user_id: userId,
      content: [
        ...composeContent(content, emoji ?? []),
        ...files.map((f) => ({
          type: 'file',
          path: f.path,
          ...(signed[f.path] ? { url: signed[f.path] } : {}),
          fileName: f.name,
          fileSize: f.size,
          fileType: kindOf(f.contentType),
          mime_type: f.contentType,
        })),
      ],
      ...(files.length ? { media_paths: files.map((f) => f.path) } : {}),
    }),
  });
  // The same idempotency contract as a channel send.
  if (res.status === 409 || res.status === 23505) return;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`send: ${res.status} ${body.slice(0, 200)}`);
  }
}

/** One entry of the instance's notification list, flattened for the panel. */
export interface NotificationItem {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  /** Who caused it, when the type has somebody behind it. */
  actor?: { name: string; avatarUrl?: string; handle: string };
  /** A line above the detail, for types that are not a message (security notices). */
  title?: string;
  text: string;
  serverId?: string;
  channelId?: string;
  messageId?: string;
  where?: string;
}

/**
 * The instance's own notification list (`get_user_notifications`), flattened.
 *
 * The payload differs per type — a mention carries `sender`/`message`/`location`, a security notice
 * carries an IP and an event name — so everything here is optional and the panel falls back to the
 * type name. Reading it through the RPC rather than the table keeps the shape the instance intends.
 */
export async function fetchNotifications(
  session: Session,
  profileId: string,
  opts: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<NotificationItem[]> {
  const rows = await rpc<
    {
      id?: string;
      type?: string;
      is_read?: boolean;
      created_at?: string;
      data?: Record<string, unknown> | null;
    }[]
  >(session, 'get_user_notifications', {
    p_user_id: profileId,
    p_limit: opts.limit ?? 30,
    p_offset: opts.offset ?? 0,
    p_unread_only: opts.unreadOnly === true,
  });

  return (rows ?? []).map((row) => {
    const data = (row.data ?? {}) as Record<string, unknown>;
    const location = (data.location ?? {}) as Record<string, unknown>;
    const sender = (data.sender ?? {}) as Record<string, unknown>;
    const message = (data.message ?? {}) as Record<string, unknown>;
    const senderName =
      (typeof data.sender_display_name === 'string' && data.sender_display_name) ||
      (typeof sender.display_name === 'string' && sender.display_name) ||
      (typeof data.sender_username === 'string' && data.sender_username) ||
      (typeof sender.username === 'string' && sender.username) ||
      '';
    const event = typeof data.event === 'string' ? data.event : '';
    const preview =
      (typeof data.preview === 'string' && data.preview) ||
      (typeof message.content_preview === 'string' && message.content_preview) ||
      (event && !String(row.type ?? '').includes('security') ? event : '') ||
      '';
    const channelName = typeof location.channel_name === 'string' ? location.channel_name : undefined;
    const serverName = typeof location.server_name === 'string' ? location.server_name : undefined;
    return {
      id: String(row.id ?? ''),
      type: String(row.type ?? 'notification'),
      isRead: row.is_read === true,
      createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      actor: senderName
        ? {
            name: senderName,
            avatarUrl: avatarUrl(sender.avatar_url, session),
            handle:
              (typeof sender.handle === 'string' && sender.handle) ||
              (typeof sender.username === 'string' ? `@${sender.username}` : ''),
          }
        : undefined,
      // A security notice reads as a sentence, not as `new_sign_in` thirty-two times: the event
      // name becomes the title and the device/address the detail.
      title: event ? SECURITY_TITLES[event] ?? event.replace(/_/g, ' ') : undefined,
      text:
        String(row.type ?? '') === 'security'
          ? [describeDevice(typeof data.user_agent === 'string' ? data.user_agent : null), typeof data.ip === 'string' ? data.ip : '']
              .filter(Boolean)
              .join(' · ')
          : preview,
      serverId:
        typeof location.server_id === 'string'
          ? location.server_id
          : typeof data.server_id === 'string'
            ? data.server_id
            : undefined,
      channelId:
        typeof location.channel_id === 'string'
          ? location.channel_id
          : typeof data.channel_id === 'string'
            ? data.channel_id
            : undefined,
      messageId:
        typeof message.id === 'string'
          ? message.id
          : typeof data.message_id === 'string'
            ? data.message_id
            : undefined,
      where: [serverName, channelName].filter(Boolean).join(' · ') || undefined,
    };
  });
}

/**
 * How many notifications are unread.
 *
 * `get_unread_notification_count` is not granted to the authenticated role on a real instance
 * (`42501 permission denied for function`), so the count comes from the list itself — which also
 * warms the panel. Kept for deployments where it is granted.
 */
export async function fetchUnreadNotificationCount(
  session: Session,
  profileId: string
): Promise<number> {
  try {
    const count = await rpc<number>(session, 'get_unread_notification_count', { p_user_id: profileId });
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Marks specific entries read. Opening one notification must not clear the other twenty-six, which
 * is what the instance's "all read" helper would do.
 */
export async function markNotificationsRead(
  session: Session,
  profileId: string,
  ids: string[]
): Promise<void> {
  if (!ids.length) return;
  const list = ids.map(encodeURIComponent).join(',');
  const res = await fetch(
    `${session.supabaseUrl}/rest/v1/notifications?user_id=eq.${encodeURIComponent(profileId)}&id=in.(${list})`,
    {
      method: 'PATCH',
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ is_read: true }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`notifications: ${res.status} ${body.slice(0, 120)}`);
  }
}

/** Clears the whole list's unread state through the instance's own helper. */
export async function markAllNotificationsRead(session: Session, profileId: string): Promise<void> {
  await rpc(session, 'mark_all_notifications_read', { p_user_id: profileId });
}

export async function fetchNotificationPrefs(
  session: Session,
  profileId: string
): Promise<NotificationPrefs | null> {
  const rows = await rest<Row[]>(
    session,
    'notification_preferences',
    `user_id=eq.${encodeURIComponent(profileId)}` +
      '&select=dnd_enabled,dnd_start_time,dnd_end_time,push_mentions,push_dms,' +
      'desktop_mentions,desktop_replies,desktop_dms,desktop_reactions,desktop_chat_messages,' +
      'sound_mentions,sound_replies,sound_dms,sound_reactions,sound_chat_messages&limit=1'
  ).catch(() => [] as Row[]);
  const row = rows[0];
  if (!row) return null;
  return {
    dndEnabled: row.dnd_enabled === true,
    dndStart: typeof row.dnd_start_time === 'string' ? row.dnd_start_time : null,
    dndEnd: typeof row.dnd_end_time === 'string' ? row.dnd_end_time : null,
    pushMentions: row.push_mentions !== false,
    pushDms: row.push_dms !== false,
    desktop: {
      mentions: row.desktop_mentions !== false,
      replies: row.desktop_replies !== false,
      dms: row.desktop_dms !== false,
      reactions: row.desktop_reactions !== false,
      messages: row.desktop_chat_messages !== false,
    },
    sound: {
      mentions: row.sound_mentions !== false,
      replies: row.sound_replies !== false,
      dms: row.sound_dms !== false,
      reactions: row.sound_reactions !== false,
      messages: row.sound_chat_messages !== false,
    },
  };
}

/**
 * Writes one preference. The instance stores a row of booleans, and the client only ever writes the
 * ones the settings screen shows — a field it does not understand is left as the instance has it.
 */
export async function setPreference(
  session: Session,
  profileId: string,
  patch: Record<string, boolean>
): Promise<void> {
  const res = await fetch(
    `${session.supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${encodeURIComponent(profileId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`preference: ${res.status} ${body.slice(0, 120)}`);
  }
}

/** Turns do-not-disturb on or off; the window itself is left as the instance has it. */
export async function setDnd(session: Session, profileId: string, enabled: boolean): Promise<void> {
  const res = await fetch(
    `${session.supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${encodeURIComponent(profileId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: session.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ dnd_enabled: enabled }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`dnd: ${res.status} ${body.slice(0, 120)}`);
  }
}

/** The same cursor move for a direct conversation. */
export async function markConversationRead(
  session: Session,
  conversationId: string,
  messageId?: string | null
): Promise<void> {
  try {
    await rpc(session, 'mark_conversation_as_read', {
      p_conversation_id: conversationId,
      p_message_id: messageId ?? null,
    });
  } catch {
    /* an unread counter is not worth breaking the screen over */
  }
}

/** Moves the read cursor; the instance recomputes the counters from it. */
export async function markChannelRead(session: Session, channelId: string, messageId?: string | null): Promise<void> {
  try {
    await rpc(session, 'mark_channel_as_read', { p_channel_id: channelId, p_message_id: messageId ?? null });
  } catch {
    /* an unread counter is not worth breaking the screen over */
  }
}
