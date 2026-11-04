<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import ServerRail from './components/ServerRail.vue';
import RoomList from './components/RoomList.vue';
import ChatHeader from './components/ChatHeader.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';
import MemberList from './components/MemberList.vue';
import ServerSheet from './components/ServerSheet.vue';
import AccountSheet from './components/AccountSheet.vue';
import SearchPanel from './components/SearchPanel.vue';
import ProfileCard from './components/ProfileCard.vue';
import AuthScreen from './components/AuthScreen.vue';
import AuthCallback from './components/AuthCallback.vue';
import { channels as mockChannels, messages as mockMessages, servers as mockServers, type Author } from './data/mock';
import { refreshSession, sessionAlive, sessionExpired, signOut, storedSession, type Session } from './services/auth';
import {
  fetchChannels,
  fetchMe,
  fetchMessages,
  fetchServers,
  fetchReactions,
  deleteMessage,
  editMessage,
  fetchUnreadCounts,
  markChannelRead,
  searchMessages,
  toggleReaction,
  sendMessage,
  uploadAttachment,
  updateProfile,
  uploadAvatar,
  avatarUrl as avatarUrlOf,
  setChannelMute,
  fetchMutedChannels,
  fetchNotificationPrefs,
  fetchProfileByUsername,
  fetchServerMembers,
  setDnd,
  type SearchHit,
  type UnreadState,
  type UploadedFile,
} from './services/data';
import { discoverHere, instanceHostFromLocation, type InstanceInfo } from './services/discover';
import { connectRealtime, type LiveConnection, type MessageEvent } from './services/realtime';
import {
  buzz,
  mentionNames,
  mentions,
  notifyPermission,
  preview,
  requestNotify,
  setTitleBadge,
  showNotification,
  inQuietHours,
  clockOf,
  type Permission,
} from './services/notify';

const hash = () => location.hash.replace('#', '');
const initialSearch = new URLSearchParams(location.search.slice(1));
// GoTrue returns to `/auth/callback?code=…`; a hash route says the same thing in the SPA.
const fromSearch =
  initialSearch.has('code') ||
  initialSearch.has('error') ||
  initialSearch.has('error_description') ||
  /\/auth\/callback\/?$/.test(location.pathname);
// A stored session means the app belongs in the chat: showing the sign-in screen on every
// cold start is what made it look like the session had been lost.
const initialRoute = fromSearch ? 'auth/callback' : hash().split('?')[0];
// A build served by an instance belongs to that instance. Opening a session stored for a
// *different* instance is how a leftover flagship login ended up inside this instance's chat:
// on a self-hosted origin only that origin's own session counts.
const selfHost = instanceHostFromLocation();
const homeSession = selfHost ? storedSession(selfHost) : storedSession();
const route = ref(homeSession && initialRoute !== 'auth/callback' ? 'chat' : initialRoute);
const hashQuery = ref(fromSearch ? location.search.slice(1) : hash().split('?')[1] ?? '');
window.addEventListener('hashchange', () => {
  route.value = hash().split('?')[0];
  hashQuery.value = hash().split('?')[1] ?? '';
});
const demoMode = new URLSearchParams(location.search).get('demo') === '1';

/* ---- session and live data ------------------------------------------------------------ */
const session = ref<Session | null>(homeSession);
// Set when this build is served by an instance: the address step is then pointless.
const autoInstance = ref<InstanceInfo | null>(null);
// A session whose account never got a profile (onboarding closed after step one) resumes there.
const resume = ref<{ session: Session; instance: InstanceInfo } | null>(null);
// While the page is being asked whether it is an instance, the address form must not render:
// showing it and then replacing it is the flash this used to have. On a dev server or in the
// shell the answer is known synchronously, so nothing is ever held back there.
const probing = ref(Boolean(selfHost) && !homeSession && !demoMode);
const live = ref(false);
const loading = ref(false);
const loadError = ref('');
const me = ref<{
  name: string;
  username?: string;
  role: 'admin' | 'mod' | null;
  avatarUrl?: string;
}>({ name: 'you', role: null });
// Renaming and re-avataring live in the account sheet: the instance ships no settings screen, and
// a federated profile is just a row its owner may PATCH.
const profileBusy = ref(false);
const profileError = ref('');

const liveServers = ref<typeof mockServers>([]);
const liveChannels = ref<Record<string, typeof mockChannels>>({});
const liveMessages = ref<Record<string, typeof mockMessages.c1>>({});

const activeServer = ref(mockServers[0].id);
const activeChannel = ref('c1');
const membersOpen = ref(true);
// Below this width the member panel is not a column but a sheet: as a column it was hidden by CSS
// and the header's toggle silently did nothing.
const narrow = ref(false);
// Phones start on the channel list: landing straight inside a channel left no way back
// except a 32px arrow in the corner.
const mobilePane = ref<'rooms' | 'chat'>('rooms');
const sending = ref(false);
// Unread state comes from the instance (`get_unread_counts`), not from counting locally: the
// server knows where the read cursor is, including on other devices.
const unread = ref<Record<string, UnreadState>>({});
// Messages that landed in a channel this client is not showing. The server counters only move
// when something re-reads them, and a badge that appears a minute late is not a notification.
const localUnread = ref<Record<string, number>>({});
// Channels muted on the instance; a quiet channel never appears in the unread counters.
const mutedChannels = ref<Record<string, true>>({});
// Do-not-disturb, including the daily window: a muted channel is quiet, the whole account is
// quiet inside it.
const prefs = ref<{ dndEnabled: boolean; dndStart: string | null; dndEnd: string | null } | null>(null);
/** The server's roster, kept per server so switching back does not refetch it. */
const liveMembers = ref<Record<string, Author[]>>({});
const members = computed<Author[] | undefined>(() =>
  live.value ? liveMembers.value[activeServer.value] : undefined
);

/** The person behind a tapped mention, once looked up. */
const profileCard = ref<(Partial<Author> & { name: string; username?: string; domain?: string }) | null>(null);
const dndLabel = computed(() => {
  const p = prefs.value;
  if (!p?.dndEnabled) return '';
  const from = clockOf(p.dndStart);
  const to = clockOf(p.dndEnd);
  return from && to ? `Quiet from ${from} to ${to}` : 'Always quiet';
});
/** In-app bubble: the Android shell has no window title to put a count in. */
const toast = ref<{ text: string; channelId: string } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const notifyState = ref<Permission>(notifyPermission());
/** First unread message of the open channel — the view opens there. */
const unreadAnchor = ref<string | null>(null);
const cursors = ref<Record<string, { oldest: string | null; hasMore: boolean }>>({});
const loadingOlder = ref(false);
/** The message being replied to; cleared on send or on cancel. */
const replyTarget = ref<{ id: string; author: string; text: string } | null>(null);
/** Attachments uploaded and waiting for the next send. */
const attached = ref<UploadedFile[]>([]);
const uploading = ref(false);
// Offline state and the last message that failed to send. Keeping the text here (rather than
// in the composer) means a failed send never eats what was typed.
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
// `id` is generated once per message, not per attempt: pressing Retry re-sends the same primary
// key, which the instance answers with 409 (already stored) instead of a duplicate.
const failedSend = ref<{
  id: string;
  body: string;
  files: UploadedFile[];
  replyTo: string | null;
} | null>(null);
let lastLoad = Date.now();
// Search runs on the instance (`search_messages`), scoped to this server.
const searchOpen = ref(false);
const searchResults = ref<SearchHit[]>([]);
const searching = ref(false);
const searchError = ref('');
const focusId = ref<string | null>(null);

async function runSearch(query: string): Promise<void> {
  const s = session.value;
  if (!s) return;
  searchError.value = '';
  if (query.trim().length < 2) {
    searchResults.value = [];
    return;
  }
  searching.value = true;
  try {
    searchResults.value = await searchMessages(s, query, { serverId: activeServer.value });
  } catch (e) {
    searchError.value = e instanceof Error ? e.message : String(e);
  } finally {
    searching.value = false;
  }
}

async function openHit(hit: SearchHit): Promise<void> {
  closeSearch();
  if (hit.channelId !== activeChannel.value) {
    activeChannel.value = hit.channelId;
    mobilePane.value = 'chat';
    openGuard('channel');
    await openChannel(hit.channelId);
  }
  focusId.value = hit.messageId;
}

/**
 * After a drop the socket may have missed messages, and the unread counters belong to the
 * server — so both are re-read instead of guessed. That is the common case on a throttled or
 * filtered connection, where the socket dies quietly and comes back later.
 */
async function catchUp(): Promise<void> {
  const s = session.value;
  if (!s || !live.value) return;
  try {
    unread.value = await fetchUnreadCounts(s);
    if (myProfileId.value) {
      mutedChannels.value = await fetchMutedChannels(s, myProfileId.value);
      prefs.value = await fetchNotificationPrefs(s, myProfileId.value);
    }
    if (activeChannel.value) await openChannel(activeChannel.value);
  } catch {
    /* still unreachable; the next resume tries again */
  }
}
/** Message being edited in the composer. */
const editing = ref<{ id: string; text: string } | null>(null);

async function onSaveEdit(text: string): Promise<void> {
  const s = session.value;
  const ch = channel.value;
  const target = editing.value;
  if (!s || !ch || !target) return;
  try {
    await editMessage(s, target.id, text);
    editing.value = null;
    const page = await fetchMessages(s, ch.id);
    liveMessages.value[ch.id] = page.messages;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

async function onDeleteMessage(m: { id: string }): Promise<void> {
  const s = session.value;
  const ch = channel.value;
  if (!s || !ch) return;
  try {
    await deleteMessage(s, m.id);
    const page = await fetchMessages(s, ch.id);
    liveMessages.value[ch.id] = page.messages;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

/**
 * Re-reads the open page so a changed display name or avatar shows on messages already on
 * screen. Only the last page is fetched, and nothing scrolls: the list is replaced in place.
 */
async function refreshByline(): Promise<void> {
  const s = session.value;
  const ch = channel.value;
  if (!s || !ch) return;
  const page = await fetchMessages(s, ch.id);
  liveMessages.value[ch.id] = page.messages;
}

async function onRename(name: string): Promise<void> {
  const s = session.value;
  const id = myProfileId.value;
  const trimmed = name.trim();
  if (!s || !id || !trimmed) return;
  profileBusy.value = true;
  profileError.value = '';
  try {
    await updateProfile(s, id, { display_name: trimmed });
    me.value = { ...me.value, name: trimmed };
    await refreshByline();
  } catch (e) {
    profileError.value = e instanceof Error ? e.message : String(e);
  } finally {
    profileBusy.value = false;
  }
}

async function onAvatar(file: File): Promise<void> {
  const s = session.value;
  const id = myProfileId.value;
  if (!s || !id) return;
  profileBusy.value = true;
  profileError.value = '';
  try {
    // Two steps, in this order: the object has to exist before the profile points at it, or
    // every client renders a broken avatar for as long as the upload takes.
    const path = await uploadAvatar(s, id, file);
    await updateProfile(s, id, { avatar_url: path });
    me.value = { ...me.value, avatarUrl: avatarUrlOf(path, s) };
    await refreshByline();
  } catch (e) {
    profileError.value = e instanceof Error ? e.message : String(e);
  } finally {
    profileBusy.value = false;
  }
}

function refreshConnectivity(): void {
  online.value = typeof navigator === 'undefined' ? true : navigator.onLine;
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    refreshConnectivity();
    void catchUp();
    // The send that failed because the connection dropped is retried with the same id, so the
    // worst case is the instance answering "already stored".
    if (failedSend.value && !sending.value) void retrySend();
  });
  window.addEventListener('offline', refreshConnectivity);
}

async function retrySend(): Promise<void> {
  const pending = failedSend.value;
  if (!pending || sending.value) return;
  failedSend.value = null;
  await onSend(pending.body, pending.files, pending.replyTo, pending.id);
}

async function onAttach(file: File): Promise<void> {
  const s = session.value;
  const ch = channel.value;
  if (!s || !ch || !myProfileId.value) return;
  uploading.value = true;
  try {
    const uploaded = await uploadAttachment(s, ch.id, myProfileId.value, file);
    attached.value = [...attached.value, uploaded];
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploading.value = false;
  }
}
// Phone server switcher. The rail is desktop furniture: on a phone it costs a row of the
// screen on every screen and scrolls sideways, which is what the strip did.
const serversOpen = ref(false);
const accountOpen = ref(false);
const myProfileId = ref<string | null>(null);

// A session means the mocks are a lie: show the real thing or nothing. Rendering the mock
// first and swapping it is what produced the visible flash.
const servers = computed(() => {
  if (session.value) return live.value ? liveServers.value : [];
  return mockServers;
});
const server = computed(() => servers.value.find((s) => s.id === activeServer.value) ?? servers.value[0]);
const channels = computed(() => {
  const list = session.value ? (live.value ? liveChannels.value[activeServer.value] ?? [] : []) : mockChannels;
  if (!session.value) return list;
  return list.map((c) => {
    const state = unread.value[c.id];
    const fresh = localUnread.value[c.id] ?? 0;
    const total = (state?.unread ?? 0) + fresh;
    const muted = mutedChannels.value[c.id] === true;
    if (!total && !state && !muted) return c;
    return { ...c, unread: total, mention: state?.mentions, muted: mutedChannels.value[c.id] === true };
  });
});
const channel = computed(
  () => channels.value.find((c) => c.id === activeChannel.value) ?? channels.value[0] ?? null
);
const channelMessages = computed(() => {
  if (!channel.value) return [];
  if (session.value) return live.value ? liveMessages.value[channel.value.id] ?? [] : [];
  return mockMessages[channel.value.id] ?? [];
});

/**
 * Loads a channel around the right place: the unread ones plus a screen of context above them,
 * or the newest page when there is nothing unread. Opening at the bottom would hide exactly
 * what the unread badge promised.
 */
async function openChannel(channelId: string): Promise<void> {
  const s = session.value;
  if (!s || !live.value || !channelId) return;
  const state = unread.value[channelId];
  const pending = state?.unread ?? 0;
  const limit = pending > 0 ? Math.min(pending + 20, 120) : 50;
  const page = await fetchMessages(s, channelId, { limit });
  const reactions = await fetchReactions(s, page.messages.map((m) => m.id));
  liveMessages.value[channelId] = page.messages.map((m) => ({ ...m, reactions: reactions[m.id] }));
  cursors.value[channelId] = { oldest: page.oldest, hasMore: page.hasMore };
  unreadAnchor.value =
    pending > 0 ? page.messages[Math.max(0, page.messages.length - pending)]?.id ?? null : null;
  if (pending > 0) {
    const newest = page.messages[page.messages.length - 1];
    void markChannelRead(s, channelId, newest?.id ?? null);
    delete unread.value[channelId];
  }
  // Opening the channel is reading it, whichever counter noticed the message first.
  if (localUnread.value[channelId]) {
    const rest = { ...localUnread.value };
    delete rest[channelId];
    localUnread.value = rest;
  }
}

async function onReact(m: { id: string }, emoji: string, mine: boolean): Promise<void> {
  const s = session.value;
  const ch = channel.value;
  if (!s || !ch || !myProfileId.value) return;
  try {
    await toggleReaction(s, m.id, ch.id, myProfileId.value, emoji, mine);
    const ids = (liveMessages.value[ch.id] ?? []).map((x) => x.id);
    const reactions = await fetchReactions(s, ids);
    liveMessages.value[ch.id] = (liveMessages.value[ch.id] ?? []).map((x) => ({
      ...x,
      reactions: reactions[x.id],
    }));
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadOlder(channelId: string): Promise<void> {
  const s = session.value;
  const cursor = cursors.value[channelId];
  if (!s || !cursor?.hasMore || loadingOlder.value) return;
  loadingOlder.value = true;
  try {
    const page = await fetchMessages(s, channelId, { limit: 50, before: cursor.oldest ?? undefined });
    if (page.messages.length) {
      liveMessages.value[channelId] = [...page.messages, ...(liveMessages.value[channelId] ?? [])];
    }
    cursors.value[channelId] = { oldest: page.oldest ?? cursor.oldest, hasMore: page.hasMore };
  } catch {
    /* keep what is on screen; the next scroll tries again */
  } finally {
    loadingOlder.value = false;
  }
}

async function loadChannel(serverId: string, channelId: string) {
  const s = session.value;
  if (!s || !live.value) return;
  if (!liveChannels.value[serverId]) {
    liveChannels.value[serverId] = await fetchChannels(s, serverId);
  }
  if (channelId && !liveMessages.value[channelId]) {
    await openChannel(channelId);
  }
}

async function ensureFresh(s: Session): Promise<Session | null> {
  if (!sessionExpired(s, 120_000)) return s;
  if (!s.refreshToken) return null;
  try {
    const next = await refreshSession(s);
    session.value = next;
    return next;
  } catch {
    return null;
  }
}

async function boot() {
  const fresh = session.value ? await ensureFresh(session.value) : null;
  const s = fresh;
  if (!s) {
    if (session.value) {
      // Do not throw the session away on a failed refresh: a flaky network at start-up used
      // to log people out. Keep it, say what happened, and let the next attempt fix it.
      loadError.value = 'Could not renew the session — check the connection and reopen';
    }
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const profile = await fetchMe(s);
    if (!profile && !(await sessionAlive(s))) {
      // The account is gone (deleted by an admin, or the instance was reset): the token still
      // parses and every query returns nothing, which used to render as an empty shell.
      signOut();
      session.value = null;
      route.value = 'auth';
      loading.value = false;
      return;
    }
    if (!profile) {
      // The auth user exists but the profile does not: this is a half-finished sign-up, not a
      // usable account. Finishing it happens on the auth screen, at the username step.
      resume.value = {
        session: s,
        instance: {
          origin: s.instance,
          name: s.instance,
          supabaseUrl: s.supabaseUrl,
          supabaseAnonKey: s.anonKey,
          capabilities: [],
          providers: [],
          selfHosted: selfHost === s.instance,
        },
      };
      route.value = 'auth';
      loading.value = false;
      return;
    }
    myProfileId.value = profile ? String(profile.id) : null;
    if (profile) {
      me.value = {
        name: String(profile.display_name || profile.username || 'you'),
        username: typeof profile.username === 'string' ? profile.username : undefined,
        role: profile.is_admin ? 'admin' : profile.is_moderator ? 'mod' : null,
        avatarUrl: avatarUrlOf(profile.avatar_url, s),
      };
    }
    const list = await fetchServers(s, String(profile?.id ?? ''));
    liveServers.value = list;
    if (list.length) {
      live.value = true;
      activeServer.value = list[0].id;
      unread.value = await fetchUnreadCounts(s);
      mutedChannels.value = await fetchMutedChannels(s, String(profile?.id ?? ''));
      liveMembers.value = { [list[0].id]: await fetchServerMembers(s, list[0].id) };
      prefs.value = await fetchNotificationPrefs(s, String(profile?.id ?? ''));
      const chans = await fetchChannels(s, list[0].id);
      liveChannels.value[list[0].id] = chans;
      const firstText = chans.find((c) => c.kind === 'text') ?? chans[0];
      if (firstText) {
        activeChannel.value = firstText.id;
        await openChannel(firstText.id);
      }
    } else {
      loadError.value = 'No servers are visible to this session — showing demo data.';
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// Firefox (Iceraven included) does not implement `interactive-widget=resizes-content`: the
// keyboard shrinks the *visual* viewport and leaves the layout viewport alone, so the composer
// ends up under the keys. The difference between the two is the keyboard height; publish it as
// a variable and let the shell lift the composer by it. In Chromium the gap is already handled
// by resizes-content, so the variable stays 0 and nothing moves twice.
function trackKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb-inset', `${covered}px`);
  };
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  apply();
}

const media = typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)') : null;
const syncNarrow = (): void => {
  narrow.value = media?.matches === true;
};
syncNarrow();
// A phone starts with the roster closed: the sheet is one tap away, and an open one on first load
// hides the conversation behind a scrim.
if (narrow.value) membersOpen.value = false;
media?.addEventListener('change', syncNarrow);
onUnmounted(() => media?.removeEventListener('change', syncNarrow));

onMounted(() => {
  trackKeyboardInset();
  boot();
  // Served by an instance (Timbre as its web frontend) — resolve it from the page's own
  // origin instead of asking for an address. A stored session, ?demo=1 and the Tauri shell
  // keep the manual flow.
  if (!session.value && !demoMode && route.value !== 'chat') {
    discoverHere()
      .then((inst) => (autoInstance.value = inst))
      .catch(() => undefined)
      .finally(() => (probing.value = false));
  }
});

// Coming back to the app is the moment a stale token usually shows up: renew it there
// instead of waiting for the first request to fail.
document.addEventListener('visibilitychange', () => {
  const s = session.value;
  if (document.visibilityState !== 'visible' || !s) return;
  if (sessionExpired(s, 120_000) && s.refreshToken) {
    refreshSession(s).then((next) => (session.value = next)).catch(() => undefined);
  }
  refreshConnectivity();
  // A tab that slept may have missed a lot: refresh the open channel and the counters.
  void catchUp();
  // Signed attachment links expire after an hour; reloading the channel signs them again.
  if (Date.now() - lastLoad > 45 * 60 * 1000 && live.value && activeChannel.value) {
    openChannel(activeChannel.value).catch(() => undefined);
  }
});

function enter() {
  resume.value = null;
  session.value = selfHost ? storedSession(selfHost) : storedSession();
  location.hash = 'chat';
  mobilePane.value = 'rooms';
  boot();
}

/**
 * One socket, every channel this client knows about. Subscribing only to the open channel was
 * enough to render it, but it meant a message anywhere else arrived silently — there was nothing
 * to raise a notification from.
 */
let liveConn: LiveConnection | null = null;

function ensureLive(): void {
  const s = session.value;
  if (!s || !live.value) {
    liveConn?.close();
    liveConn = null;
    return;
  }
  if (!liveConn) liveConn = connectRealtime(s);
  for (const chans of Object.values(liveChannels.value)) {
    for (const c of chans) {
      if (c.kind !== 'text') continue;
      liveConn.subscribe(c.id, (event) => onLiveEvent(c.id, event));
    }
  }
}

function channelById(id: string): { name: string; serverId: string } | null {
  for (const [serverId, chans] of Object.entries(liveChannels.value)) {
    const hit = chans.find((c) => c.id === id);
    if (hit) return { name: hit.name, serverId };
  }
  return null;
}

function jumpToChannel(channelId: string): void {
  toast.value = null;
  const where = channelById(channelId);
  if (!where) return;
  if (where.serverId !== activeServer.value) pickServer(where.serverId);
  pickChannel(channelId);
}

function showToast(text: string, channelId: string): void {
  toast.value = { text, channelId };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 6000);
}

function onLiveEvent(channelId: string, event: MessageEvent): void {
  const s = session.value;
  if (!s || !live.value) return;
  const record = event.record;
  if (record.channel_id && record.channel_id !== channelId) return;
  const mine = !!myProfileId.value && record.user_id === myProfileId.value;
  const viewing = channelId === activeChannel.value && document.visibilityState === 'visible';

  if (viewing) {
    // Refetching keeps rendering, edits and deletes in one code path — the cost is a query per
    // incoming message, which is fine at this size.
    fetchMessages(s, channelId)
      .then((page) => {
        const existing = liveMessages.value[channelId] ?? [];
        const known = new Set(existing.map((m) => m.id));
        const fresh = page.messages.filter((m) => !known.has(m.id));
        if (fresh.length) liveMessages.value[channelId] = [...existing, ...fresh];
        // Reading a channel marks it read; without this the badge grows while you watch it.
        const newest = page.messages[page.messages.length - 1];
        if (newest) void markChannelRead(s, channelId, newest.id);
      })
      .catch(() => undefined);
    return;
  }

  // Everything below is about telling the person, not about the open channel.
  if (mine || event.op === 'DELETE') return;
  localUnread.value = {
    ...localUnread.value,
    [channelId]: (localUnread.value[channelId] ?? 0) + 1,
  };
  if (event.op !== 'INSERT') return;

  const where = channelById(channelId);
  // A muted channel still counts unread messages; it just does not interrupt. Do-not-disturb does
  // the same for the whole account, and is checked per event rather than stored, so a window that
  // closes at 08:00 takes effect without a reload.
  const quiet = prefs.value?.dndEnabled === true && inQuietHours(prefs.value.dndStart, prefs.value.dndEnd);
  if (mutedChannels.value[channelId] || quiet) return;
  const named = mentions(
    record.content,
    mentionNames(me.value.username, me.value.name),
    record.metadata
  );
  const body = `${preview(record.content)}${where ? ` · #${where.name}` : ''}`;
  showNotification(named ? 'You were mentioned' : 'Timbre', body, () => jumpToChannel(channelId));
  if (named) {
    buzz();
    showToast(`Mentioned in #${where?.name ?? 'a channel'}: ${preview(record.content)}`, channelId);
  }
}

watch([session, live, liveChannels], ensureLive, { deep: true, immediate: true });
onUnmounted(() => liveConn?.close());

// The window title is the only badge a browser tab has; a shell shows the toast instead.
watch(
  () =>
    Object.values(unread.value).reduce((sum, state) => sum + (state.unread ?? 0), 0) +
    Object.values(localUnread.value).reduce((sum, n) => sum + n, 0),
  (count) => setTitleBadge(count),
  { immediate: true }
);

/** Do-not-disturb lives on the instance too, so the phone and the browser agree on it. */
async function toggleDnd(): Promise<void> {
  const s = session.value;
  const id = myProfileId.value;
  const current = prefs.value;
  if (!s || !id || !current) return;
  const next = !current.dndEnabled;
  prefs.value = { ...current, dndEnabled: next };
  try {
    await setDnd(s, id, next);
  } catch (e) {
    prefs.value = { ...current };
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

/** Mute is a per-user row on the instance, so it follows the account to every other client. */
async function toggleMute(): Promise<void> {
  const s = session.value;
  const ch = channel.value;
  const id = myProfileId.value;
  if (!s || !ch || !id || !activeServer.value) return;
  const wasMuted = mutedChannels.value[ch.id] === true;
  const apply = (muted: boolean): void => {
    const next = { ...mutedChannels.value };
    if (muted) next[ch.id] = true;
    else delete next[ch.id];
    mutedChannels.value = next;
  };
  // Optimistic: the bell must answer the tap, not the round trip.
  apply(!wasMuted);
  try {
    await setChannelMute(s, id, activeServer.value, ch.id, !wasMuted);
  } catch (e) {
    // Put the switch back: showing the opposite of what the instance thinks invites a re-tap that
    // makes it worse.
    apply(wasMuted);
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

/**
 * Tapping `@name` looks the person up rather than trusting the rendered page: a mention can point
 * at someone who has not spoken in this channel, and a federated handle carries its own instance.
 */
async function openMention(handle: string): Promise<void> {
  const s = session.value;
  if (!s || !live.value) return;
  const person = await fetchProfileByUsername(s, handle);
  // A handle that no profile row answers is still a person someone named: show the handle rather
  // than nothing, which is indistinguishable from a dead button.
  profileCard.value = person ?? { name: handle, initial: handle.slice(0, 1).toUpperCase(), color: '#6b7280' };
}

/** Tapping `#channel` goes there when this server has a channel by that name. */
function openChannelRef(name: string): void {
  const target = channels.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (target) pickChannel(target.id);
}

async function enableNotifications(): Promise<void> {
  notifyState.value = await requestNotify();
  if (notifyState.value === 'granted') {
    showNotification('Timbre', 'Notifications are on for this device while the app is open.');
  }
}

function toAuth(): void {
  location.hash = 'auth';
}

function signOutNow() {
  signOut();
  accountOpen.value = false;
  session.value = null;
  resume.value = null;
  live.value = false;
  location.hash = 'auth';
}

function pickServer(id: string) {
  activeServer.value = id;
  const s0 = session.value;
  if (s0 && live.value && !liveMembers.value[id]) {
    fetchServerMembers(s0, id)
      .then((people) => (liveMembers.value = { ...liveMembers.value, [id]: people }))
      .catch(() => undefined);
  }
  const first = (live.value ? liveChannels.value[id] ?? [] : mockChannels).find((c) => c.kind === 'text');
  if (live.value && !liveChannels.value[id]) {
    const s = session.value;
    if (s) {
      fetchChannels(s, id).then((chans) => {
        liveChannels.value[id] = chans;
        const t = chans.find((c) => c.kind === 'text');
        if (t) {
          activeChannel.value = t.id;
          fetchMessages(s, t.id).then((page) => (liveMessages.value[t.id] = page.messages));
        }
      });
    }
  } else if (first) {
    activeChannel.value = first.id;
  }
}

/**
 * Android only sends the hardware Back into the WebView while it has history to walk: Tauri's
 * AppPlugin calls `goBack()` when `canGoBack()` and finishes the activity otherwise. A single-page
 * app has one entry, so Back used to exit the client from any screen — including from a channel
 * list, a sheet, or a half-typed search. One pushed entry per screen gives it something to close.
 */
type Guard = 'search' | 'account' | 'servers' | 'channel';
const guards: Guard[] = [];

function openGuard(kind: Guard): void {
  if (guards.includes(kind)) return;
  guards.push(kind);
  history.pushState({ guard: kind }, '');
}

function closeGuard(kind: Guard): void {
  const at = guards.lastIndexOf(kind);
  if (at < 0) return;
  guards.splice(at, 1);
  // Walk the entry back as well, or the next press would be spent on a screen that is already
  // gone. `popstate` then finds nothing to do, which is why that handler is idempotent.
  if (at === guards.length && (history.state as { guard?: string } | null)?.guard === kind) {
    history.back();
  }
}

function openAccount(): void {
  accountOpen.value = true;
  openGuard('account');
}
function closeAccount(): void {
  accountOpen.value = false;
  profileError.value = '';
  closeGuard('account');
}
function openServers(): void {
  serversOpen.value = true;
  openGuard('servers');
}
function closeServers(): void {
  serversOpen.value = false;
  closeGuard('servers');
}
function openSearch(): void {
  searchOpen.value = true;
  openGuard('search');
}
function closeSearch(): void {
  searchOpen.value = false;
  closeGuard('search');
}
function closeChannel(): void {
  mobilePane.value = 'rooms';
  closeGuard('channel');
}

window.addEventListener('popstate', () => {
  const kind = guards.pop();
  if (!kind) return;
  if (kind === 'search') searchOpen.value = false;
  else if (kind === 'account') {
    accountOpen.value = false;
    profileError.value = '';
  } else if (kind === 'servers') serversOpen.value = false;
  else if (kind === 'channel') mobilePane.value = 'rooms';
});

function pickChannel(id: string) {
  activeChannel.value = id;
  mobilePane.value = 'chat';
  openGuard('channel');
  replyTarget.value = null;
  unreadAnchor.value = null;
  const s = session.value;
  if (s && live.value && !liveMessages.value[id]) {
    openChannel(id).catch(() => undefined);
  } else if (s && unread.value[id]?.unread) {
    // Already loaded, but there is new mail: reload around the unread ones.
    openChannel(id).catch(() => undefined);
  }
}

async function onSend(
  body: string,
  filesArg?: UploadedFile[],
  replyArg?: string | null,
  reuseId?: string
) {
  const s = session.value;
  const ch = channel.value;
  if (!s || !ch || !myProfileId.value) return;
  sending.value = true;
  loadError.value = '';
  const files = filesArg ?? attached.value;
  const replyTo = replyArg !== undefined ? replyArg : replyTarget.value?.id ?? null;
  const id = reuseId ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  try {
    await sendMessage(s, ch.id, myProfileId.value, body, replyTo, files, id);
    failedSend.value = null;
    replyTarget.value = null;
    attached.value = [];
    const page = await fetchMessages(s, ch.id);
    liveMessages.value[ch.id] = page.messages;
    lastLoad = Date.now();
  } catch (e) {
    // Keep what was typed: a dropped connection must not eat the message.
    failedSend.value = { id, body, files, replyTo };
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    sending.value = false;
  }
}

watch([activeServer, activeChannel], () => {
  const s = session.value;
  if (s && live.value) loadChannel(activeServer.value, activeChannel.value).catch(() => undefined);
});
</script>

<template>
  <AuthCallback
    v-if="route === 'auth/callback'"
    :query="hashQuery"
    :demo="demoMode"
    @done="enter"
    @cancel="toAuth"
  />
  <AuthScreen
    v-else-if="route !== 'chat' || (!session && !demoMode)"
    :auto-instance="autoInstance"
    :probing="probing"
    :resume="resume"
    @authenticated="enter"
  />
  <div v-else class="app" :class="{ 'with-members': membersOpen, mobile: mobilePane === 'chat' }">
    <div v-if="!online || failedSend" class="offline">
      <span v-if="!online">You are offline — messages will not send until the connection is back</span>
      <span v-else>A message did not send</span>
      <button v-if="failedSend" class="retry" @click="retrySend">Retry</button>
      <button v-if="failedSend" class="dismiss" @click="failedSend = null">Dismiss</button>
    </div>
    <ServerRail :servers="servers" :active-id="activeServer" @select="pickServer" />
    <RoomList
      :server-name="server?.name ?? ''"
      :channels="channels"
      :active-id="activeChannel"
      :me="me"
      :live="live"
      @select="pickChannel"
      @servers="openServers"
      @account="openAccount"
    />
    <main v-if="channel" class="chat">
      <ChatHeader
        :channel="channel"
        :members-open="membersOpen"
        :muted="!!mutedChannels[channel.id]"
        :live="live"
        @search="openSearch"
        @toggle-mute="toggleMute"
        @toggle-members="membersOpen = !membersOpen"
        @back="closeChannel"
      />
      <p v-if="loadError" class="banner">{{ loadError }}</p>
      <MessageList
        :channel="channel"
        :messages="channelMessages"
        :live="live"
        :unread-from-id="unreadAnchor"
        :focus-id="focusId"
        :has-more="cursors[channel.id]?.hasMore ?? false"
        :loading-older="loadingOlder"
        @load-older="loadOlder(channel.id)"
        :my-id="myProfileId"
        @reply="(m) => (replyTarget = { id: m.id, author: m.author.name, text: m.text.slice(0, 120) })"
        @edit="(m) => (editing = { id: m.id, text: m.text })"
        @delete="onDeleteMessage"
        @react="onReact"
        @mention="openMention"
        @channel="openChannelRef"
      />
      <Composer
        :channel-name="channel.name"
        :disabled="!!channel.encrypted"
        :sending="sending"
        :reply-to="replyTarget"
        :attached="attached"
        :uploading="uploading"
        :draft-instance="session?.instance"
        :draft-channel="channel.id"
        :editing="editing"
        @send="onSend"
        @save-edit="onSaveEdit"
        @cancel-edit="editing = null"
        @cancel-reply="replyTarget = null"
        @attach="onAttach"
        @remove-attachment="(p) => (attached = attached.filter((f) => f.path !== p))"
      />
    </main>
    <main v-else class="chat empty">
      <p>{{ loading ? 'Loading…' : 'No channels, or none visible to this session.' }}</p>
    </main>
    <MemberList v-if="membersOpen && !narrow" :members="members" />
    <div v-else-if="membersOpen && narrow" class="members-backdrop" @click.self="membersOpen = false">
      <MemberList class="members-overlay" :members="members" />
    </div>
    <ProfileCard v-if="profileCard" :person="profileCard" :on-close="() => (profileCard = null)" />
    <SearchPanel
      v-if="searchOpen"
      :scope="server?.name ? 'in ' + server.name : 'this server'"
      :results="searchResults"
      :searching="searching"
      :error="searchError"
      @search="runSearch"
      @select="openHit"
      @close="closeSearch"
    />
    <button v-if="toast" class="toast" type="button" @click="jumpToChannel(toast.channelId)">
      <Icon name="bell" :size="16" />
      <span class="toast-text">{{ toast.text }}</span>
    </button>
    <AccountSheet
      v-if="accountOpen && session"
      :name="me.name"
      :username="me.username"
      :instance="session.instance"
      :role="me.role"
      :avatar-url="me.avatarUrl"
      :busy="profileBusy"
      :error="profileError"
      :notifications="notifyState"
      :dnd="prefs?.dndEnabled === true"
      :dnd-label="dndLabel"
      @toggle-dnd="toggleDnd"
      @close="closeAccount"
      @signout="signOutNow"
      @rename="onRename"
      @avatar="onAvatar"
      @enable-notifications="enableNotifications"
    />
    <ServerSheet
      v-if="serversOpen"
      :servers="servers"
      :active-id="activeServer"
      @select="(id) => { pickServer(id); serversOpen = false; }"
      @close="closeServers"
    />
  </div>
</template>

<style scoped>
/* The shell has no window title to count unread messages in, so a mention lands here instead:
   one line, tappable, gone after a few seconds. */
.toast {
  position: fixed;
  top: calc(var(--sp-300) + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  max-width: min(92vw, 480px);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sf-container);
  color: var(--text);
  box-shadow: var(--shadow-3);
  font-size: var(--fs-sm);
  text-align: left;
  animation: toast-in 140ms ease-out;
}
@keyframes toast-in { from { transform: translate(-50%, -8px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
.toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app {
  /* The shell draws edge to edge: without this the status bar sits on top of the header. */
  padding-top: env(safe-area-inset-top, 0px);
  /* `--kb-inset` is the slice the keyboard covers in browsers that do not resize the layout
     viewport (Firefox); everywhere else it is 0. */
  padding-bottom: calc(var(--kb-inset, 0px) + var(--nav-inset, 0px));
  /* Pinned to the viewport rather than sized with 100%: on a phone the layout viewport is not
     the same thing as the visible area (URL bar, keyboard), and sizing by height left a strip
     of empty background under the composer. Fixed to inset 0 always ends where the visible
     area ends; with interactive-widget=resizes-content the keyboard moves that edge up. */
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: var(--rail-width) var(--rooms-width) 1fr;
  min-height: 0;
}
.members-backdrop {
  position: fixed;
  inset: 0;
  z-index: 42;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.app.with-members { grid-template-columns: var(--rail-width) var(--rooms-width) 1fr var(--members-width); }
.offline {
  position: fixed;
  left: 50%;
  top: 8px;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  max-width: calc(100% - 24px);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-md);
  background: var(--critical-container);
  color: var(--critical);
  font-size: var(--fs-sm);
  box-shadow: var(--shadow-1);
}
.offline .retry { color: var(--text); text-decoration: underline; }
.offline .dismiss { color: var(--text-tertiary); }
.chat { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--bg-container); }
.banner {
  margin: 0;
  padding: var(--sp-200) var(--sp-400);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  color: var(--warning);
  font-size: var(--fs-sm);
}

/* Phone: one pane at a time. The rail keeps the servers, the list is a full screen, and
   opening a channel swaps in the chat with a back arrow in its header. */
@media (max-width: 860px) {
  /* Same specificity as `.app.with-members`, otherwise the desktop columns win and the chat
     is squeezed into whatever the rail and the room list leave behind. */
  .app,
  .app.with-members {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  /* Server switching moves into a sheet behind the server name in the list header. */
  .app :deep(.rail) { display: none; }
  /* The panel becomes a sheet rather than disappearing: a toggle that does nothing is worse than
     a layout that needs one more tap. */
  .app :deep(.members) { display: none; }
  .app .members-backdrop :deep(.members) {
    display: block;
    width: 100%;
    max-height: 70vh;
    border-left: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    padding-bottom: calc(var(--sp-500) + var(--nav-inset, 0px));
  }
  .app :deep(.rooms) { width: 100%; display: flex; }
  .app.mobile :deep(.rooms) { display: none; }
  .app :deep(.chat) { display: none; }
  .app.mobile :deep(.chat) { display: flex; }
}
</style>
