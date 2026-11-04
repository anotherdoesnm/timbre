# Timbre — where it stands, and what upstream has that we do not

Updated 2026-11-04, against Harmony 1.9.2. The comparison comes from upstream's own tree
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
a vibration in the shell, per-channel mute, do-not-disturb including the daily window.

Account: rename, avatar upload, sign out. Member list (join order, no presence). Search across the
instance's messages. Mobile layout, Android hardware Back, safe-area insets.

## What upstream has that we do not

Grouped by what it would take, with the server support that already exists in the instance's
schema — that is what decides whether a feature is a client job or a project.

### Small: the tables and RPCs are there and the UI is one screen

| Feature | Server side | Notes |
|---|---|---|
| **Notifications screen + bell** | `notifications` (own RLS), `get_user_notifications`, `get_unread_notification_count` | Upstream's bell widget lists mentions, replies, DMs, follows. Ours has no place to look at what happened while the app was closed. |
| **Pinned messages** | `pinned_messages_view` | A pin bar or a section in the channel header. |
| **Bookmarks** | `user_bookmarks` | Save a message, list them later. |
| **Mark all as read** | `mark_channel_as_read` per channel, `get_unread_counts` | One button; the counters already exist. |
| **Per-category mute** | `notification_channels.category_id`, unique index in place | Same write as channel mute, one column different. |

### Medium: a fair amount of UI, no new concepts

| Feature | Server side | Notes |
|---|---|---|
| **Direct messages** | `conversations`, `conversation_participants`, `messages.conversation_id` | The second half of a messenger. Everything we have is channel-shaped: fetch, realtime topic, unread RPC, sending. |
| **Threads** | `threads`, `thread_members`, `active_threads_view` | A thread view and a reply-as-thread action. |
| **Polls** | 4 tables | Vote, show results, close. |
| **Custom emoji and sticker pickers** | `emojis`, stickers tables | We render `:name:` as text and stickers as pictures; picking one is the missing half. Emoji picker is also where the reactions picker's 12 hard-coded emoji should come from. |
| **GIF picker** | instance endpoint (klipy) | In the composer next to the attachment button. |
| **Presence and typing** | realtime `server-presence:<id>` topic | The member list currently has no "online", and nobody sees "typing…". |
| **Settings beyond the profile** | `notification_preferences` (full matrix), appearance, language | Upstream has a settings screen per section; ours is a sheet with a name, an avatar and two switches. |

### Large: weeks, not hours

| Feature | Server side | Notes |
|---|---|---|
| **Server and channel management** | roles, permissions, invites, `join_public_server` | Create a server, create channels, roles, permissions, invites. Without it a new person cannot make a place of their own. |
| **Moderation** | reports, bans, timeouts, automod tables | Only matters on an instance with other people on it. |
| **Microblog (ActivityPub)** | posts, lists, hashtags, follows, notifications | A whole second product: timelines, post cards, replies, likes, boosts, lists, trends, hashtags, profiles. |
| **Voice and video** | LiveKit, `unifiedVoiceChannel`, egress | A different kind of work: native code and media, not a Vue screen. |
| **Drive** | `drive_folders`, quota tables | File storage with folders and sharing. |
| **E2EE** | Megolm tables, `useChannelEncryption` | Deliberately a placeholder: no downgrade, and interop with upstream's session sharing is not a weekend job. |
| **Background push** | `push_subscriptions`, `unified_push_register` | A WebView has no `PushManager`; this needs a native bridge (or a port of upstream's Kotlin plugin) plus a distributor app on the phone. |

### Smaller things, worth bundling with something else

Unread badges for servers and categories (only channels have them), swipe-to-reply, message
forwarding, sound preferences, voice messages, keyboard shortcuts, i18n, deep links into a
channel from a notification, resumable uploads.

## What I would do next

1. **Notifications screen.** It closes the loop we opened with mute and DND, and it is the one
   place where "what happened while you were away" lives. Server support is complete.
2. **Direct messages.** A chat client without DMs is a forum client.
3. **Pins and bookmarks.** Two small features that make an active channel usable.
4. **Emoji, sticker and GIF pickers.** The composer is the most-used surface we have, and the
   reaction picker is twelve hard-coded characters.
5. **Threads.** After DMs, this is the other half of a conversation that is not a channel.
6. **Server and channel management.** Needed the day somebody else wants to use the instance.

Modern Android clients live or die by notifications and DMs, in that order; the microblog and voice
are different products sharing a server.
