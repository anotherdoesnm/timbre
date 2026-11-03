# Timbre — roadmap

Where the client stands, what is next, and what is blocked elsewhere.
Updated 2026-11-03.

## Done

- Cinny-style skin on Vue 3: layout, palette, typography, phone layout with a one-pane
  channel list and a top server strip.
- Discovery: `GET /api/federation/instance-info`, providers from GoTrue `/settings`,
  capabilities, four failure modes (timeout, HTTP, not-Harmony, network).
- Sign-in: password (works everywhere) and OAuth (PKCE; popup on desktop, redirect on phone —
  blocked by the instance, see below). Session import for bringing a session from the web app.
- Sessions: stored per instance, JWT validated (the anon key is refused by name), refreshed
  before expiry and on app resume, never thrown away on a failed refresh.
- Live data: profile, servers (`user_servers`, deduped), channels with `channel_categories`
  names, messages with authors resolved from `user_id` **or** `metadata.subject_id`,
  attachments from the jsonb parts.
- Sending: `content` must be an array of parts (`messages_content_is_array`); errors surface.
- Builds: arm64 debug APK (19 MiB, stripped), AppImage, Windows NSIS installer; published to
  `builds.doesnmlab.xyz` and announced by a channel webhook. CI runs on request or on a tag.
- **Test instance**: `https://timbre.doesnmlab.xyz` — Harmony 1.9.2 on a 2 GiB LXC, federation
  off, and this build is served as its web frontend (replacing the official one in the
  `harmony-web` container). Same-origin means no CORS, no OAuth allowlist problem, and the
  client can be exercised end to end against a real backend.
- **In-client registration**: email + username + password, straight to the instance. GoTrue's
  signup only makes the auth user, so the client also writes the `profiles` row (RLS wants
  `auth_user_id = auth.uid()`) and calls `join_public_server()` for the busiest public server —
  a new account lands in a chat instead of an empty screen. Nothing here needs an operator.

## Fixed after build 1c01cd1 (not in a build yet)

- Flash of mock data before live data. **Fixed**: with a session the shell renders nothing
  until real data arrives.
- The chat opened immediately on a phone. **Fixed**: sign-in lands on the channel list; the
  server rail is back as a horizontal strip.
- No avatars. **Fixed**: `profiles.avatar_url` is fetched and rendered, initials as fallback.
- Per-message buttons still visible everywhere. **Fixed**: touch detection moved from a CSS
  media query to `matchMedia('(hover: none)')`, so the toolbar appears on tap only.

## Next (no external blockers)

1. **Realtime.** Subscribe to the Broadcast channels the triggers publish; today a message
   appears only after reopening the channel.
2. **Message rendering**: markdown, links, mentions, custom emoji (`:dance:` currently shows
   literally), replies, edits, reactions.
   Links, inline code, bold/italic and @mentions now render as elements from a tokeniser (no
   `v-html`), and attachments open full size or say the signed link expired. Still missing:
   replies, edits, reactions, custom emoji.
3. **Unread state, notification levels, search** (`get_message_page` RPC for pagination).
4. **Settings screen**: switch instance, sign out, choose theme, toggle reduced motion.
5. **E2EE**: encrypted channels are a placeholder today; the plan is to reuse upstream's
   `src/services/encryption/` rather than write one.
6. **Polish**: signed attachment URLs expire, so old images will break until re-signed; date
   separators; long-press context menu; keyboard shortcuts on desktop.
7. **Android keyboard and viewport**: the layout now survives the on-screen keyboard
   (`100dvh`, `min-height: 0` on every flex and grid child, `interactive-widget=resizes-content`),
   but the Tauri shell additionally needs `windowSoftInputMode="adjustResize"` — see README.
   Check it on a real device once the APK with these fixes is built.

## Blocked elsewhere

- **OAuth for any native client.** `self-host/configure.sh` writes
  `ADDITIONAL_REDIRECT_URLS="https://$DOMAIN"`, so `${origin}/auth/callback` with
  `origin = http://tauri.localhost` is refused and GoTrue sends the browser to SITE_URL. The
  official app cannot sign in this way either. Needs `http://tauri.localhost/**` and
  `tauri://localhost/**` on the instance — asked; waiting.
- **Forgejo Releases as an artifact host**: attachment size limit versus a 124 MiB universal
  APK. `builds.doesnmlab.xyz` serves the LAN cache read-only instead.

## Open questions

- Does the flagship's `ADDITIONAL_REDIRECT_URLS` really contain only the app origin? One line
  from the operator settles it.
- `messages.user_id` sometimes points at `profiles.id`, sometimes at the auth user id — our
  queries handle both; is one of them deprecated?

## Housekeeping on the test instance

- The LXC rootfs is at 97 % (9.0 G of 9.8 G). Two installer steps fail on free space and any
  image write is one `docker pull` away from failing. Needs `pct resize 170 rootfs +8G` on the
  node, which only the operator can run.
- Deploying a new build into the running instance: `npm run build`, tar `dist`, copy it into the
  `harmony-web` container's `/usr/share/nginx/html` (keep the instance's own `config.json`), no
  restart needed — Caddy serves the container as-is. Ship the tarball through stdin
  (`ssh node 'pct exec 170 -- sh -c "base64 -d > /root/d.tgz"' < d.b64`): a base64 argument on
  the command line overruns `ARG_MAX` long before the tarball is large.
- Nothing has been built since `1c01cd1`; the next APK dispatch carries the four fixes above,
  the English strings and the served-frontend change.
