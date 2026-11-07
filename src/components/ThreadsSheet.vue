<script setup lang="ts">
import Icon from './Icon.vue';
import type { ThreadSummary } from '../services/data';

/**
 * The threads of the open channel.
 *
 * Threads existed but had no front door: a reply in one only showed as "N replies" under the parent
 * message, and a thread somebody else kept talking in was invisible. This lists them by activity,
 * with the count and an unread dot.
 */
defineProps<{ threads: ThreadSummary[]; loading?: boolean; error?: string }>();
const emit = defineEmits<{
  (e: 'open', thread: ThreadSummary): void;
  (e: 'close'): void;
}>();

function when(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Threads">
      <header>
        <span>Threads</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !threads.length" class="hint">Loading…</p>
      <p v-else-if="!threads.length" class="hint">
        No threads here yet. "Reply in thread" in a message's toolbar starts one.
      </p>

      <button v-for="thread in threads" :key="thread.id" class="row" @click="emit('open', thread)">
        <span class="icon"><Icon :name="thread.locked ? 'shield' : 'thread'" :size="15" /></span>
        <span class="body">
          <span class="name" :class="{ unread: thread.unread }">{{ thread.name }}</span>
          <span class="meta">
            {{ thread.replies }} {{ thread.replies === 1 ? 'reply' : 'replies' }}
            <template v-if="thread.lastAt"> · {{ when(thread.lastAt) }}</template>
          </span>
        </span>
        <span v-if="thread.unread" class="dot" aria-label="unread" />
      </button>
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
  max-height: 75vh;
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
.hint { margin: 0; padding: var(--sp-200) 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) 0;
  border-top: 1px solid var(--sf-line);
  text-align: left;
}
.icon {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: var(--sf-base);
  color: var(--text-secondary);
}
.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.name { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name.unread { color: var(--text); font-weight: 600; }
.meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.dot { width: 7px; height: 7px; flex: none; border-radius: var(--radius-round); background: var(--primary-main); }
</style>
