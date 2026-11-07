<script setup lang="ts">
import { ref, watch } from 'vue';
import Icon from './Icon.vue';
import type { SearchHit } from '../services/data';

const props = defineProps<{
  scope: string;
  results: SearchHit[];
  searching: boolean;
  error?: string;
  /** Filters the query parser understood, and any name it could not resolve. */
  filters?: { channel?: string; from?: string; has?: string; before?: string; after?: string } | null;
  unknown?: string;
}>();
const emit = defineEmits<{
  (e: 'search', query: string): void;
  (e: 'select', hit: SearchHit): void;
  (e: 'close'): void;
}>();
const query = ref('');
let timer: ReturnType<typeof setTimeout> | null = null;

watch(query, (value) => {
  if (timer) clearTimeout(timer);
  // Typing is not a request per keystroke: the instance does real full-text search.
  timer = setTimeout(() => emit('search', value), 220);
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-label="Search">
      <header>
        <Icon name="search" :size="16" />
        <input
          v-model="query"
          autofocus
          placeholder="Search — try in:#channel from:someone has:image"
        />
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="16" /></button>
      </header>
      <p class="scope">{{ scope }}</p>
      <div class="results">
        <p v-if="error" class="warn">{{ error }}</p>
        <p v-else-if="searching" class="empty">Searching…</p>
        <p v-else-if="query.trim().length > 1 && !results.length" class="empty">Nothing found</p>
        <button v-for="hit in results" :key="hit.messageId" class="hit" @click="emit('select', hit)">
          <span class="hit-text">{{ hit.text }}</span>
          <span class="hit-meta">
            {{ new Date(hit.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
            <template v-if="hit.fuzzy"> · fuzzy</template>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 45; display: flex; align-items: flex-start; justify-content: center; background: rgb(0 0 0 / 0.45); }
.panel {
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  margin-top: 8vh;
  display: flex;
  flex-direction: column;
  background: var(--sf-container);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3);
  overflow: hidden;
}
header { display: flex; align-items: center; gap: var(--sp-200); padding: var(--sp-300); border-bottom: 1px solid var(--sf-line); color: var(--text-tertiary); }
header input { flex: 1; min-width: 0; border: none; outline: none; background: none; color: var(--text); font-size: var(--fs-base); }
.close { color: var(--text-tertiary); }
.scope { margin: 0; padding: var(--sp-200) var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.06em; }
.results { overflow-y: auto; padding: 0 var(--sp-200) var(--sp-300); }
.hit { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: var(--sp-200) var(--sp-300); border-radius: var(--radius-md); text-align: left; }
.hit:hover { background: var(--sfv-container); }
.hit-text { color: var(--text); font-size: var(--fs-sm); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.hit-meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.empty, .warn { padding: var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
</style>
