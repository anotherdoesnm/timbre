<script setup lang="ts">
import Icon from './Icon.vue';

/**
 * How one server is allowed to interrupt: a level, and a mute.
 *
 * A per-channel mute or level still wins over this — that is the instance's own order, and saying
 * it here saves a person from wondering why a quiet channel got louder.
 */
const props = defineProps<{
  serverName: string;
  notify?: { muted: boolean; level: string };
  onNotify: (patch: { muted?: boolean; level?: string }) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const LEVELS: { value: string; label: string; hint: string }[] = [
  { value: 'all', label: 'Everything', hint: 'every message' },
  { value: 'mentions', label: 'Mentions', hint: 'only @you and replies' },
  { value: 'none', label: 'Nothing', hint: 'no notifications from this server' },
];
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Notifications">
      <header>
        <span>Notifications</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p class="lead">How <strong>{{ props.serverName }}</strong> may interrupt.</p>

      <button
        v-for="level in LEVELS"
        :key="level.value"
        class="level"
        :class="{ on: (props.notify?.level ?? 'mentions') === level.value }"
        @click="props.onNotify({ level: level.value })"
      >
        <span class="level-label">{{ level.label }}</span>
        <span class="level-hint">{{ level.hint }}</span>
      </button>

      <button
        class="toggle"
        :aria-pressed="props.notify?.muted ? 'true' : 'false'"
        @click="props.onNotify({ muted: !props.notify?.muted })"
      >
        <Icon :name="props.notify?.muted ? 'bell-off' : 'bell'" :size="14" />
        <span>{{ props.notify?.muted ? 'Muted — the badges still move' : 'Mute this server' }}</span>
      </button>
      <p class="fine">A per-channel mute always wins over this.</p>
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
.level {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin-bottom: var(--sp-200);
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
  text-align: left;
}
.level.on { background: var(--primary-container); color: var(--primary-on-container); }
.level-label { font-weight: 600; }
.level-hint { color: var(--text-tertiary); font-size: var(--fs-sm); }
.level.on .level-hint { color: inherit; opacity: 0.75; }
.toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
  text-align: left;
}
.fine { margin: var(--sp-200) 0 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
</style>
