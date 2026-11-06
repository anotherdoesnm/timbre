/**
 * The small subset of message formatting that matters in a chat: inline code, bold, italic,
 * bare links and @mentions.
 *
 * This is deliberately not a markdown library and deliberately not `v-html`. Message text is
 * whatever a stranger on the other side typed, so it is parsed into typed segments and rendered
 * as elements — a URL is an `<a>`, a backtick run is a `<code>`, and nothing else can become
 * markup. Rendering with innerHTML would turn one paste into a very bad day.
 */

export type SegmentKind =
  | 'text'
  | 'code'
  | 'bold'
  | 'italic'
  | 'link'
  | 'mention'
  | 'channel'
  | 'emoji';

export interface Segment {
  kind: SegmentKind;
  text: string;
  /** Only for links. */
  href?: string;
  /** Only for emoji: the picture to draw instead of the shortcode. */
  image?: string;
}

// Order matters: code before emphasis, bold before italic, and a mention may not swallow the
// `@` of an email (hence the boundary check below). A `#` reference must start with a letter, so
// "issue #42" stays text while `#new-builds` becomes a link to the channel.
const PATTERN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(https?:\/\/[^\s<>"]+)|(^|[\s(])@([a-z0-9_.-]{2,32})|(^|[\s(])#([a-z][a-z0-9_-]{1,31})(?![a-z0-9_-])/gi;

/** Trailing punctuation belongs to the sentence, not to the URL. */
function trimUrl(url: string): { url: string; tail: string } {
  const match = /[.,)!?:;]+$/.exec(url);
  if (!match) return { url, tail: '' };
  return { url: url.slice(0, -match[0].length), tail: match[0] };
}

export function parseSegments(input: string): Segment[] {
  const text = input ?? '';
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  const pushText = (value: string) => {
    if (!value) return;
    const previous = out[out.length - 1];
    // Merge neighbours so a paragraph is one text node rather than dozens.
    if (previous && previous.kind === 'text') previous.text += value;
    else out.push({ kind: 'text', text: value });
  };

  PATTERN.lastIndex = 0;
  while ((m = PATTERN.exec(text)) !== null) {
    const [whole, code, bold, italic, underscore, url, boundary, handle, chBoundary, channel] = m;
    if (m.index > last) pushText(text.slice(last, m.index));

    if (code) {
      out.push({ kind: 'code', text: code.slice(1, -1) });
    } else if (bold) {
      out.push({ kind: 'bold', text: bold.slice(2, -2) });
    } else if (italic) {
      out.push({ kind: 'italic', text: italic.slice(1, -1) });
    } else if (underscore) {
      out.push({ kind: 'italic', text: underscore.slice(1, -1) });
    } else if (url) {
      const { url: clean, tail } = trimUrl(url);
      out.push({ kind: 'link', text: clean, href: clean });
      pushText(tail);
      // LastIndex has to account for the tail we just consumed.
      PATTERN.lastIndex = m.index + whole.length;
    } else if (channel) {
      pushText(chBoundary ?? '');
      out.push({ kind: 'channel', text: `#${channel}` });
      PATTERN.lastIndex = m.index + whole.length;
    } else if (handle) {
      pushText(boundary ?? '');
      // The handle class allows dots, so "ping @kirill." captured the sentence's full stop and the
      // profile lookup asked for a person called `kirill.`. Punctuation at the end belongs to the
      // sentence; a handle that is nothing but punctuation is not a mention at all.
      const trimmed = handle.replace(/[.,;:!?]+$/, '');
      if (trimmed.length >= 2) {
        out.push({ kind: 'mention', text: `@${trimmed}` });
        pushText(handle.slice(trimmed.length));
      } else {
        out.push({ kind: 'text', text: whole });
      }
      PATTERN.lastIndex = m.index + whole.length;
    } else {
      pushText(whole);
    }
    last = m.index + whole.length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

/** Only http(s) links are rendered as links; everything else stays text. */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
