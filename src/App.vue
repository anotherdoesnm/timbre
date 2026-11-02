<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import ServerRail from './components/ServerRail.vue';
import RoomList from './components/RoomList.vue';
import ChatHeader from './components/ChatHeader.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';
import MemberList from './components/MemberList.vue';
import AuthScreen from './components/AuthScreen.vue';
import AuthCallback from './components/AuthCallback.vue';
import { channels as mockChannels, messages as mockMessages, servers as mockServers } from './data/mock';
import { storedSession, type Session } from './services/auth';
import { fetchChannels, fetchMe, fetchMessages, fetchServers } from './services/data';

const hash = () => location.hash.replace('#', '');
const initialSearch = new URLSearchParams(location.search.slice(1));
// GoTrue returns to `/auth/callback?code=…`; a hash route says the same thing in the SPA.
const fromSearch =
  initialSearch.has('code') ||
  initialSearch.has('error') ||
  initialSearch.has('error_description') ||
  /\/auth\/callback\/?$/.test(location.pathname);
const route = ref(fromSearch ? 'auth/callback' : hash().split('?')[0]);
const hashQuery = ref(fromSearch ? location.search.slice(1) : hash().split('?')[1] ?? '');
window.addEventListener('hashchange', () => {
  route.value = hash().split('?')[0];
  hashQuery.value = hash().split('?')[1] ?? '';
});
const demoMode = new URLSearchParams(location.search).get('demo') === '1';

/* ---- session and live data ------------------------------------------------------------ */
const session = ref<Session | null>(storedSession());
const live = ref(false);
const loading = ref(false);
const loadError = ref('');
const me = ref<{ name: string; role: 'admin' | 'mod' | null }>({ name: 'вы', role: null });

const liveServers = ref<typeof mockServers>([]);
const liveChannels = ref<Record<string, typeof mockChannels>>({});
const liveMessages = ref<Record<string, typeof mockMessages.c1>>({});

const activeServer = ref(mockServers[0].id);
const activeChannel = ref('c1');
const membersOpen = ref(true);
const mobilePane = ref<'rooms' | 'chat'>('chat');

const servers = computed(() => (live.value && liveServers.value.length ? liveServers.value : mockServers));
const server = computed(() => servers.value.find((s) => s.id === activeServer.value) ?? servers.value[0]);
const channels = computed(() =>
  live.value ? liveChannels.value[activeServer.value] ?? [] : mockChannels
);
const channel = computed(
  () => channels.value.find((c) => c.id === activeChannel.value) ?? channels.value[0] ?? null
);
const channelMessages = computed(() => {
  if (!channel.value) return [];
  return live.value ? liveMessages.value[channel.value.id] ?? [] : mockMessages[channel.value.id] ?? [];
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

async function boot() {
  const s = session.value;
  if (!s) return;
  loading.value = true;
  loadError.value = '';
  try {
    const profile = await fetchMe(s);
    if (profile) {
      me.value = {
        name: String(profile.display_name || profile.username || 'вы'),
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

onMounted(boot);

function enter() {
  session.value = storedSession();
  location.hash = 'chat';
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
  <AuthScreen v-else-if="route !== 'chat' || (!session && !demoMode)" @authenticated="enter" />
  <div v-else class="app" :class="{ 'with-members': membersOpen, mobile: mobilePane === 'chat' }">
    <ServerRail :servers="servers" :active-id="activeServer" @select="pickServer" />
    <RoomList
      :server-name="server?.name ?? ''"
      :channels="channels"
      :active-id="activeChannel"
      :me="me"
      :live="live"
      @select="pickChannel"
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
      <MessageList :channel="channel" :messages="channelMessages" />
      <Composer :channel-name="channel.name" :disabled="!!channel.encrypted" />
    </main>
    <main v-else class="chat empty">
      <p>No channels, or none visible to this session.</p>
    </main>
    <MemberList v-if="membersOpen" />
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
    grid-template-rows: auto 1fr;
  }
  .app :deep(.rail) { display: none; }
  .app :deep(.members) { display: none; }
  .app :deep(.rooms) { width: 100%; grid-row: 1 / span 2; display: flex; }
  .app.mobile :deep(.rooms) { display: none; }
  .app :deep(.chat) { display: none; grid-row: 1 / span 2; }
  .app.mobile :deep(.chat) { display: flex; }
}
</style>
