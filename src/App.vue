<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import ServerRail from './components/ServerRail.vue';
import RoomList from './components/RoomList.vue';
import ChatHeader from './components/ChatHeader.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';
import MemberList from './components/MemberList.vue';
import ServerSheet from './components/ServerSheet.vue';
import AuthScreen from './components/AuthScreen.vue';
import AuthCallback from './components/AuthCallback.vue';
import { channels as mockChannels, messages as mockMessages, servers as mockServers } from './data/mock';
import { refreshSession, sessionExpired, storedSession, type Session } from './services/auth';
import { fetchChannels, fetchMe, fetchMessages, fetchServers, sendMessage } from './services/data';
import { discoverHere, instanceHostFromLocation, type InstanceInfo } from './services/discover';

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
// While the page is being asked whether it is an instance, the address form must not render:
// showing it and then replacing it is the flash this used to have. On a dev server or in the
// shell the answer is known synchronously, so nothing is ever held back there.
const probing = ref(Boolean(selfHost) && !homeSession && !demoMode);
const live = ref(false);
const loading = ref(false);
const loadError = ref('');
const me = ref<{ name: string; role: 'admin' | 'mod' | null }>({ name: 'you', role: null });

const liveServers = ref<typeof mockServers>([]);
const liveChannels = ref<Record<string, typeof mockChannels>>({});
const liveMessages = ref<Record<string, typeof mockMessages.c1>>({});

const activeServer = ref(mockServers[0].id);
const activeChannel = ref('c1');
const membersOpen = ref(true);
// Phones start on the channel list: landing straight inside a channel left no way back
// except a 32px arrow in the corner.
const mobilePane = ref<'rooms' | 'chat'>('rooms');
const sending = ref(false);
// Phone server switcher. The rail is desktop furniture: on a phone it costs a row of the
// screen on every screen and scrolls sideways, which is what the strip did.
const serversOpen = ref(false);
const myProfileId = ref<string | null>(null);

// A session means the mocks are a lie: show the real thing or nothing. Rendering the mock
// first and swapping it is what produced the visible flash.
const servers = computed(() => {
  if (session.value) return live.value ? liveServers.value : [];
  return mockServers;
});
const server = computed(() => servers.value.find((s) => s.id === activeServer.value) ?? servers.value[0]);
const channels = computed(() => {
  if (session.value) return live.value ? liveChannels.value[activeServer.value] ?? [] : [];
  return mockChannels;
});
const channel = computed(
  () => channels.value.find((c) => c.id === activeChannel.value) ?? channels.value[0] ?? null
);
const channelMessages = computed(() => {
  if (!channel.value) return [];
  if (session.value) return live.value ? liveMessages.value[channel.value.id] ?? [] : [];
  return mockMessages[channel.value.id] ?? [];
});

async function loadChannel(serverId: string, channelId: string) {
  const s = session.value;
  if (!s || !live.value) return;
  if (!liveChannels.value[serverId]) {
    liveChannels.value[serverId] = await fetchChannels(s, serverId);
  }
  if (channelId && !liveMessages.value[channelId]) {
    liveMessages.value[channelId] = await fetchMessages(s, channelId);
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
    myProfileId.value = profile ? String(profile.id) : null;
    if (profile) {
      me.value = {
        name: String(profile.display_name || profile.username || 'you'),
        role: profile.is_admin ? 'admin' : profile.is_moderator ? 'mod' : null,
      };
    }
    const list = await fetchServers(s, String(profile?.id ?? ''));
    liveServers.value = list;
    if (list.length) {
      live.value = true;
      activeServer.value = list[0].id;
      const chans = await fetchChannels(s, list[0].id);
      liveChannels.value[list[0].id] = chans;
      const firstText = chans.find((c) => c.kind === 'text') ?? chans[0];
      if (firstText) {
        activeChannel.value = firstText.id;
        liveMessages.value[firstText.id] = await fetchMessages(s, firstText.id);
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

onMounted(() => {
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
  if (document.visibilityState === 'visible' && s && sessionExpired(s, 120_000) && s.refreshToken) {
    refreshSession(s).then((next) => (session.value = next)).catch(() => undefined);
  }
});

function enter() {
  session.value = selfHost ? storedSession(selfHost) : storedSession();
  location.hash = 'chat';
  mobilePane.value = 'rooms';
  boot();
}

function pickServer(id: string) {
  activeServer.value = id;
  const first = (live.value ? liveChannels.value[id] ?? [] : mockChannels).find((c) => c.kind === 'text');
  if (live.value && !liveChannels.value[id]) {
    const s = session.value;
    if (s) {
      fetchChannels(s, id).then((chans) => {
        liveChannels.value[id] = chans;
        const t = chans.find((c) => c.kind === 'text');
        if (t) {
          activeChannel.value = t.id;
          fetchMessages(s, t.id).then((m) => (liveMessages.value[t.id] = m));
        }
      });
    }
  } else if (first) {
    activeChannel.value = first.id;
  }
}

function pickChannel(id: string) {
  activeChannel.value = id;
  mobilePane.value = 'chat';
  const s = session.value;
  if (s && live.value && !liveMessages.value[id]) {
    fetchMessages(s, id).then((m) => (liveMessages.value[id] = m)).catch(() => undefined);
  }
}

async function onSend(body: string) {
  const s = session.value;
  const ch = channel.value;
  if (!s || !ch || !myProfileId.value) return;
  sending.value = true;
  try {
    await sendMessage(s, ch.id, myProfileId.value, body);
    liveMessages.value[ch.id] = await fetchMessages(s, ch.id);
  } catch (e) {
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
    @cancel="location.hash = 'auth'"
  />
  <AuthScreen
    v-else-if="route !== 'chat' || (!session && !demoMode)"
    :auto-instance="autoInstance"
    :probing="probing"
    @authenticated="enter"
  />
  <div v-else class="app" :class="{ 'with-members': membersOpen, mobile: mobilePane === 'chat' }">
    <ServerRail :servers="servers" :active-id="activeServer" @select="pickServer" />
    <RoomList
      :server-name="server?.name ?? ''"
      :channels="channels"
      :active-id="activeChannel"
      :me="me"
      :live="live"
      @select="pickChannel"
      @servers="serversOpen = true"
    />
    <main v-if="channel" class="chat">
      <ChatHeader
        :channel="channel"
        :members-open="membersOpen"
        :live="live"
        @toggle-members="membersOpen = !membersOpen"
        @back="mobilePane = 'rooms'"
      />
      <p v-if="loadError" class="banner">{{ loadError }}</p>
      <MessageList :channel="channel" :messages="channelMessages" :live="live" />
      <Composer :channel-name="channel.name" :disabled="!!channel.encrypted" :sending="sending" @send="onSend" />
    </main>
    <main v-else class="chat empty">
      <p>{{ loading ? 'Loading…' : 'No channels, or none visible to this session.' }}</p>
    </main>
    <MemberList v-if="membersOpen" />
    <ServerSheet
      v-if="serversOpen"
      :servers="servers"
      :active-id="activeServer"
      @select="(id) => { pickServer(id); serversOpen = false; }"
      @close="serversOpen = false"
    />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: grid;
  grid-template-columns: var(--rail-width) var(--rooms-width) 1fr;
  min-height: 0;
}
.app.with-members { grid-template-columns: var(--rail-width) var(--rooms-width) 1fr var(--members-width); }
.chat { display: flex; flex-direction: column; min-width: 0; background: var(--bg-container); }
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
  .app :deep(.members) { display: none; }
  .app :deep(.rooms) { width: 100%; display: flex; }
  .app.mobile :deep(.rooms) { display: none; }
  .app :deep(.chat) { display: none; }
  .app.mobile :deep(.chat) { display: flex; }
  .app :deep(.me) { display: none; }
}
</style>
