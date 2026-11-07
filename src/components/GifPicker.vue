<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import type { Gif } from '../services/gifs';

/**
 * Searching the instance's GIF proxy.
 *
 * The key lives on the instance: this component only asks, shows what comes back and sends the
 * file's url. Trending on open, search on typing — with a debounce, because every keystroke would
 * otherwise be a request to a third-party service.
 */
const props = defineProps<{ gifs: Gif[]; loading?: boolean; error?: string; unavailable?: boolean }>();
const emit = defineEmits<{
  (e: 'search', query: string): void;
  (e: 'pick', gif: Gif): void;
  (e: 'close'): void;
}>();

const query = ref('');
let timer: ReturnType<typeof setTimeout> | null = null;

function onInput(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => emit('search', query.value), 350);
}

onMounted(() => emit('search', ''));
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="picker" role="dialog" aria-label="GIFs">
      <header>
        <span>GIFs</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <input
        v-model="query"
        class="search"
        type="text"
        placeholder="Search GIFs"
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
      />

      <p v-if="unavailable" class="hint">
        This instance has no GIF provider configured — its operator has to add a klipy key.
      </p>
      <p v-else-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !gifs.length" class="hint">Loading…</p>
      <p v-else-if="!gifs.length" class="hint">Nothing for “{{ query }}”.</p>

      <div v-if="gifs.length" class="grid">
        <button v-for="gif in gifs" :key="gif.id" class="cell" :title="gif.title" @click="emit('pick', gif)">
          <img :src="gif.preview" :alt="gif.title" loading="lazy" referrerpolicy="no-referrer" />
        </button>
      </div>
      <p v-if="gifs.length" class="credit">GIFs by klipy</p>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.4);
}
.picker {
  width: 100%;
  max-width: 480px;
  max-height: 65vh;
  overflow-y: auto;
  padding: var(--sp-200) var(--sp-200) calc(var(--sp-300) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300) var(--sp-200);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.search {
  width: calc(100% - var(--sp-600));
  margin: 0 var(--sp-300) var(--sp-200);
  padding: var(--sp-200) var(--sp-300);
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.hint { margin: 0; padding: var(--sp-200) var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-100);
  padding: 0 var(--sp-200);
}
.cell { border-radius: var(--radius-md); overflow: hidden; background: var(--sf-base); aspect-ratio: 4 / 3; }
.cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.credit {
  margin: var(--sp-200) 0 0;
  padding: 0 var(--sp-300);
  color: var(--text-tertiary);
  font-size: var(--fs-xs);
  text-align: right;
}
</style>
