<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import type { Sticker } from '../services/data';

/**
 * Stickers: the instance's own, plus this person's uploads.
 *
 * They are ordinary pictures in the `stickers` bucket — unlike GIF, which is a third-party service
 * (klipy) and needs keys an instance may not have. Uploading is capped by the instance
 * (`max_personal_stickers_per_user`), and a refusal from the bucket arrives here as an error.
 */
const props = defineProps<{
  stickers: Sticker[];
  loading?: boolean;
  uploading?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  (e: 'pick', sticker: Sticker): void;
  (e: 'upload', file: File): void;
  (e: 'close'): void;
}>();

const query = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? props.stickers.filter((s) => s.name.toLowerCase().includes(q)) : props.stickers;
});

function choose(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('upload', file);
  input.value = '';
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="picker" role="dialog" aria-label="Stickers">
      <header>
        <span>Stickers</span>
        <span class="actions">
          <button class="text" :disabled="uploading" @click="fileInput?.click()">
            {{ uploading ? 'Uploading…' : 'Add yours' }}
          </button>
          <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
        </span>
      </header>
      <input ref="fileInput" class="hidden" type="file" accept="image/png,image/apng,image/webp,image/gif" @change="choose" />

      <input v-model="query" class="search" type="text" placeholder="Search stickers" autocomplete="off" spellcheck="false" />

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !stickers.length" class="hint">Loading…</p>
      <p v-else-if="!stickers.length" class="hint">
        No stickers yet. “Add yours” uploads a png, webp or gif to this instance — the number you may
        keep is set by its administrator.
      </p>

      <div v-if="shown.length" class="grid">
        <button v-for="s in shown" :key="s.id" class="cell" :title="s.name" @click="emit('pick', s)">
          <img :src="s.url" :alt="s.name" loading="lazy" referrerpolicy="no-referrer" />
        </button>
      </div>
      <p v-else-if="stickers.length" class="hint">Nothing matches “{{ query }}”.</p>
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
  background: rgb(0 0 0 / 0.35);
}
.picker {
  width: 100%;
  max-width: 440px;
  max-height: 60vh;
  overflow-y: auto;
  padding: var(--sp-200) var(--sp-200) calc(var(--sp-400) + var(--nav-inset, 0px));
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
.actions { display: flex; align-items: center; gap: var(--sp-300); text-transform: none; letter-spacing: 0; }
.text { color: var(--primary-main); font-size: var(--fs-sm); }
.text:disabled { opacity: 0.5; }
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
.hidden { display: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: var(--sp-200); padding: var(--sp-200); }
.cell {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: var(--sp-200);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
}
.cell:active { background: var(--sfv-container); }
.cell img { max-width: 100%; max-height: 100%; object-fit: contain; }
.hint { margin: 0; padding: var(--sp-200) var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
</style>
