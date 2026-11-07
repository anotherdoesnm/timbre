<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { PublicServer } from '../services/data';

/**
 * Servers on this instance that anybody may join.
 *
 * The list is the instance's own answer (`servers.public`), ordered by size. Joining goes through
 * `join_public_server`, which is also what registration uses; a server you are already in opens
 * instead of offering to join.
 */
const props = defineProps<{ servers: PublicServer[]; loading?: boolean; error?: string; busyId?: string }>();
const emit = defineEmits<{
  (e: 'join', server: PublicServer): void;
  (e: 'open', server: PublicServer): void;
  (e: 'close'): void;
}>();

const query = ref('');
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Public servers">
      <header>
        <span>Public servers</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <input v-model="query" class="search" type="text" placeholder="Search servers" autocomplete="off" spellcheck="false" />

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !servers.length" class="hint">Loading…</p>
      <p v-else-if="!servers.length" class="hint">
        This instance has no public servers yet. An invite link still works — ask for one.
      </p>

      <div
        v-for="server in servers.filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()))"
        :key="server.id"
        class="row"
      >
        <span class="tile" :style="server.iconUrl ? undefined : { background: 'var(--primary-main)' }">
          <img v-if="server.iconUrl" :src="server.iconUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ server.name.slice(0, 2).toUpperCase() }}</template>
        </span>
        <span class="body">
          <span class="name">{{ server.name }}</span>
          <span class="meta">
            <template v-if="server.members">{{ server.members }} members</template>
            <template v-if="server.description"> · {{ server.description }}</template>
          </span>
        </span>
        <button v-if="server.isMember" class="action ghost" @click="emit('open', server)">Open</button>
        <button v-else class="action" :disabled="busyId === server.id" @click="emit('join', server)">
          {{ busyId === server.id ? '…' : 'Join' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  padding: var(--sp-200) var(--sp-300) calc(var(--sp-400) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) 0 var(--sp-200);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.search {
  width: 100%;
  margin-bottom: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.hint { margin: 0 0 var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) 0;
  border-top: 1px solid var(--sf-line);
}
.tile {
  width: 38px;
  height: 38px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  overflow: hidden;
  color: var(--primary-on);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.name { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta {
  color: var(--text-tertiary);
  font-size: var(--fs-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action {
  flex: none;
  padding: var(--sp-100) var(--sp-300);
  border-radius: var(--radius-md);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
  font-size: var(--fs-sm);
}
.action.ghost { background: var(--sfv-container); color: var(--text); }
.action:disabled { opacity: 0.6; }
</style>
