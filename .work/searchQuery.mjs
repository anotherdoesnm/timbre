/**
 * Reading `in:#channel from:person has:image …` out of a search box.
 *
 * Kept apart from the panel and from the network so it can be reasoned about on its own: this is a
 * pure function from what a person typed to what the RPC should be asked.
 */


const FILTER = /(^|\s)(in|from|has|before|after):(\S+)/gi;

/** `has:image`, `has:link`; anything else is not a filter this client understands. */
function parseHas(value) {
  const v = value.toLowerCase();
  if (v === 'image' || v === 'media' || v === 'file') return 'image';
  if (v === 'link' || v === 'url') return 'link';
  return undefined;
}

/** `before:2026-11-01` or `before:yesterday`-style relative words stay unparsed rather than guessed. */
function parseDate(value): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`).toISOString();
  return undefined;
}

function parseSearchQuery(raw) {
  const parsed = { text: '' };
  let rest = raw ?? '';
  for (const match of [...rest.matchAll(FILTER)]) {
    const [whole, lead, key, value] = match;
    const lower = key.toLowerCase();
    if (lower === 'in') {
      const channel = value.replace(/^#/, '');
      if (channel.toLowerCase() === 'dm' || channel.toLowerCase() === 'dms') parsed.inDirect = true;
      else parsed.channel = channel;
    } else if (lower === 'from') {
      parsed.from = value.replace(/^@/, '');
    } else if (lower === 'has') {
      const has = parseHas(value);
      if (has) parsed.has = has;
      else continue;
    } else if (lower === 'before' || lower === 'after') {
      const date = parseDate(value);
      if (!date) continue;
      if (lower === 'before') parsed.before = date;
      else parsed.after = date;
    }
    // Only remove a filter that was understood; the rest stays as searchable text.
    rest = rest.replace(whole, lead);
  }
  parsed.text = rest.replace(/\s+/g, ' ').trim();
  return parsed;
}

export { parseSearchQuery };
