<script setup lang="ts">
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';

defineProps<{ channel: Channel; membersOpen: boolean }>();
const emit = defineEmits<{ (e: 'toggle-members'): void }>();
</script>

<template>
  <header class="head">
    <div class="left">
      <Icon :name="channel.kind === 'voice' ? 'volume' : 'hash'" :size="20" />
      <span class="name">{{ channel.name }}</span>
      <Icon v-if="channel.encrypted" name="lock" :size="14" class="lock" />
      <span class="topic">Обсуждение клиента и всякое разное</span>
    </div>
    <div class="right">
      <button class="action" title="Поиск"><Icon name="search" :size="18" /></button>
      <button class="action" title="Уведомления"><Icon name="bell" :size="18" /></button>
      <button class="action" :class="{ on: membersOpen }" title="Участники" @click="emit('toggle-members')">
        <Icon name="users" :size="18" />
      </button>
      <button class="action" title="Ещё"><Icon name="dots" :size="18" /></button>
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
