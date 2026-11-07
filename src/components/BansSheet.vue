<script setup lang="ts">
import Icon from './Icon.vue';
import type { BanEntry } from '../services/data';

/**
 * Who is banned from this server, and the way back.
 *
 * `get_server_bans` requires BAN_MEMBERS itself (it answers `Missing BAN_MEMBERS permission`
 * otherwise), so the list is only ever opened from an entry point that already checked.
 */
defineProps<{ bans: BanEntry[]; loading?: boolean; error?: string; busyId?: string }>();
const emit = defineEmits<{
  (e: 'unban', userId: string): void;
  (e: 'close'): void;
}>();

function when(iso?: string): string {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? at.toLocaleDateString() : '';
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Bans">
      <header>
        <span>Banned</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !bans.length" class="hint">Loading…</p>
      <p v-else-if="!bans.length" class="hint">Nobody is banned here.</p>

      <div v-for="ban in bans" :key="ban.userId" class="row">
        <span class="body">
          <span class="name">{{ ban.name }}</span>
          <span class="meta">
            <template v-if="ban.reason">{{ ban.reason }}</template>
            <template v-if="ban.at"> · {{ when(ban.at) }}</template>
          </span>
        </span>
        <button class="action" :disabled="busyId === ban.userId" @click="emit('unban', ban.userId)">
          {{ busyId === ban.userId ? '…' : 'Unban' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 47;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 460px;
  max-height: 75vh;
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
.hint { margin: 0; padding: var(--sp-200) 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) 0;
  border-top: 1px solid var(--sf-line);
}
.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.name { color: var(--text); font-weight: 600; }
.meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.action {
  flex: none;
  padding: var(--sp-100) var(--sp-300);
  border-radius: var(--radius-md);
  background: var(--sfv-container);
  color: var(--text);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.action:disabled { opacity: 0.6; }
</style>
