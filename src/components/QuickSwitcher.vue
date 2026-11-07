<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';
import type { Conversation } from '../services/data';

/**
 * Jump anywhere: every channel of every server, and every conversation, in one filterable list.
 *
 * The phone has a channel list per server and a DM list; this is for the other case — you know the
 * name and want it now, without remembering which server it lives on.
 */
const props = defineProps<{
  servers: { id: string; name: string }[];
  channels: Record<string, Channel[]>;
  conversations: Conversation[];
}>();
const emit = defineEmits<{
  (e: 'pick', serverId: string | null, channelId: string): void;
  (e: 'close'): void;
}>();

const query = ref('');

interface Item {
  key: string;
  label: string;
  where: string;
  serverId: string | null;
  channelId: string;
  kind: 'channel' | 'dm';
}

const items = computed<Item[]>(() => {
  const out: Item[] = [];
  for (const server of props.servers) {
    for (const channel of props.channels[server.id] ?? []) {
      if (channel.kind !== 'text') continue;
      out.push({
        key: `c:${channel.id}`,
        label: `#${channel.name}`,
        where: server.name,
        serverId: server.id,
        channelId: channel.id,
        kind: 'channel',
      });
    }
  }
  for (const conversation of props.conversations) {
    out.push({
      key: `d:${conversation.id}`,
      label: conversation.title,
      where: 'direct message',
      serverId: null,
      channelId: conversation.id,
      kind: 'dm',
    });
  }
  return out;
});

const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = q
    ? items.value.filter(
        (i) => i.label.toLowerCase().includes(q) || i.where.toLowerCase().includes(q)
      )
    : items.value;
  return list.slice(0, 40);
});

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && shown.value.length) {
    const first = shown.value[0];
    emit('pick', first.serverId, first.channelId);
  }
  if (event.key === 'Escape') emit('close');
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Jump to">
      <header>
        <span>Jump to</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>
      <input
        v-model="query"
        class="search"
        type="text"
        placeholder="Channel or person"
        autocomplete="off"
        spellcheck="false"
        autofocus
        @keydown="onKey"
      />
      <p v-if="!shown.length" class="hint">Nothing matches.</p>
      <button v-for="item in shown" :key="item.key" class="row" @click="emit('pick', item.serverId, item.channelId)">
        <span class="icon"><Icon :name="item.kind === 'dm' ? 'users' : 'hash'" :size="15" /></span>
        <span class="label">{{ item.label }}</span>
        <span class="where">{{ item.where }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgb(0 0 0 / 0.5);
}
.sheet {
  width: min(560px, calc(100% - var(--sp-500)));
  max-height: 70vh;
  overflow-y: auto;
  padding: var(--sp-300);
  background: var(--sf-container);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-3);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--sp-200);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.search {
  width: 100%;
  margin-bottom: var(--sp-200);
  padding: var(--sp-200) var(--sp-300);
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.hint { margin: 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200);
  border-radius: var(--radius-md);
  text-align: left;
}
.row:hover { background: var(--sfv-container); }
.icon {
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: var(--sf-base);
  color: var(--text-secondary);
}
.label { flex: 1; min-width: 0; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.where { color: var(--text-tertiary); font-size: var(--fs-xs); }
</style>
