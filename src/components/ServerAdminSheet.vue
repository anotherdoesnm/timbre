<script setup lang="ts">
import Icon from './Icon.vue';

/**
 * Settings for the server you are looking at.
 *
 * This sheet answers "how is this place governed": roles, bans, reports. It deliberately does not
 * create anything — a channel is made from the server menu, a server from the rail's "+", an
 * invite from the menu too — because a settings screen that also builds things is where the old
 * "everything lives behind Create a server" came from.
 */
const props = defineProps<{
  serverName: string;
  onRoles?: () => void;
  onBans?: () => void;
  onReports?: () => void;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Server settings">
      <header>
        <span>Server settings</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p class="lead"><strong>{{ props.serverName }}</strong></p>

      <button class="row" @click="props.onRoles?.()">
        <Icon name="shield" :size="16" />
        <span class="row-text">
          <span class="row-title">Roles and permissions</span>
          <span class="row-hint">who may do what across the server</span>
        </span>
        <Icon name="chevron" :size="14" />
      </button>
      <button v-if="props.onBans" class="row" @click="props.onBans?.()">
        <Icon name="bell-off" :size="16" />
        <span class="row-text">
          <span class="row-title">Banned members</span>
          <span class="row-hint">who was removed, and why</span>
        </span>
        <Icon name="chevron" :size="14" />
      </button>
      <button v-if="props.onReports" class="row" @click="props.onReports?.()">
        <Icon name="inbox" :size="16" />
        <span class="row-text">
          <span class="row-title">Reports</span>
          <span class="row-hint">the moderation queue</span>
        </span>
        <Icon name="chevron" :size="14" />
      </button>

      <p class="fine">
        Channels and invites are in the server menu — tap the server's name. Permissions for one
        channel live behind the "…" in its header.
      </p>
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
  max-width: 460px;
  padding: var(--sp-200) var(--sp-300) calc(var(--sp-500) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) 0;
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.lead { margin: 0 0 var(--sp-300); color: var(--text-secondary); }
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  width: 100%;
  margin-bottom: var(--sp-200);
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
  text-align: left;
}
.row-text { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 2px; }
.row-title { font-weight: 600; }
.row-hint { color: var(--text-tertiary); font-size: var(--fs-sm); }
.fine { margin: var(--sp-300) 0 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
</style>
