# Changelog

Notable changes to Timbre, newest first. The format follows [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows semantic versioning.

## [Unreleased]

### Added

- **Presence.** The member list is a roster of who is *here* now, not just who joined: a heartbeat
  keeps this tab online (`presence_heartbeat(p_device_id, p_status, …)`), `get_presence` fills the
  list, and `server-presence:<id>` keeps it live. Online/away/offline dots, with the instance's own
  status codes (1 online, 2 away, 3 busy, 4 invisible).
- **Typing indicators.** Typing is Realtime *presence* on `typing:<kind>:<id>` — this client tracks
  while the composer changes and clears after a pause, and shows "…is typing" above the composer.
  Nothing is sent to the instance for it, so it costs no rows.


### Fixed

- **`:RIP:` from another pack stayed text.** A message part names its emoji together with the
  picture it shipped (`{type:'emoji', emoji:{id,name,url}}`); the renderer kept only the name and
  then looked it up in *this person's* packs, so an emoji from a pack they do not have came out as
  the shortcode. The part's own picture is used now.
- **Initials without a tile.** A server whose picture failed to load showed its initials on a
  transparent background instead of the filled tile a server with no icon gets.



### Fixed

- **Broken server pictures in discovery.** Two causes, measured against the live instance's 27
  public servers: 3 icons point at *other* instances' storage (`db.spacify.cloud` answers 404,
  `db.chat.mstdn.ca` 403) and one row still carries the legacy `/default_server_icon.png` sentinel,
  which the schema itself says never to store. A failed picture now leaves the initials rather than
  the browser's broken-image glyph, and the sentinel is treated as "no icon". The web build also
  ships `default_server_icon.png`, so an instance serving this build answers the legacy path.

## [0.10.0] — 2026-11-07

### Added

- **Public server discovery.** "Discover public servers" in the servers sheet lists the instance's
  public servers — icon, name, member count, description — and joins them through
  `join_public_server`, the same call registration uses. Servers you are already in open instead of
  offering to join.

### Changed

- **A nightly build channel.** Fixes no longer need a version each: `nightly` is a pre-release whose
  APK is replaced every night from the tip of `main`
  (`releases/download/nightly/app-arm64-release.apk`). Versioned tags are for batches, and their
  release notes come from this file.

## [0.9.9] — 2026-11-06

### Fixed

- **Stacking a reaction onto one that already exists.** Only emoji whose name was unique behaved;
  two packs can both ship an emoji called `RIP`, so tapping that chip reacted on whichever row the
  name happened to match first — a different chip, apparently nothing happened. A chip now carries
  its own `emoji_id` from the aggregate, and both reacting and "is this mine" compare by that id,
  falling back to the name only for reactions the instance stores without one.

## [0.9.8] — 2026-11-06

### Fixed

- **` :fire:` in a message stayed text.** The segment cache was filled on the first paint, when the
  emoji list was still empty, and nothing ever invalidated it — so shortcodes parsed before the packs
  arrived stayed shortcodes. The cache is skipped while the list is empty and cleared when it grows.
- **Custom reactions would not join their chip.** Reacting sent the emoji's *name*; a reaction the
  official client made references `emoji_id`, so the aggregate reported two chips of the same emoji
  instead of one and the tap looked like it did nothing. A known custom emoji now reacts by
  `emoji_id`, verified against the live instance: one chip, count 1, with its picture.
- Display names that carry shortcodes (`y4my4m:fire:`) draw the picture too.

## [0.9.7] — 2026-11-06

### Changed

- **Emoji packs are scoped to the guilds you are in.** 0.9.6 grouped every pack the instance hands
  out, including servers this account has no membership in; that is somebody else's pack and it is
  not what the official client does. The picker keeps the headings — Standard unicode, then each
  guild by name — but only for the instance's own emoji and the servers you belong to.

## [0.9.6] — 2026-11-06

### Fixed

- **Custom emoji reactions that still showed text.** Three shapes reach a chip: a plain name, the
  bridge's `discord:name:id`, and a unicode character. Only the first was matched against the emoji
  list, so a bridged emoji — which has a name in the list *and* an id in the identifier — fell
  through to text. One resolver now handles all three and is shared by chips and inline shortcodes.

### Changed

- **The emoji picker groups by guild.** Standard unicode emoji have their own heading, and every
  guild's pack follows under the guild's name — including packs of servers this account has no row
  in, which is where most of the emoji in a bridged instance live. Two emoji called `thinking` from
  two guilds are finally distinguishable.

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
