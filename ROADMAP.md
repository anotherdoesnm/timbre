# Timbre — where it stands, and what is left

Updated 2026-11-07, against Harmony 1.9.x. The comparison comes from upstream's own tree
(`src/views`, `src/stores`, `src/components`, `src/router`) and from the instance's schema, which is
what decides whether something is a client job or a project.

The question this file answers: **if someone used the official client for a day and then this one,
what would they miss?**

## What we have

**Getting in.** Password sign-in, the instance's OAuth providers including its own OIDC ones,
registration and profile creation, session import, one session per instance.

**Places.** Servers with their icons, channels grouped by category in the instance's own order,
guild switching on phone and desktop, public-server discovery, joining by invite link or code,
creating a server (the instance builds its default channels), creating channels, creating invites.

**Chat.** History with pagination, one realtime socket for everything, unread counters and a
first-unread anchor, an unread badge in the title, drafts per channel, a reading position that comes
back, sending with client-generated ids so a retry cannot duplicate, an offline banner.

**Message rendering.** Markdown (bold, italic, code, links), clickable `@mentions` with a profile
card, clickable `#channels`, custom emoji as pictures (parts carry their own image), stickers,
attachments with signed URLs and a lightbox, replies with quotes, edits, deletes, reactions,
webhook authors, polls with voting.

**Conversations that are not the main channel.** Direct messages (list, create, send, attachments,
read cursors), threads beside the channel with a "N replies" line, pinned messages.

**Interruptions.** A notification list with the unread dot, a system notification where the platform
has one, a toast and a vibration in the shell, per-channel mute, do-not-disturb with its window, and
the instance's full per-event matrix (notify and sound, five kinds) deciding what actually
interrupts.

**Composer.** Emoji over all of Unicode by name or shortcode, the instance's and your servers' custom
emoji grouped by guild, stickers with uploads, polls.

**Everything else.** Search across the instance, profile editing (name, avatar), sign-out, mobile
layout with Android Back and safe-area insets, a build stamp in the account sheet, a release channel
and a nightly.

## What is left, in the order it hurts

Effort is a guess for one person; "server" says whether the instance already supports it.

| # | Feature | Effort | Server | Why it is here |
|---|---|---|---|---|
| 1 | **Presence and typing** | days | realtime `server-presence:<id>` | The member list has no "online", nobody sees "typing…". This is the most obvious difference from the official client in ordinary use. |
| 2 | **Unread navigation** | hours | `get_unread_counts`, `mark_*_as_read` | "Mark all read" per channel/conversation/server, badges on servers and categories, and a jump to the first unread. The data is already there; only the buttons are missing. |
| 3 | ~~Roles~~ | done | `server_roles`, `user_roles`, `get_user_permissions` | Role list, member assignment, creating a role with permission switches. **What is left** is per-channel permission overrides. |
| 4 | **Moderation** | days | `kick_server_member`, `ban_server_member`, `create_report` | Kick, ban and reports are in. **Left**: the ban list with unban (needs `BAN_MEMBERS`), timeouts (the permission exists, no function does), the moderator's report queue, automod. |
| 5 | **Threads: list and unread** | days | `active_threads_view`, `thread_members` | Threads work, but there is no list of them and no sign that a thread has new replies. |
| ~~6~~ | ~~Search that can be aimed~~ | done | `search_messages` | `in:`, `from:`, `has:image`, `has:link`, `before:`, `after:` map to the RPC's own arguments. |
| ~~7~~ | ~~GIF~~ | done | `/api/federation/gifs/*` | Picker with trending and search; the key lives on the instance, the flagship has one. |
| 8 | **Per-category mute** | hours | `notification_channels.category_id` | Server-wide defaults are in; per-category is the same row with a category id. |
| 9 | **Attachment niceties** | days | — | Paste-to-upload, drag and drop on desktop, resumable uploads, image dimensions before send, voice messages. |
| 10 | **Keyboard, a11y, i18n** | days | — | Shortcuts (jump to unread, quick switcher), a full screen-reader pass, and translation. English only today. |
| 11 | **Background push** | week+ | `push_subscriptions`, `unified_push_register` | A WebView has no `PushManager`. Needs a native bridge (or a port of upstream's Kotlin plugin) and a distributor app on the phone. |
| 12 | **Voice and video** | weeks | LiveKit, `unifiedVoiceChannel` | A different kind of work: media and native code, not a Vue screen. |
| 13 | **E2EE** | weeks | Megolm tables, `useChannelEncryption` | Deliberately a placeholder: no downgrade, and interop with upstream's session sharing is not a weekend. |
| 14 | **Drive** | weeks | `drive_folders`, quotas | File storage with folders and sharing — a second product on the same server. |
| 15 | **Microblog (ActivityPub)** | weeks | posts, lists, follows, hashtags | A bonus, not the core. Federated *chat* needs nothing here: it runs in the federation backend, and this client only writes rows and renders what it reads. |

### Small things worth bundling with the above

Swipe-to-reply, message forwarding, copy message link, per-server notification defaults, sound
selection, presence in DM headers, notification grouping, deep links into a channel from a
notification, "add to home screen" prompts, an in-app changelog.

## Done recently

Presence and typing, unread badges on servers and categories with "mark server read", the threads list
with unread dots, swipe-to-reply, forward, copy-link with working deep links, quick switcher,
"What's new", per-server notification defaults, sound selection, GIFs and search filters.

## How work ships

`main` is the trunk and CI builds it; **nightly** is a pre-release whose APK is replaced every
night (`releases/download/nightly/app-arm64-release.apk`), and **tagged releases** (`vX.Y.Z`) are the
announced batches, with their notes taken from `CHANGELOG.md`. A fix does not need a version.
