<script setup lang="ts">
import Icon from './Icon.vue';
import type { PinnedMessage } from '../services/data';

/**
 * Pinned messages of the open channel or conversation.
 *
 * Pins are how a channel keeps the two or three things a newcomer must read at the top of a
 * hundred-message scroll, and the instance stores who pinned what and when — so the panel shows the
 * pinner's trail, not just the text.
 */
const props = defineProps<{ items: PinnedMessage[]; loading: boolean; error?: string }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'open', item: PinnedMessage): void }>();

function when(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.round((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-label="Pinned messages">
      <header>
        <span>Pinned<span v-if="items.length" class="count">{{ items.length }}</span></span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !items.length" class="hint">Loading…</p>
      <p v-else-if="!items.length" class="hint">
        Nothing pinned yet. Pin a message from its toolbar to keep it here.
      </p>

      <button v-for="item in items" :key="item.id" class="row" @click="emit('open', item)">
        <span class="avatar" :style="item.avatarUrl ? undefined : { background: item.color }">
          <img v-if="item.avatarUrl" :src="item.avatarUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ item.initial }}</template>
        </span>
        <span class="body">
          <span class="who">{{ item.author }}</span>
          <span class="text">{{ item.text || '[attachment]' }}</span>
          <span class="meta">pinned {{ when(item.pinnedAt) }}</span>
        </span>
        <Icon name="chevron" :size="14" class="chev" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 44;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.panel {
  width: 100%;
  max-width: 520px;
  max-height: 75vh;
  overflow-y: auto;
  padding: var(--sp-200) var(--sp-200) calc(var(--sp-500) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
  animation: panel-up 160ms ease-out;
}
@keyframes panel-up { from { transform: translateY(12px); opacity: 0.6; } to { transform: none; opacity: 1; } }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300) var(--sp-300);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.count {
  margin-left: var(--sp-200);
  padding: 0 5px;
  border-radius: var(--radius-xs);
  background: var(--primary-container);
  color: var(--primary-on-container);
  font-weight: 700;
}
.close { padding: var(--sp-100); color: var(--text-tertiary); }
.hint { margin: 0; padding: var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  text-align: left;
}
.row:active { background: var(--sfv-container); }
.avatar {
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  color: var(--primary-on);
  font-weight: 700;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.body { display: flex; flex-direction: column; min-width: 0; gap: 2px; flex: 1; }
.who { color: var(--text); font-weight: 600; }
.text { color: var(--text-secondary); overflow-wrap: anywhere; }
.meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.chev { color: var(--text-tertiary); align-self: center; transform: rotate(-90deg); }
</style>
