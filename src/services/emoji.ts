/**
 * The emoji a person can put into a message or a reaction.
 *
 * Names and shortcodes come from `unicode-emoji-json` and `gemoji` — the same pair upstream builds
 * its picker from — and are loaded on first use, so the data is a separate chunk rather than part
 * of the shell. Custom emoji belong to an instance and are fetched from it.
 */
import { rest } from './api';
import type { Session } from './auth';

export interface EmojiEntry {
  char: string;
  name: string;
  slug: string;
  group: string;
  /** `:joy:`-style aliases; empty for most emoji. */
  shortcodes: string[];
}

export interface CustomEmoji {
  name: string;
  url: string;
  scope?: string;
}

let index: EmojiEntry[] | null = null;

/** Unicode data, lazily. Called from the picker's mount so startup stays small. */
export async function loadEmojiIndex(): Promise<EmojiEntry[]> {
  if (index) return index;
  const [unicode, gemojiModule] = await Promise.all([
    import('unicode-emoji-json'),
    import('gemoji'),
  ]);
  const byChar = new Map<string, string[]>();
  const gemoji = (gemojiModule as unknown as { gemoji?: { emoji: string; names: string[] }[] }).gemoji ?? [];
  for (const entry of gemoji) {
    const list = byChar.get(entry.emoji) ?? [];
    list.push(...entry.names);
    byChar.set(entry.emoji, list);
  }
  const data = (unicode as unknown as { default?: Record<string, unknown> }).default ?? (unicode as unknown as Record<string, unknown>);
  index = Object.entries(data as Record<string, { name: string; slug: string; group: string }>).map(
    ([char, meta]) => ({
      char,
      name: meta.name,
      slug: meta.slug,
      group: meta.group,
      shortcodes: byChar.get(char) ?? [],
    })
  );
  return index;
}

/**
 * Search by name or shortcode. An empty query returns the head of the list, so the picker opens
 * with something rather than a blank grid.
 */
export function searchEmoji(entries: EmojiEntry[], query: string, limit = 60): EmojiEntry[] {
  const q = query.trim().toLowerCase().replace(/^:|:$/g, '');
  if (!q) return entries.slice(0, limit);
  const exact: EmojiEntry[] = [];
  const loose: EmojiEntry[] = [];
  for (const entry of entries) {
    if (entry.shortcodes.includes(q)) exact.push(entry);
    else if (entry.name.includes(q) || entry.slug.includes(q)) loose.push(entry);
    if (exact.length >= limit) break;
  }
  return [...exact, ...loose].slice(0, limit);
}

/** Custom emoji the instance offers to this person, newest names first. */
export async function fetchCustomEmojis(session: Session): Promise<CustomEmoji[]> {
  const rows = await rest<Record<string, unknown>[]>(
    session,
    'emojis',
    'select=name,url,scope&order=name.asc&limit=500'
  ).catch(() => [] as Record<string, unknown>[]);
  const out: CustomEmoji[] = [];
  for (const row of rows) {
    if (typeof row.name !== 'string' || typeof row.url !== 'string') continue;
    out.push({
      name: row.name,
      url: row.url,
      scope: typeof row.scope === 'string' ? row.scope : undefined,
    });
  }
  return out;
}
