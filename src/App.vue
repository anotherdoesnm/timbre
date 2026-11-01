<script setup lang="ts">
import { computed, ref } from 'vue';
import ServerRail from './components/ServerRail.vue';
import RoomList from './components/RoomList.vue';
import ChatHeader from './components/ChatHeader.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';
import MemberList from './components/MemberList.vue';
import AuthScreen from './components/AuthScreen.vue';
import AuthCallback from './components/AuthCallback.vue';
import { channels, messages, servers } from './data/mock';

const hash = () => location.hash.replace('#', '');
const route = ref(hash().split('?')[0]);
const hashQuery = ref(hash().split('?')[1] ?? '');
window.addEventListener('hashchange', () => {
  route.value = hash().split('?')[0];
  hashQuery.value = hash().split('?')[1] ?? '';
});
const demoMode = new URLSearchParams(location.search).get('demo') === '1';
function enter() {
  location.hash = 'chat';
}

const activeServer = ref(servers[0].id);
const activeChannel = ref('c1');
const membersOpen = ref(true);

const server = computed(() => servers.find((s) => s.id === activeServer.value) ?? servers[0]);
const channel = computed(() => channels.find((c) => c.id === activeChannel.value) ?? channels[0]);
const channelMessages = computed(() => messages[channel.value.id] ?? []);
</script>

<template>
  <AuthCallback
    v-if="route === 'auth/callback'"
    :query="hashQuery"
    :demo="demoMode"
    @done="enter"
    @cancel="location.hash = 'auth'"
  />
  <AuthScreen v-else-if="route !== 'chat'" @authenticated="enter" />
  <div v-else class="app" :class="{ 'with-members': membersOpen }">
    <ServerRail :servers="servers" :active-id="activeServer" @select="activeServer = $event" />
    <RoomList
      :server-name="server.name"
      :channels="channels"
      :active-id="activeChannel"
      @select="activeChannel = $event"
    />
    <main class="chat">
      <ChatHeader :channel="channel" :members-open="membersOpen" @toggle-members="membersOpen = !membersOpen" />
      <MessageList :channel="channel" :messages="channelMessages" />
      <Composer :channel-name="channel.name" :disabled="!!channel.encrypted" />
    </main>
    <MemberList v-if="membersOpen" />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: grid;
  grid-template-columns: var(--rail-width) var(--rooms-width) 1fr;
}
.app.with-members { grid-template-columns: var(--rail-width) var(--rooms-width) 1fr var(--members-width); }
.chat { display: flex; flex-direction: column; min-width: 0; background: var(--bg-container); }
</style>
