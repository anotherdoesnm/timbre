<script setup lang="ts">
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';

defineProps<{
  channel: Channel;
  membersOpen: boolean;
  live?: boolean;
  muted?: boolean;
  pins?: number;
  /** Unread threads in this channel, for the badge next to the icon. */
  threads?: number;
}>();
const emit = defineEmits<{
  (e: 'toggle-members'): void;
  (e: 'back'): void;
  (e: 'search'): void;
  (e: 'toggle-mute'): void;
  (e: 'pins'): void;
  (e: 'threads'): void;
}>();
</script>

<template>
  <header class="head">
    <div class="left">
      <button class="back" title="Back" @click="emit('back')"><Icon name="reply" :size="18" /></button>
      <Icon :name="channel.kind === 'voice' ? 'volume' : 'hash'" :size="20" />
      <span class="name">{{ channel.name }}</span>
      <Icon v-if="channel.encrypted" name="lock" :size="14" class="lock" />
      <span class="tag">{{ live ? 'live' : 'demo' }}</span>
      <span class="topic">Timbre — a client for Harmony</span>
    </div>
    <div class="right">
      <button class="action" title="Search" @click="emit('search')"><Icon name="search" :size="18" /></button>
      <button
        class="action"
        :class="{ on: !!threads }"
        :title="threads ? `Threads (${threads} unread)` : 'Threads'"
        @click="emit('threads')"
      >
        <Icon name="thread" :size="18" />
        <span v-if="threads" class="thread-count">{{ threads }}</span>
      </button>
      <button
        class="action"
        :class="{ on: !!pins }"
        :title="pins ? `Pinned messages (${pins})` : 'Pinned messages'"
        @click="emit('pins')"
      >
        <Icon name="pin" :size="18" />
        <span v-if="pins" class="pin-count">{{ pins }}</span>
      </button>
      <!-- The bell mutes this channel. Notification *permission* lives in the account sheet, and
           the old "More" button is gone: a control that does nothing is worse than no control. -->
      <button
        class="action"
        :class="{ off: muted }"
        :title="muted ? 'Unmute this channel' : 'Mute this channel'"
        :aria-pressed="muted ? 'true' : 'false'"
        @click="emit('toggle-mute')"
      >
        <Icon :name="muted ? 'bell-off' : 'bell'" :size="18" />
      </button>
      <button class="action" :class="{ on: membersOpen }" title="Members" @click="emit('toggle-members')">
        <Icon name="users" :size="18" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.head {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-300);
  padding: 0 var(--sp-300);
  border-bottom: 1px solid var(--bg-line);
  color: var(--text-secondary);
}
.left { display: flex; align-items: center; gap: var(--sp-200); min-width: 0; color: var(--text); }
.name { font-weight: 600; font-size: var(--fs-md); }
.lock { color: var(--text-tertiary); }
.topic {
  margin-left: var(--sp-200);
  padding-left: var(--sp-300);
  border-left: 1px solid var(--bg-line);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.back {
  display: none;
  width: 44px;
  height: 44px;
  margin-left: -8px;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--text);
}
.back:hover { background: var(--sfv-container); color: var(--text); }
.tag {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: var(--sfv-container);
  color: var(--text-tertiary);
}
@media (max-width: 860px) { .back { display: grid; } .topic { display: none; } }
.right { display: flex; align-items: center; gap: var(--sp-100); color: var(--text-secondary); }
.action {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
}
.action:hover { background: var(--sfv-container); color: var(--text); }
.action.on { background: var(--sfv-active); color: var(--text); }
</style>
