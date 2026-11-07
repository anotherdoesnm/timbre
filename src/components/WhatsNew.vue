<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import changelog from '../../CHANGELOG.md?raw';

/**
 * What changed, read straight from the changelog the repository keeps.
 *
 * The file is compiled into the bundle, so the notes cannot drift from the source the release was
 * cut from — and a nightly shows the same "Unreleased" section the maintainer wrote.
 */
defineProps<{ version: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const sections = computed(() => {
  const lines = changelog.split('\n');
  const out: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      current = { title: line.replace(/^##\s+/, '').trim(), body: [] };
      out.push(current);
    } else if (current && line.trim() && !line.startsWith('#')) {
      current.body.push(line.replace(/^\s*[-*]\s*/, '• ').trim());
    }
  }
  return out.slice(0, 3);
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="What's new">
      <header>
        <span>What's new · {{ version }}</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>
      <section v-for="section in sections" :key="section.title">
        <h3>{{ section.title }}</h3>
        <p v-for="(line, i) in section.body" :key="i">{{ line }}</p>
      </section>
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
  max-width: 480px;
  max-height: 80vh;
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
  padding: var(--sp-200) 0 var(--sp-300);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
h3 { margin: var(--sp-300) 0 var(--sp-200); color: var(--text); font-size: var(--fs-sm); }
p { margin: 0 0 var(--sp-200); color: var(--text-secondary); font-size: var(--fs-sm); line-height: 1.45; }
</style>
