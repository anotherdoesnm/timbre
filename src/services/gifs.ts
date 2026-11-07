/**
 * GIFs, through the instance.
 *
 * The instance proxies klipy (`/api/federation/gifs/…`) and needs the user's token; the key itself
 * never reaches a client. An instance without the key answers 503, which is a fact to show, not an
 * error to hide.
 */
import type { Session } from './auth';

export interface Gif {
  id: string;
  title: string;
  /** Media we send and render: the gif (or webp) file itself. */
  media: string;
  /** A smaller still for the grid. */
  preview: string;
  /** Klipy's own page, used for attribution when there is one. */
  itemUrl?: string;
}

interface Feed {
  items?: {
    kind?: string;
    id?: string;
    title?: string;
    itemUrl?: string;
    isVideo?: boolean;
    media_formats?: {
      gif?: { url?: string };
      gifpreview?: { url?: string };
      mp4?: { url?: string };
    };
  }[];
}

export async function fetchGifs(
  session: Session,
  options: { query?: string; page?: number; limit?: number } = {}
): Promise<{ gifs: Gif[]; hasNext: boolean; unavailable?: boolean }> {
  const query = (options.query ?? '').trim();
  const params = new URLSearchParams({
    per_page: String(options.limit ?? 24),
    page: String(options.page ?? 1),
  });
  if (query) params.set('q', query);
  const path = query ? 'search' : 'trending';
  const res = await fetch(`https://${session.instance}/api/federation/gifs/${path}?${params}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      apikey: session.anonKey,
    },
  });
  if (res.status === 503) return { gifs: [], hasNext: false, unavailable: true };
  if (!res.ok) throw new Error(`gifs: ${res.status} ${(await res.text()).slice(0, 120)}`);
  const feed = (await res.json().catch(() => ({}))) as Feed;
  const gifs: Gif[] = [];
  for (const item of feed.items ?? []) {
    if (item.kind && item.kind !== 'gif') continue; // ads and other media feeds
    const formats = item.media_formats ?? {};
    // A still-first choice: an image renders everywhere, including the clients that show a GIF
    // link as a picture, while an mp4 does not.
    const media = formats.gif?.url ?? formats.gifpreview?.url ?? formats.mp4?.url;
    if (!media) continue;
    gifs.push({
      id: String(item.id ?? media),
      title: item.title ?? 'GIF',
      media,
      preview: formats.gifpreview?.url ?? media,
      itemUrl: item.itemUrl,
    });
  }
  return { gifs, hasNext: true };
}
