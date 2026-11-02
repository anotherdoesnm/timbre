# Timbre — roadmap

What is done, what is next, and what is blocked by someone else.

## Done

- Cinny-style skin on Vue 3: layout, palette, typography, one-pane phone layout.
- Instance discovery: `GET /api/federation/instance-info` + providers from GoTrue `/settings`.
- OAuth: PKCE authorize URL, popup on desktop, callback parsing by path and by `?code=`.
- Password sign-in — the one flow an instance's redirect allowlist cannot block.
- Session tooling: bring-your-own-session, JWT validation (refuses the anon key),
  refresh on entry, per-instance storage.
- Live data: profile, servers (`user_servers`), channels, messages with the author join.
- Message sending (table insert; RLS decides, errors are shown, not swallowed).
- Builds: arm64 debug APK (19 MiB), AppImage, Windows NSIS installer, published to
  `builds.doesnmlab.xyz` and announced in a channel webhook.

## Next

- **Realtime**: subscribe to the Broadcast channels the triggers publish, so a message
  appears without a reload.
- **Message rendering**: markdown, links, mentions, custom emoji, attachments, replies.
- **Registration + onboarding in the client**: create an account with an email (temporary
  mailboxes included in the flow), confirm it, then pick a username — today both steps send
  the user to the web app.
- Server switching on the phone (the rail is hidden below 860px).
- Unread state, notification levels, search.
- `get_message_page` RPC for pagination instead of "the last 80 rows".

## Blocked elsewhere

- **OAuth for third-party clients**: `ADDITIONAL_REDIRECT_URLS` is `https://<domain>` by
  default (`self-host/configure.sh`), so a native client's `${origin}/auth/callback` is
  refused and the browser is sent to SITE_URL. Needs `http://tauri.localhost/**` and
  `tauri://localhost/**` on the instance — this also breaks the official app's own OAuth.
- **Forgejo Releases as an artifact host**: 124 MiB APKs exceed the attachment limit;
  `builds.doesnmlab.xyz` serves them read-only instead.

## Known limits

- E2EE: encrypted channels render a placeholder and disable the composer. Reusing upstream's
  encryption service is the intended path, not writing one.
- Desktop installers are unsigned (cross-compiled); Windows shows SmartScreen.
