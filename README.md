<p align="center">
  <img src="brand/timbre-256.png" width="120" alt="Timbre" />
</p>

# Timbre — a Harmony client

> The name is **Timbre**: a different colour on the same note. “Harmony” is the platform, so it
> is not part of the product name (upstream TRADEMARK); the visible “Powered by Harmony” line
> stays.

A Vue 3 client for Harmony instances, skinned in the spirit of Cinny. It talks to a real instance
over the same public API the official web app uses: discovery, sign-in, servers, channels,
messages, sending. No Supabase SDK — plain `fetch` against GoTrue and PostgREST.

**Live test instance:** <https://timbre.doesnmlab.xyz> — a Harmony 1.9.2 instance whose web
frontend *is* this build. The instance is for testing Timbre, not for real conversations.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## What works

- **Discovery.** `GET /api/federation/instance-info` gives the name, version, Supabase URL and
  anon key; `GET /auth/v1/settings` gives the enabled providers. Four failure modes are
  distinguished: timeout, HTTP error, “responded but is not Harmony”, network/CORS.
- **Sign-in.** Email + password (works on every instance), OAuth through PKCE (desktop popup,
  phone redirect), and importing a session from the official web app (`localStorage` blob).
- **Sign-up.** Email + username + password on the instance itself: the client creates the auth
  user, writes the profile row the policies expect, and joins the busiest public server so the
  account starts in a chat.
- **Sessions.** Stored per instance, JWT expiry respected, refreshed on start and on resume, and
  never discarded because a refresh happened to fail.
- **Live data.** Profile, servers from `user_servers` (deduplicated), channels grouped by
  `channel_categories`, messages with authors resolved through `user_id` **or**
  `metadata.subject_id`, attachments from the jsonb content parts.
- **Sending.** `content` is written as an array of parts — the database enforces
  `messages_content_is_array` — and API errors are shown, not swallowed.
- **Mobile layout.** One pane at a time, a horizontal server strip, tap-to-reveal message
  toolbar.
- **Shells.** Tauri 2 for Android (arm64 debug APK, ~19 MiB) and desktop (AppImage, Windows NSIS).

## Layout

| File | What it does |
|---|---|
| `src/App.vue` | routes, boot/refresh, mobile pane, send handler |
| `src/services/discover.ts` | `instance-info` + provider list, error kinds |
| `src/services/auth.ts` | GoTrue: PKCE start/finish, password grant, refresh, stored sessions |
| `src/services/pkce.ts` | verifier/challenge, state |
| `src/services/tauriOAuth.ts` | popup flow in the desktop shell |
| `src/services/sessionImport.ts` | parse and adopt a session copied from the web app |
| `src/services/api.ts`, `data.ts` | PostgREST reads, message rendering, sends |
| `src/components/AuthScreen.vue` | instance address → instance card → providers / password |
| `src/components/{ServerRail,RoomList,ChatHeader,MessageList,Composer,MemberList}.vue` | the shell |
| `src/styles/tokens.css` | Cinny dark palette, radii, spacing, panel widths |
| `src/data/mock.ts` | demo data for `?demo=1` and screenshots |

## Routes

`#auth` (default) — sign-in; `#chat` — the chat shell; `#auth/callback` — where GoTrue returns.
`?demo=1` swaps in a canned `instance-info` response and marks the card as demo, so screenshots
work without a network. `?demo=1#chat` renders the shell with mock data.

A stored session goes straight to `#chat`; without one the app opens `#auth`.

## Builds

| Workflow | What it produces |
|---|---|
| `.forgejo/workflows/apk.yml` | arm64 debug APK, on request or on a tag |
| `.forgejo/workflows/desktop.yml` | AppImage and Windows NSIS installer, on request or on a tag |

Artifacts land on `https://builds.doesnmlab.xyz/upload/{apk,desktop}/<sha>/…` and a webhook
announces the build. CI is manual on purpose: a full APK takes about ten minutes, so several
fixes are batched into one commit before dispatching.

`src-tauri/debug.keystore` is committed on purpose: without it every fresh CI VM generates a new
debug key and Android refuses to install over the previous build.

## Tauri

`src-tauri/` is the shell; `identifier` is `xyz.doesnmlab.timbre` and the frontend comes from
`dist`.

```bash
npm run build
npx tauri android init --ci      # once; generates src-tauri/gen/android
npx tauri android build --apk --debug --target aarch64
npx tauri build                  # desktop; needs libwebkit2gtk-4.1-dev and rust
```

OAuth inside the shell runs in a popup webview so the main window never navigates: the popup
returns to `/auth/callback`, the session lands in shared storage, and the popup emits
`timbre:oauth-complete` and closes.

After `tauri android init`, set `android:windowSoftInputMode="adjustResize"` on the activity in
`src-tauri/gen/android/app/src/main/AndroidManifest.xml`. Without it the keyboard covers the
composer instead of shrinking the webview, and no amount of CSS fixes that.

## Dev proxy (CORS)

An instance sends no `Access-Control-Allow-Origin` for `instance-info` or `config.json`, so a
browser on `localhost:5173` cannot query it. `vite.config.ts` adds a dev-only relay
(`apply: 'serve'`), which also forwards the `apikey` header GoTrue wants:

```
/__instance/har.mony.lol/api/federation/instance-info   →  https://har.mony.lol/api/federation/instance-info
/__instance/db.mony.lol/auth/v1/settings                →  https://db.mony.lol/auth/v1/settings
```

In production the request goes direct — fine from Tauri, and fine from a browser when the client
is served from the instance's own origin, which is what `timbre.doesnmlab.xyz` does.

## Identifiers

| What | Value |
|---|---|
| Product name | **Timbre** |
| npm package | `timbre` (private) |
| Tauri bundle identifier | `xyz.doesnmlab.timbre` |
| Platform | Harmony (not part of the product name — upstream TRADEMARK) |

## Design tokens

Colours come from Cinny (AGPL-3.0): `src/colors.css.ts` → `darkTheme`, the `folds` scale. They are
rewritten as plain CSS variables so the SFCs can use them without `vanilla-extract`. Both Cinny and
Harmony are AGPL-3.0, and Timbre is a derivative of what it borrows from them — see
[`LICENSE`](LICENSE).

Font: Inter (variable, latin + cyrillic) in `public/fonts/` — local, no CDN.

## Screenshots

`shots/chat-general.png` — `# general`, `shots/chat-encrypted.png` — the encrypted `# design`,
`shots/auth-idle.png` — empty sign-in, `shots/auth-instance.png` — instance resolved (`?demo=1`),
`shots/auth-error.png` — failure, `shots/auth-callback.png` — OAuth return (`?demo=1`),
`shots/auth-live.png` — a real `har.mony.lol` reply through the dev proxy.

Taken with headless Chromium via `scripts/screenshot.mjs` (1440×900, DPR 2) and
`scripts/shot-phone.mjs` (390×844). Restoring the toolchain in a bare sandbox:

```bash
export PLAYWRIGHT_BROWSERS_PATH=$PWD/.pw LD_LIBRARY_PATH=$PWD/.libs/root/usr/lib/x86_64-linux-gnu
npx playwright install chromium
mkdir -p .libs && cd .libs && apt-get download libglib2.0-0 libnss3 libxi6 libwayland-server0 # + the rest
for f in *.deb; do dpkg-deb -x "$f" root/; done
```

## Join the server

The community lives on a Harmony instance, and it is the best place to see the client behave:

- **Invite link** — <https://har.mony.lol/invite/QBXVAGXE>. In Timbre, the Servers sheet has
  "Join with an invite": paste the link (or `?invite=QBXVAGXE` on this client's own URL) and it
  shows which server the link opens before anything is redeemed.
- **Handle** — `timbre@har.mony.lol`, if you would rather write first.

## Channels

Two of them, on purpose:

| | what it is | where |
|---|---|---|
| **Release** | a batch of work, tagged `vX.Y.Z`, notes from `CHANGELOG.md` | [Releases](https://github.com/anotherdoesnm/timbre/releases) |
| **Nightly** | the tip of `main`, rebuilt every night, replaced in place | `releases/download/nightly/app-arm64-release.apk` |

Testing a fix does not need a version number — nightly is the channel for that; tags are for
something worth announcing.

## Install

Every release publishes an APK (arm64), an AppImage and a Windows installer as release assets:

- **Android** — download the `.apk` from [Releases](https://github.com/anotherdoesnm/timbre/releases)
  and open it. Android will warn that it comes from outside the store; allow it for this app.
  The APK is signed with a release key kept in CI secrets, so updates install over each other —
  but the first build after 0.9.0 changed the key, so uninstall an older build once.
- **Linux / Windows** — the AppImage and the `.exe` installer from the same place.
- **Web** — any instance that serves this build as its frontend; `timbre.doesnmlab.xyz` is one.

## What is not there yet

See [`CHANGELOG.md`](CHANGELOG.md) for what a release contains and [`ROADMAP.md`](ROADMAP.md) for
the comparison with the official client. Missing, in the order it hurts:

- **push notifications.** The web build could use Web Push (a service worker and a subscription per
  device, neither wired yet); the Android shell cannot, because a WebView has no `PushManager`.
  Notifications currently arrive while the app is open — title badge, system notification where the
  platform has one, toast and vibration in the shell.
- **E2EE** channels are a placeholder by design (no downgrade); upstream's
  `src/services/encryption/` is the plan.
- **voice**, **microblog**, **drive**, and server/channel management: the instance has them, this
  client shows what it can read and nothing else.
- **GIF** search needs klipy keys on the instance; without them the client simply offers no GIF
  picker.

## Privacy

The client talks to one address — the instance you sign in to — and stores the session (an access
token and a refresh token) in the app's own storage on the device. There is no telemetry, no
analytics and no third-party request: the only outside call is to the instance itself.

## Brand

The mark is the wave that gave the client its name: a ribbon running from teal through magenta to
blue. Everything below is generated from one source (`brand/timbre-512.png` upscaled from the
1024 px original), so the icon on a phone and the picture in a chat never drift apart.

| File | Where it goes |
|---|---|
| `brand/timbre-512.png` | Discord guild icon, any square avatar slot |
| `brand/timbre-256.png` | bot/webhook avatar, README header |
| `brand/timbre-128.png` | small avatar slots |
| `brand/social-preview.png` | GitHub → Settings → Social preview (1280×640) |
| `src-tauri/icons/` | generated by `npx tauri icon` — APK, Android adaptive, `.ico`, `.icns`, Windows tiles |
| `public/favicon-32.png`, `public/icon-192.png`, `public/icon-512.png` | the web build |

## License

Timbre is licensed under the **GNU Affero General Public License v3.0 only**
(`AGPL-3.0-only`); the full text is in [`LICENSE`](LICENSE). It is a client for
[Harmony](https://github.com/y4my4my4m/harmony) and borrows its colour tokens from
[Cinny](https://github.com/cinnyapp/cinny), both AGPL-3.0. Anything ported from either keeps its
licence and the sources here stay open.
