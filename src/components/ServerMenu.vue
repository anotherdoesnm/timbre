<script setup lang="ts">
import Icon from './Icon.vue';

/**
 * The menu behind the server's name.
 *
 * Upstream (and Discord, and Cinny) put the actions that belong to *this* server here — settings,
 * creating things in it, its invite, its notifications. The old arrangement had one sheet called
 * "Create a server" holding all of it, which meant "how do I manage this place" was answered by a
 * button about making a different one. Creating a server is not a property of a server: it lives on
 * the rail's "+", where the list of servers is.
 */
const props = defineProps<{ serverName: string; canManage: boolean; live?: boolean }>();
const emit = defineEmits<{
  (e: 'settings'): void;
  (e: 'create-channel'): void;
  (e: 'create-category'): void;
  (e: 'invite'): void;
  (e: 'notifications'): void;
  (e: 'mark-read'): void;
  (e: 'switch-server'): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <div class="menu-backdrop" @click="emit('close')" />
  <nav class="menu" role="menu" :aria-label="`${serverName} menu`">
    <button v-if="canManage" role="menuitem" @click="emit('settings')">
      <Icon name="shield" :size="15" /> Server settings
    </button>
    <button v-if="canManage" role="menuitem" @click="emit('create-channel')">
      <Icon name="plus" :size="15" /> Create channel
    </button>
    <button v-if="canManage" role="menuitem" @click="emit('create-category')">
      <Icon name="hash" :size="15" /> Create category
    </button>
    <button role="menuitem" @click="emit('invite')">
      <Icon name="at" :size="15" /> Get invite link
    </button>
    <button role="menuitem" @click="emit('notifications')">
      <Icon name="bell" :size="15" /> Notification settings
    </button>
    <button v-if="live" role="menuitem" @click="emit('mark-read')">
      <Icon name="check" :size="15" /> Mark as read
    </button>
    <button role="menuitem" @click="emit('switch-server')">
      <Icon name="chevron" :size="15" /> Switch server
    </button>
  </nav>
</template>

<style scoped>
.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 44;
}
.menu {
  position: absolute;
  z-index: 45;
  top: calc(var(--sp-300) + 34px);
  left: var(--sp-200);
  right: var(--sp-200);
  display: flex;
  flex-direction: column;
  padding: var(--sp-100);
  border: 1px solid var(--bg-line);
  border-radius: var(--radius-lg);
  background: var(--sf-container);
  box-shadow: var(--shadow-3);
}
.menu button {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-300);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: var(--fs-md);
  text-align: left;
}
.menu button:hover { background: var(--sfv-container); }
</style>
