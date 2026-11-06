# Changelog

Notable changes to Timbre, newest first. The format follows [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows semantic versioning.

## [0.9.5] — 2026-11-06

Custom emoji now travel as emoji, not as their names.

### Fixed

- **Sending a custom emoji** used to write `:name:` into a text part, so every other client showed
  the shortcode instead of the picture — the "not sending emojis properly" a reader on the official
  client sees. A shortcode that matches an emoji this person has becomes a
  `{type:'emoji', emoji:{name,url,id}}` part, which is the shape the instance stores and the other
  clients render.
- **Emoji in a received message** render as pictures too, including the ones the Discord bridge
  imports (`6303_monkaSTEER` and friends), because their row in `emojis` carries a CDN url even when
  the reaction row itself has none.
- **Reactions with those emoji** draw the picture: the aggregate's `emoji_url` when it is there, the
  instance's emoji list by name when it is not, and `emoji_id` for removing a chip another client
  created.

## [0.9.4] — 2026-11-06

### Fixed

- **Server pictures.** They live in the `server_icons` bucket, not `avatars`; asking the avatar
  bucket for them is a 400, which is the broken image in the invite preview and the coloured
  initials in the guild switcher. Both switchers and the invite card show the real icon now.
- **Reactions.** Two faults: a reaction sent in a direct conversation named the *conversation* as a
  channel, and a custom emoji reaction written by another client references `emoji_id` rather than a
  name, so "remove" matched no row and the chip stayed. Removing now falls back to `emoji_id`, a
  reaction in a thread refreshes the thread's list, and a refusal is shown instead of swallowed.
- **Custom emoji are scoped and grouped.** `emojis_select_all` is `USING (true)`, so every server's
  emoji were readable and this client showed them all under one "This instance" heading — including
  other guilds' pictures, which the official client does not do. The list is now the instance's own
  plus the servers the person is in, grouped by server.

## [0.9.3] — 2026-11-06

Four things a real server made obvious.

### Fixed

- **The launcher icon on Android.** `tauri android init` fills the project with Tauri's own default
  icon whatever `tauri icon` wrote, so the installed app wore Tauri's logo. The icon set is copied
  into the generated project after init.
- **Messages failing on a server that requires its rules accepted.** The instance guards the message
  insert with `RULES_NOT_ACCEPTED:<server>`; the client now reads `get_server_welcome` when a server
  is opened or joined, shows the rules, and accepts them through `accept_server_rules` — retrying
  the message that was waiting.
- **Custom emoji reactions rendered as text.** The aggregate carries `emoji_url`; the chip draws the
  picture now, falls back to the instance's emoji list for legacy `:name:` rows, and reacts with the
  bare name (`toothy`) instead of `:toothy:`, which is what other clients write.
- **Categories and channel order.** `type = 2` rows are category headings, not channels, and the
  list sorted channels by the category's uuid instead of the server's own `"order"`. Uncategorised
  channels now lead, categories follow in their order, and each group is sorted by position.

## [0.9.2] — 2026-11-06

### Added

- **Joining a server by invite.** The Servers sheet has "Join with an invite": paste a link from
  any Harmony instance (or just its code) and the sheet shows the server — name, picture,
  description, and whether you are already a member — before anything is redeemed. Joining goes
  through the instance's `redeem_invite`, which checks the invite, counts the use and adds the
  membership in one transaction. `?invite=CODE` on the client's own URL opens the sheet prefilled.

### Changed

- The README opens with the mark and lists where each brand file goes, and points at the
  community server: <https://har.mony.lol/invite/QBXVAGXE> or `timbre@har.mony.lol`.

## [0.9.1] — 2026-11-06

The release that has a face.

### Changed

- **A real app icon.** The wave that gave Timbre its name — teal to magenta to blue, running
  edge to edge — replaces the empty rounded square that shipped with 0.9.0, in the APK, the
  desktop bundles, the Android adaptive icons, the window icon and the web favicon.
- The sign-in card shows the same mark instead of a generic `#`.
- The web build has a `manifest.webmanifest`, so "add to home screen" gets the name, the theme
  colour and the 192/512 icons rather than a screenshot.

## [0.9.0] — 2026-11-05

The first public beta: a Cinny-styled client for Harmony instances that covers a chat client's
daily work, with the parts that need a different product (voice, microblog, moderation) left out
on purpose.

### Added

- **Sign-in** with a password, with an instance's OAuth providers (including its own OIDC ones),
  registration and profile creation, session import from the official web app.
- **Servers, channels, categories**, history with pagination, one realtime socket for all of them,
  unread counters and a first-unread anchor.
- **Messages**: markdown (bold, italic, code, links), clickable `@mentions` with a profile card,
  clickable `#channels`, custom emoji, stickers, attachments with signed links and a lightbox,
  replies with quotes, edits, deletes, reactions, webhook authors, polls with voting.
- **Direct messages**: the conversation list, starting one from a member or from a search, sending
  text and attachments, read cursors, realtime.
- **Threads**: a panel beside the channel, a "N replies" line on the parent message.
- **Pins**: a count in the channel header, a panel of pinned messages, pin/unpin from the toolbar.
- **Sending that does not duplicate**: the message id is the client's, so a retry after a timeout
  cannot post the same message twice; failed sends retry by themselves when the network returns.
- **Drafts per channel** and a per-channel reading position.
- **Notifications**: a list of what happened while the app was closed, a system notification where
  the platform has one, per-channel mute, do-not-disturb, and the instance's full per-event matrix
  (notify and sound) actually deciding what interrupts.
- **Emoji picker** over all of Unicode by name or shortcode, plus the instance's custom emoji.
- **Sticker picker** with uploads for personal stickers.
- **Search** across the instance's messages, with a jump to the hit.
- **Mobile layout**: one pane at a time, Android hardware Back, safe-area insets; a desktop shell
  for Linux and Windows alongside the APK.
- **A build stamp** in the account sheet — version and commit — so a bug report names a build.

### Known limitations

- **No background push.** A WebView has no `PushManager`; notifications arrive while the app is
  open. Native UnifiedPush needs a plugin port and a distributor app on the phone.
- **No E2EE.** Encrypted channels are a placeholder by design — nothing is downgraded, the client
  simply does not decrypt.
- **No voice, microblog, drive, moderation, server or channel management.** The instance has them;
  this client shows what it can read.
- **GIF needs an instance key.** Search goes through the instance (`/api/gifs/search`), which needs
  klipy keys an operator may not have set.
- **English only.**
