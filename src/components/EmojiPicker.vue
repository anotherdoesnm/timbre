<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { loadEmojiIndex, searchEmoji, type CustomEmoji, type EmojiEntry } from '../services/emoji';

/**
 * The picker behind reactions and the composer.
 *
 * Names come from the Unicode dataset the official client uses, so `:joy:` and "joy" both find 😂;
 * an instance's custom emoji sit above them. The data loads on first open — it is a few hundred
 * kilobytes and nobody pays for it until they tap the smiley.
 */
const props = defineProps<{
  custom?: CustomEmoji[];
  mode?: 'reaction' | 'insert';
  /** Names of the servers whose emoji are in `custom`, keyed by id — the headings. */
  serverNames?: Record<string, string>;
}>();
const emit = defineEmits<{
  (e: 'pick', value: { char?: string; name?: string; url?: string }): void;
  (e: 'close'): void;
}>();

const query = ref('');
const entries = ref<EmojiEntry[]>([]);
const loading = ref(true);
const failed = ref(false);

onMounted(async () => {
  try {
    entries.value = await loadEmojiIndex();
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
});

const results = computed(() => searchEmoji(entries.value, query.value, 72));
/**
 * Custom emoji grouped by where they belong: the instance's own first, then each server the person
 * is in. A single "This instance" heading was a lie — most of those pictures belong to guilds, and
 * the list used to include emoji from servers the person was not even in.
 */
const customGroups = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = (props.custom ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  const groups = new Map<string, { title: string; items: CustomEmoji[] }>();
  for (const emoji of list) {
    const key = emoji.serverId ?? '';
    if (!groups.has(key)) {
      groups.set(key, {
        title: key ? props.serverNames?.[key] ?? 'Server' : 'This instance',
        items: [],
      });
    }
    groups.get(key)!.items.push(emoji);
  }
  // The instance first, servers after it in the order they arrived.
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0))
    .map(([, group]) => ({ ...group, items: group.items.slice(0, 60) }));
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="picker" role="dialog" aria-label="Emoji">
      <header>
        <span>{{ mode === 'insert' ? 'Insert emoji' : 'React with' }}</span>
        <button class="close" aria-label="Close" @click="emit('close')">✕</button>
      </header>
      <input
        v-model="query"
        class="search"
        type="text"
        placeholder="Search — joy, fire, :tada:"
        autocomplete="off"
        spellcheck="false"
      />

      <p v-if="failed" class="hint">The emoji list did not load; custom emoji still work.</p>
      <section v-for="group in customGroups" :key="group.title" class="custom">
        <div class="title">{{ group.title }}</div>
        <div class="grid">
          <button
            v-for="c in group.items"
            :key="`${group.title}:${c.name}`"
            class="cell image"
            :title="`:${c.name}:`"
            @click="emit('pick', { name: c.name, url: c.url })"
          >
            <img :src="c.url" :alt="`:${c.name}:`" loading="lazy" referrerpolicy="no-referrer" />
          </button>
        </div>
      </section>

      <p v-if="loading" class="hint">Loading…</p>
      <div v-else class="grid">
        <button
          v-for="e in results"
          :key="e.char"
          class="cell"
          :title="e.shortcodes.length ? `:${e.shortcodes[0]}:` : e.name"
          @click="emit('pick', { char: e.char })"
        >
          {{ e.char }}
        </button>
      </div>
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
  max-width: 420px;
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
.title { padding: var(--sp-100) var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-xs); text-transform: uppercase; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 2px; padding: 0 var(--sp-200); }
.cell {
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  font-size: 22px;
  line-height: 1;
}
.cell:active, .cell:hover { background: var(--sfv-container); }
.cell.image img { width: 24px; height: 24px; object-fit: contain; }
.hint { margin: 0; padding: var(--sp-200) var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
</style>
