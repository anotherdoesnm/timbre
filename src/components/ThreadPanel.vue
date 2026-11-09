<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import MessageList from './MessageList.vue';
import Composer from './Composer.vue';
import type { Channel, Message } from '../data/mock';
import type { CustomEmoji } from '../services/emoji';

/**
 * A thread beside the channel.
 *
 * The parent message stays visible on top so a reader who arrived from a "3 replies" line knows
 * what is being discussed; the rest is the same message list and composer as the channel, scoped to
 * `thread_id`. Threads are channel-only — a conversation has no threads.
 */
const props = defineProps<{
  parent: Message;
  messages: Message[];
  loading?: boolean;
  sending?: boolean;
  myId?: string | null;
  customEmoji?: CustomEmoji[];
  draftKey?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'send', text: string): void;
  (e: 'react', m: Message, emoji: string, mine: boolean): void;
  (e: 'edit', m: Message, text: string): void;
  (e: 'delete', m: Message): void;
  (e: 'mention', handle: string): void;
}>();

/** MessageList wants a channel; the thread's own id keeps it from reusing the channel's scroll state. */
const channel = computed<Channel>(
  () => ({ id: `thread:${props.parent.id}`, name: 'thread', kind: 'text', category: 'Thread', encrypted: false })
);
</script>

<template>
  <aside class="thread" aria-label="Thread">
    <header>
      <span class="title">Thread</span>
      <button class="close" aria-label="Close thread" @click="emit('close')"><Icon name="close" :size="18" /></button>
    </header>

    <div class="parent">
      <div class="who">
        <span class="avatar" :style="parent.author.avatarUrl ? undefined : { background: parent.author.color }">
          <img v-if="parent.author.avatarUrl" :src="parent.author.avatarUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ parent.author.initial }}</template>
        </span>
        <span class="author">{{ parent.author.name }}</span>
        <span class="time">{{ parent.time }}</span>
      </div>
      <p class="text">{{ parent.text }}</p>
    </div>

    <p v-if="loading" class="hint">Loading…</p>
    <MessageList
      v-else
      :channel="channel"
      :messages="messages"
      :has-more="false"
      :loading-older="false"
      :intro="false"
      end-label="Start of the thread"
      :my-id="myId"
      :custom-emoji="customEmoji"
      @react="(m, e, mine) => emit('react', m, e, mine)"
      @edit="(m: Message) => emit('edit', m, m.text)"
      @delete="(m) => emit('delete', m)"
      @mention="(handle) => emit('mention', handle)"
    />

    <Composer
      :channel-name="'thread'"
      :sending="sending"
      :draft-key="draftKey"
      @send="(text) => emit('send', text)"
    />
  </aside>
</template>

<style scoped>
.thread {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--bg-container);
  border-left: 1px solid var(--sf-line);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300);
  border-bottom: 1px solid var(--sf-line);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.parent { padding: var(--sp-300); border-bottom: 1px solid var(--sf-line); background: var(--sf-container); }
.who { display: flex; align-items: center; gap: var(--sp-200); margin-bottom: var(--sp-100); }
.avatar {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  color: var(--primary-on);
  font-size: 10px;
  font-weight: 700;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.author { color: var(--text); font-weight: 600; }
.time { color: var(--text-tertiary); font-size: var(--fs-xs); }
.text { margin: 0; color: var(--text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; }
.hint { margin: 0; padding: var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
</style>
