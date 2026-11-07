<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';

/**
 * Forwarding a message: pick where it goes.
 *
 * The text channels of the open server, plus its threads are out of scope — a forward into a
 * channel is the case people actually use, and the target has to be somewhere this person can post.
 */
const props = defineProps<{ channels: Channel[]; from?: string }>();
const emit = defineEmits<{
  (e: 'pick', channelId: string): void;
  (e: 'close'): void;
}>();

const query = ref('');
const list = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.channels
    .filter((c) => c.kind === 'text')
    .filter((c) => !q || c.name.toLowerCase().includes(q));
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Forward">
      <header>
        <span>Forward to</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>
      <p v-if="from" class="hint">From #{{ from }}</p>
      <input v-model="query" class="search" type="text" placeholder="Channel" autocomplete="off" spellcheck="false" />
      <p v-if="!list.length" class="hint">No channels match.</p>
      <button v-for="c in list" :key="c.id" class="row" @click="emit('pick', c.id)">
        <span class="icon"><Icon name="hash" :size="15" /></span>
        <span class="name">{{ c.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 46;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 440px;
  max-height: 70vh;
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
.hint { margin: 0 0 var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-sm); }
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
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: var(--sf-base);
  color: var(--text-secondary);
}
.name { color: var(--text); }
</style>
