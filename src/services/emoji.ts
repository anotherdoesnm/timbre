/**
 * The emoji a person can put into a message or a reaction.
 *
 * Names and shortcodes come from `unicode-emoji-json` and `gemoji` — the same pair upstream builds
 * its picker from — and are loaded on first use, so the data is a separate chunk rather than part
 * of the shell. Custom emoji belong to an instance and are fetched from it.
 */
export interface EmojiEntry {
  char: string;
  name: string;
  slug: string;
  group: string;
  /** `:joy:`-style aliases; empty for most emoji. */
  shortcodes: string[];
}

export interface CustomEmoji {
  /** The instance's row id — a reaction made by another client references this, not the name. */
  id?: string;
  name: string;
  url: string;
  scope?: string;
  /** The server it belongs to; absent for the instance's own. */
  serverId?: string;
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

/**
 * What to draw for an emoji named by a reaction or a message part.
 *
 * Three shapes arrive in practice: a plain name (`fire`, `6303_monkaSTEER`), the Discord
 * identifier the bridge writes (`discord:monkaSTEER:1101145607604801586`), and a unicode
 * character. Only the middle one carries its own image; the rest need the instance's emoji list,
 * which is why a chip that "shows text" is usually a lookup that missed.
 */
export function resolveEmoji(
  raw: string,
  list: CustomEmoji[],
  url?: string
): { label: string; url?: string } {
  if (url) return { label: raw, url };
  const discord = /^discord:([^:]*):(\d+)$/.exec(raw);
  if (discord) {
    return {
      label: discord[1] || raw,
      url: `https://cdn.discordapp.com/emojis/${discord[2]}.png`,
    };
  }
  const name = raw.replace(/^:|:$/g, '');
  if (!name) return { label: raw };
  const hit =
    list.find((e) => e.name === name) ??
    list.find((e) => e.name.toLowerCase() === name.toLowerCase()) ??
    list.find((e) => e.id === name);
  return hit ? { label: hit.name, url: hit.url } : { label: name };
}
