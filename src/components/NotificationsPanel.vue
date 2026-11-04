<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import type { NotificationItem } from '../services/data';

/**
 * "What happened while you were not looking."
 *
 * The instance keeps this list per person; the panel is the only place in this client where a
 * mention, a reply or a security notice can be found after the toast has gone. Ordering and the
 * unread state come from the instance, so other clients see the same thing.
 */
const props = defineProps<{
  items: NotificationItem[];
  loading: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open', item: NotificationItem): void;
  (e: 'read-all'): void;
}>();

const unread = computed(() => props.items.filter((i) => !i.isRead).length);

/** An icon per family of event; anything unknown gets the generic bell. */
function mark(type: string): string {
  if (type.includes('mention')) return 'at';
  if (type.includes('reply') || type.includes('thread')) return 'reply';
  if (type.includes('dm') || type.includes('message')) return 'inbox';
  if (type.includes('security')) return 'shield';
  if (type.includes('follow')) return 'users';
  if (type.includes('reaction')) return 'smile';
  return 'bell';
}

/** "3m", "2h", "вчера"-style relative times without pulling in a date library. */
function when(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-label="Notifications">
      <header>
        <span>Notifications<span v-if="unread" class="count">{{ unread }}</span></span>
        <span class="actions">
          <button v-if="unread" class="text" @click="emit('read-all')">Mark all read</button>
          <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
        </span>
      </header>

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !items.length" class="hint">Loading…</p>
      <p v-else-if="!items.length" class="hint">Nothing yet. Mentions, replies and security notices land here.</p>

      <button
        v-for="item in items"
        :key="item.id"
        class="row"
        :class="{ unread: !item.isRead, actionable: !!item.channelId }"
        @click="emit('open', item)"
      >
        <span class="icon"><Icon :name="mark(item.type)" :size="16" /></span>
        <span class="body">
          <span class="line">
            <span v-if="item.actor" class="who">{{ item.actor.name }}</span>
            <span class="text">{{ item.text }}</span>
          </span>
          <span class="meta">
            <span v-if="item.where">{{ item.where }}</span>
            <span class="type">{{ item.type }}</span>
            <span class="time">{{ when(item.createdAt) }}</span>
          </span>
        </span>
        <span v-if="!item.isRead" class="dot" aria-label="unread" />
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
  gap: var(--sp-200);
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
.actions { display: flex; align-items: center; gap: var(--sp-200); text-transform: none; letter-spacing: 0; }
.text { color: var(--primary-main); font-size: var(--fs-sm); }
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
.row.unread .who { font-weight: 600; }
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
.body { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.line { display: flex; gap: var(--sp-200); flex-wrap: wrap; }
.who { color: var(--text); }
.text { color: var(--text-secondary); overflow-wrap: anywhere; }
.meta { display: flex; gap: var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-xs); }
.type { text-transform: uppercase; letter-spacing: 0.04em; }
.dot {
  width: 7px;
  height: 7px;
  flex: none;
  margin-left: auto;
  border-radius: var(--radius-round);
  background: var(--primary-main);
}
</style>
