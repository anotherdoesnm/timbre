/**
 * Per-channel drafts.
 *
 * A chat client on a phone is interrupted constantly — a call, a notification, the browser
 * dropping the tab — and losing a half-written message because the composer lives in memory is the
 * kind of thing people stop forgiving. The text is kept per instance and channel in `localStorage`,
 * which is also where a reload can find it.
 *
 * Nothing here throws: storage can be disabled, full, or private-mode limited, and a draft is never
 * worth breaking the composer over.
 */

const PREFIX = 'timbre.draft.';

function key(instance: string, channelId: string): string {
  return `${PREFIX}${instance}.${channelId}`;
}

export function loadDraft(instance: string | undefined, channelId: string | undefined): string {
  if (!instance || !channelId) return '';
  try {
    return localStorage.getItem(key(instance, channelId)) ?? '';
  } catch {
    return '';
  }
}

export function saveDraft(
  instance: string | undefined,
  channelId: string | undefined,
  text: string
): void {
  if (!instance || !channelId) return;
  try {
    // An empty draft is the same as no draft; keeping thousands of empty keys is not free.
    if (text.trim()) localStorage.setItem(key(instance, channelId), text);
    else localStorage.removeItem(key(instance, channelId));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearDraft(instance: string | undefined, channelId: string | undefined): void {
  if (!instance || !channelId) return;
  try {
    localStorage.removeItem(key(instance, channelId));
  } catch {
    /* nothing to clear */
  }
}
