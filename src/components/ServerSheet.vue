<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { Server } from '../data/mock';

defineProps<{ servers: Server[]; activeId: string }>();
const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'close'): void;
  (e: 'join'): void;
  (e: 'discover'): void;
  (e: 'create'): void;
  (e: 'mark-read'): void;
}>();
const broken = ref<Record<string, true>>({});
</script>

<template>
  <!-- Phone-only server switcher. A strip of avatars along the top is a desktop idea squeezed
       onto a phone: it eats a row of the screen on every screen and scrolls sideways. The
       server name in the channel list opens this instead. -->
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Servers">
      <header>
        <span>Servers</span>
        <button class="close" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="18" />
        </button>
      </header>
      <button
        v-for="s in servers"
        :key="s.id"
        class="row"
        :class="{ active: s.id === activeId }"
        @click="emit('select', s.id)"
      >
        <span class="tile" :style="s.iconUrl && !broken[s.id] ? undefined : { background: s.color }">
          <img
            v-if="s.iconUrl && !broken[s.id]"
            :src="s.iconUrl"
            alt=""
            referrerpolicy="no-referrer"
            @error="broken[s.id] = true"
          />
          <template v-else>{{ s.short }}</template>
        </span>
        <span class="name">{{ s.name }}</span>
        <Icon v-if="s.id === activeId" name="check" :size="16" class="tick" />
        <span v-if="s.unread" class="dot" />
      </button>
      <button class="row add" @click="emit('join')">
        <span class="tile add-tile"><Icon name="plus" :size="16" /></span>
        <span class="name">Join with an invite</span>
      </button>
      <button class="row" @click="emit('mark-read')">
        <span class="tile add-tile"><Icon name="check" :size="16" /></span>
        <span class="name">Mark this server read</span>
      </button>
      <button class="row add" @click="emit('discover')">
        <span class="tile add-tile"><Icon name="search" :size="16" /></span>
        <span class="name">Discover public servers</span>
      </button>
      <!-- Making a place, or joining one. Settings for the current server live in the server menu
           (tap its name above the channel list), where the thing they govern already is. -->
      <button class="row add" @click="emit('create')">
        <span class="tile add-tile"><Icon name="plus" :size="16" /></span>
        <span class="name">Add a server</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 420px;
  /* A long server list must scroll inside the sheet, not run off the screen. */
  max-height: 70vh;
  overflow-y: auto;
  /* Sheets are fixed to the viewport, so the parent's nav-bar padding does not apply: the
     last row would sit under the Android navigation bar without this. */
  padding: var(--sp-200) var(--sp-200) calc(var(--sp-500) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
  animation: sheet-up 160ms ease-out;
}
@keyframes sheet-up { from { transform: translateY(12px); opacity: 0.6; } to { transform: none; opacity: 1; } }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300) var(--sp-300);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { padding: var(--sp-100); color: var(--text-tertiary); }
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  text-align: left;
}
.row:active { background: var(--sfv-container); }
.row.active { background: var(--sfv-container); }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  color: var(--text);
  font-weight: 600;
  font-size: var(--fs-sm);
}
.add-tile { background: var(--bg-hover); color: var(--text-tertiary); }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tick { color: var(--text-secondary); }
.dot { width: 8px; height: 8px; border-radius: var(--radius-round); background: var(--secondary-main); }
.row.add { color: var(--text-tertiary); }
</style>
