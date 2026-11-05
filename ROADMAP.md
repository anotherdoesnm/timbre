# Timbre — where it stands, and what upstream has that we do not

Updated 2026-11-05, against Harmony 1.9.2. The comparison comes from upstream's own tree
(`src/views`, `src/stores`, `src/components`, the router) rather than from its README, which is
written for instance operators.

The point of this file is to answer one question honestly: **if someone used the official client
for a day and then this one, what would they miss?**

## What we have

Sign-in (password, OAuth via PKCE, the instance's own OIDC providers), registration and profile
creation, session import, per-instance sessions.

Servers, channels (with categories), message history with pagination, realtime over one socket
for every channel, unread counters and a first-unread anchor, an unread badge in the title.

Message rendering: text with markdown (bold, italic, code, links), `@mentions` (as links to a
profile card), `#channel` references, custom-emoji names, stickers, attachments with signed URLs
and a lightbox, replies with quotes, edits and deletes, reactions with a picker, webhook authors.

Sending: attachments with upload, drafts per channel, a retry that cannot duplicate the message
(the id is the client's), an offline banner.

Notifications while the app is open: a system notification where the platform has one, a toast and
a vibration in the shell, per-channel mute, do-not-disturb including the daily window, and the
instance's full per-event matrix (notify and sound, five event kinds) actually deciding what
interrupts. A notification list with the unread dot sits beside the account.

Direct conversations (list, create, send, attachments, read cursors), pinned messages, polls with
voting, threads beside the channel, an emoji picker over all of Unicode plus the instance's own
emoji.

Account: rename, avatar upload, sign out. Member list (join order, no presence). Search across the
instance's messages. Mobile layout, Android hardware Back, safe-area insets.

## What upstream has that we do not

Grouped by what it would take, with the server support that already exists in the instance's
schema — that is what decides whether a feature is a client job or a project.

### Done since this list was written

| Feature | Where it came from |
|---|---|
| **Direct messages** | `conversations`, `get_user_conversations`, `create_or_get_direct_conversation`, `mark_conversation_as_read`; topic `dm-conversation-<id>` |
| **Notifications screen** | `get_user_notifications`, `notifications` PATCH, `mark_all_notifications_read`; a bell beside the account |
| **The preference matrix** | `notification_preferences`: desktop and sound per event type, plus the quiet hours, now actually deciding what interrupts |
| **Pinned messages** | `pin_message` / `unpin_message` / `count_pinned_messages`, a panel in the header |
| **Polls** | `create_message_poll`, `get_message_polls`, `vote_message_poll`; a card in the message and a dialog in the composer |
| **Emoji picker** | `unicode-emoji-json` + `gemoji` (the pair upstream uses), plus the instance's custom emoji, for reactions and the composer |
| **Threads** | `create_thread`, `messages.thread_id`, `active_threads_view`; a panel beside the channel and a "N replies" line |

### Small: the tables and RPCs are there and the UI is one screen

| Feature | Server side | Notes |
|---|---|---|
| **Notifications screen + bell** | `notifications` (own RLS), `get_user_notifications`, `get_unread_notification_count` | Upstream's bell widget lists mentions, replies, DMs, follows. Ours has no place to look at what happened while the app was closed. |
| **Mark all as read** | `mark_channel_as_read` / `mark_conversation_as_read` / `mark_server_as_read`, `get_unread_counts` | One button; the counters already exist. |
| **Per-category mute** | `notification_channels.category_id`, unique index in place | Same write as channel mute, one column different. |

### Medium: a fair amount of UI, no new concepts

| Feature | Server side | Notes |
|---|---|---|
| **Sticker picker** | `stickers`, `can_see_sticker` | Emoji are done; stickers still render from a message and cannot be sent from this client. |
| **GIF picker** | instance endpoint (klipy) | **Blocked on the instance**: the backend has `KLIPY_API_KEY_ADS` / `NOADS` paths, but our box has no keys, so `/api/gifs/search` falls through to the SPA. The client half is small once a key exists. |
| **Presence and typing** | realtime `server-presence:<id>` topic | The member list currently has no "online", and nobody sees "typing…". |
| **Settings beyond the profile** | appearance, language | The notification matrix is done; themes, language and privacy are not. |

### Large: weeks, not hours

| Feature | Server side | Notes |
|---|---|---|
| **Server and channel management** | roles, permissions, invites, `join_public_server` | Create a server, create channels, roles, permissions, invites. Without it a new person cannot make a place of their own. |
| **Moderation** | reports, bans, timeouts, automod tables | Only matters on an instance with other people on it. |
| **Microblog (ActivityPub)** | posts, lists, hashtags, follows, notifications | A bonus, not the core: chat federation is ActivityPub too and runs entirely on the server, so nothing here is needed for federated *chat*. A second product otherwise: timelines, post cards, replies, likes, boosts, lists, trends. |
| **Voice and video** | LiveKit, `unifiedVoiceChannel`, egress | A different kind of work: native code and media, not a Vue screen. |
| **Drive** | `drive_folders`, quota tables | File storage with folders and sharing. |
| **E2EE** | Megolm tables, `useChannelEncryption` | Deliberately a placeholder: no downgrade, and interop with upstream's session sharing is not a weekend job. |
| **Background push** | `push_subscriptions`, `unified_push_register` | A WebView has no `PushManager`; this needs a native bridge (or a port of upstream's Kotlin plugin) plus a distributor app on the phone. |

### Smaller things, worth bundling with something else

Unread badges for servers and categories (only channels have them), swipe-to-reply, message
forwarding, sound preferences, voice messages, keyboard shortcuts, i18n, deep links into a
channel from a notification, resumable uploads.

## What I would do next

Everything the first version of this list called small or medium is now in the client: notifications,
DMs, the preference matrix, pins, polls, emoji and threads. What is left:

1. **Sticker picker.** The last piece of the composer: stickers render but cannot be sent from here.
2. **Mark all as read**, per channel, conversation or server — three RPCs already exist.
3. **Server and channel management.** Needed the day somebody else wants to use the instance.
4. **GIF**, once an instance has klipy keys (a server setting, not a client one).
5. **Microblog**, **voice**, **drive**, **moderation** — different products on the same server.

Modern Android clients live or die by notifications and DMs, in that order; the microblog and voice
are different products sharing a server.

Worth saying plainly: **federated chat is not a client feature.** Sending a message to a member of
another instance is the federation backend's job (ActivityPub delivery, signatures, WebFinger), and
this client only ever writes a row and renders what it reads back. The gaps above are about the
interface, not about federation.
