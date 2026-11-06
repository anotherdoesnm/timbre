<script setup lang="ts">
import Icon from './Icon.vue';
import type { Server } from '../data/mock';

defineProps<{ servers: Server[]; activeId: string }>();
const emit = defineEmits<{ (e: 'select', id: string): void }>();
</script>

<template>
  <nav class="rail">
    <button class="rail-btn home" title="Direct messages">
      <Icon name="inbox" :size="20" />
    </button>
    <div class="sep" />
    <button
      v-for="s in servers"
      :key="s.id"
      class="rail-btn server"
      :class="{ active: s.id === activeId }"
      :title="s.name"
      :style="{ background: s.id === activeId ? s.color : 'var(--sfv-container)', color: 'var(--text)' }"
      @click="emit('select', s.id)"
    >
      <img v-if="s.iconUrl" class="rail-icon" :src="s.iconUrl" alt="" referrerpolicy="no-referrer" />
      <span v-else class="short">{{ s.short }}</span>
      <span v-if="s.unread" class="dot" />
    </button>
    <div class="sep" />
    <button class="rail-btn add" title="Add a server">
      <Icon name="plus" :size="18" />
    </button>
  </nav>
</template>

<style scoped>
.rail {
  width: var(--rail-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-200);
  padding: var(--sp-300) 0;
  background: var(--bg-container);
  border-right: 1px solid var(--bg-line);
}
.rail-btn {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text-secondary);
  transition: border-radius 120ms ease, background 120ms ease, color 120ms ease;
}
.rail-icon { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
.rail-btn:hover { border-radius: var(--radius-md); background: var(--sfv-hover); color: var(--text); }
.rail-btn.active { border-radius: var(--radius-md); color: var(--text); }
.rail-btn.active::before {
  content: '';
  position: absolute;
  left: -11px;
  top: 50%;
  translate: 0 -50%;
  width: 3px;
  height: 24px;
  border-radius: var(--radius-round);
  background: var(--primary-main);
}
.short { font-size: var(--fs-sm); font-weight: 600; letter-spacing: 0.02em; }
.home { color: var(--text); background: var(--sfv-container); }
.add { color: var(--success); background: transparent; }
.dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-round);
  background: var(--secondary-main);
  border: 2px solid var(--bg-container);
}
.sep { width: 28px; height: 1px; background: var(--bg-line); margin: var(--sp-100) 0; }
</style>
