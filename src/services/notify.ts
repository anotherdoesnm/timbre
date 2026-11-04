/**
 * "While the app is open" notifications.
 *
 * Real push is out of reach here for two separate reasons. A browser could use Web Push, but that
 * needs a service worker plus a subscription endpoint per device, and this client has neither;
 * the Android shell cannot, because a WebView has no `PushManager` at all — Harmony's own app
 * talks to a native plugin for that (`plugin:harmony-push`). So this module does the honest
 * middle: a title badge, a system notification where the platform has one, a vibration for
 * mentions, and a toast inside the app for the shell, which has no title.
 */

const BASE_TITLE = 'Timbre — a Harmony client';

/** Unread total in the window title, which is the only badge a browser tab has. */
export function setTitleBadge(count: number): void {
  if (typeof document === 'undefined') return;
  document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
}

export type Permission = 'unsupported' | 'default' | 'granted' | 'denied';

export function notifyPermission(): Permission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as Permission;
}

/** Must be called from a user gesture: browsers ignore, and some throw, otherwise. */
export async function requestNotify(): Promise<Permission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as Permission;
  } catch {
    return notifyPermission();
  }
}

/**
 * A system notification, when the platform has them and the user allowed them. Tapping it focuses
 * the app and runs the callback, which is how a mention in another channel gets you there.
 */
export function showNotification(title: string, body: string, onClick?: () => void): void {
  if (notifyPermission() !== 'granted') return;
  try {
    const note = new Notification(title, { body, tag: `timbre-${title}`, silent: false });
    note.onclick = () => {
      window.focus();
      onClick?.();
      note.close();
    };
  } catch {
    /* a webview can have the constructor and still refuse to show anything */
  }
}

/** A short vibration for mentions, where the device does haptics at all. */
export function buzz(pattern: number | number[] = [12, 40, 12]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no haptics */
  }
}

/** Names a mention can use: the handle and the display name, lower-cased. */
export function mentionNames(username?: string, displayName?: string): string[] {
  return [username, displayName]
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .map((n) => n.toLowerCase().replace(/^@/, ''));
}

/**
 * Does this message address the signed-in user? Harmony writes mentions as their own content part
 * (`{type:'mention', username}`); the text check covers clients that only write `@name`, and the
 * metadata array is what the server records for its own counters.
 */
export function mentions(content: unknown, names: string[], meta?: unknown): boolean {
  if (!names.length) return false;
  const recorded = (meta as { mentions?: unknown } | null)?.mentions;
  if (Array.isArray(recorded)) {
    for (const entry of recorded) {
      const handle = String(entry ?? '')
        .toLowerCase()
        .replace(/^@/, '');
      if (names.includes(handle)) return true;
    }
  }
  const parts = Array.isArray(content) ? content : [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const o = part as Record<string, unknown>;
    if (String(o.type) === 'mention') {
      const handle = String(o.username ?? o.name ?? '')
        .toLowerCase()
        .replace(/^@/, '');
      if (names.includes(handle)) return true;
    }
    if (typeof o.text === 'string') {
      const text = o.text.toLowerCase();
      if (names.some((n) => text.includes(`@${n}`))) return true;
    }
  }
  return false;
}

/** First line of a message, for the notification body. */
export function preview(content: unknown): string {
  const parts = Array.isArray(content) ? content : [];
  for (const part of parts) {
    if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
      const text = (part as { text: string }).text.trim();
      if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
    }
  }
  return 'New message';
}
