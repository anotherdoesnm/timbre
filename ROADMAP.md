# Timbre — roadmap

Where the client stands, what is next, and what is blocked elsewhere.
Updated 2026-11-02.

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

## Observed in build 1c01cd1 (being fixed now)

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
3. **In-client registration and onboarding**: sign up with an email (one-time mailboxes
   included in the flow), confirm it, pick a username — both steps still send the user to the
   web app.
4. **Unread state, notification levels, search** (`get_message_page` RPC for pagination).
5. **Settings screen**: switch instance, sign out, choose theme, toggle reduced motion.
6. **E2EE**: encrypted channels are a placeholder today; the plan is to reuse upstream's
   `src/services/encryption/` rather than write one.
7. **Polish**: signed attachment URLs expire, so old images will break until re-signed; date
   separators; long-press context menu; keyboard shortcuts on desktop.

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
- Self-hosted instance for a live "Timbre instead of the official web" test: 2 GiB LXC on the
  homelab, no CPU pins, federation off. Not started (RAM was the concern; zram optional).
