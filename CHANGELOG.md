# Changelog

Notable changes to Timbre, newest first. The format follows [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows semantic versioning.

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
