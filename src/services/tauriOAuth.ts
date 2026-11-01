/**
 * OAuth inside the Tauri shell.
 *
 * Navigating the main webview to the provider strands the user on an external page with no
 * browser chrome, so the provider flow runs in a separate window that lands back on
 * `/auth/callback`. That callback is served by our own origin (`tauri://localhost` or
 * `http://tauri.localhost`), so it stores the session where the main window can see it —
 * same origin, same storage — and then signals completion and closes.
 *
 * The instance has to allow that redirect; the official desktop app signs in the same way,
 * so its entry already exists in `ADDITIONAL_REDIRECT_URLS`.
 */

export const OAUTH_WINDOW_LABEL = 'oauth';
export const OAUTH_COMPLETE_EVENT = 'timbre:oauth-complete';

const POLL_MS = 800;

/**
 * Android and iOS run one webview: a second window is not something the platform gives us,
 * so there the provider flow takes over the main window and comes back through
 * `/auth/callback`. Desktop keeps the popup.
 */
export function isMobileShell(): boolean {
  if (!isTauriRuntime()) return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isTauriRuntime(): boolean {
  const g = globalThis as Record<string, unknown>;
  return typeof g.__TAURI_INTERNALS__ !== 'undefined' || typeof g.__TAURI__ !== 'undefined';
}

export async function isOAuthPopup(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().label === OAUTH_WINDOW_LABEL;
  } catch {
    return false;
  }
}

/**
 * Opens the provider URL in a popup window and resolves once the callback reports success.
 * Rejects with `oauth-cancelled` when the user closes the window first: window-destroyed
 * events do not reliably cross windows, so the popup's existence is polled instead.
 */
export async function signInViaOAuthPopup(providerUrl: string): Promise<void> {
  if (isMobileShell()) {
    // One webview only: navigate it and let the callback route pick the session up.
    location.assign(providerUrl);
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const { listen } = await import('@tauri-apps/api/event');

  const existing = await WebviewWindow.getByLabel(OAUTH_WINDOW_LABEL);
  if (existing) await existing.close().catch(() => undefined);

  new WebviewWindow(OAUTH_WINDOW_LABEL, {
    url: providerUrl,
    title: 'Вход в Timbre',
    width: 520,
    height: 720,
    resizable: true,
    center: true,
  });

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let unlisten: (() => void) | undefined;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      unlisten?.();
      fn();
    };

    const pollTimer = setInterval(() => {
      WebviewWindow.getByLabel(OAUTH_WINDOW_LABEL)
        .then((win) => {
          if (!win) settle(() => reject(new Error('oauth-cancelled')));
        })
        .catch(() => undefined);
    }, POLL_MS);

    listen(OAUTH_COMPLETE_EVENT, () => settle(() => resolve())).then((off) => {
      unlisten = off;
      if (settled) off();
    });
  });
}

/** Called from the popup after the session is stored: notify the main window, then close. */
export async function finishOAuthPopup(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { emit } = await import('@tauri-apps/api/event');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await emit(OAUTH_COMPLETE_EVENT);
    await getCurrentWindow().close();
  } catch {
    /* the main window will fall back to the session in storage */
  }
}
