<script setup lang="ts">
import Icon from './Icon.vue';
import type { NotificationPrefs } from '../services/data';

/**
 * Which events are allowed to interrupt.
 *
 * The instance keeps a row of booleans per person — desktop per event type, sound per event type,
 * plus the quiet hours — and this screen is where they are actually visible. Before it, the client
 * only ever touched do-not-disturb and two push flags.
 */
const props = defineProps<{ prefs: NotificationPrefs | null; saving?: boolean; error?: string }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'change', field: string, value: boolean): void;
}>();

const EVENTS: { key: 'mentions' | 'replies' | 'dms' | 'reactions' | 'messages'; label: string; hint: string }[] = [
  { key: 'mentions', label: 'Mentions', hint: 'somebody writes @you' },
  { key: 'replies', label: 'Replies', hint: 'a reply to your message' },
  { key: 'dms', label: 'Direct messages', hint: 'a conversation, not a channel' },
  { key: 'reactions', label: 'Reactions', hint: 'somebody reacts to you' },
  { key: 'messages', label: 'Everything else', hint: 'any other message in a channel' },
];

function desktop(key: string): boolean {
  const d = props.prefs?.desktop as Record<string, boolean> | undefined;
  return d?.[key] !== false;
}
function sound(key: string): boolean {
  const s = props.prefs?.sound as Record<string, boolean> | undefined;
  return s?.[key] !== false;
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Notification settings">
      <header>
        <span>Notifications</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="!prefs" class="hint">No preferences on this instance yet.</p>
      <template v-else>
        <p v-if="error" class="hint error">{{ error }}</p>

        <div class="columns">
          <span />
          <span class="col">Notify</span>
          <span class="col">Sound</span>
        </div>
        <div v-for="event in EVENTS" :key="event.key" class="row">
          <span class="text">
            <span class="name">{{ event.label }}</span>
            <span class="hint">{{ event.hint }}</span>
          </span>
          <button
            class="switch"
            :aria-pressed="desktop(event.key) ? 'true' : 'false'"
            :disabled="saving"
            @click="emit('change', `desktop_${event.key === 'messages' ? 'chat_messages' : event.key}`, !desktop(event.key))"
          >
            <span class="knob" />
          </button>
          <button
            class="switch"
            :aria-pressed="sound(event.key) ? 'true' : 'false'"
            :disabled="saving"
            @click="emit('change', `sound_${event.key === 'messages' ? 'chat_messages' : event.key}`, !sound(event.key))"
          >
            <span class="knob" />
          </button>
        </div>

        <div class="row quiet">
          <span class="text">
            <span class="name">Do not disturb</span>
            <span class="hint">{{ prefs.dndStart ?? '22:00' }}–{{ prefs.dndEnd ?? '08:00' }}, nothing interrupts</span>
          </span>
          <button
            class="switch"
            :aria-pressed="prefs.dndEnabled ? 'true' : 'false'"
            :disabled="saving"
            @click="emit('change', 'dnd_enabled', !prefs.dndEnabled)"
          >
            <span class="knob" />
          </button>
        </div>
      </template>
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
.hint { margin: 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
.hint.error { color: var(--critical); margin-bottom: var(--sp-200); }
.columns, .row {
  display: grid;
  grid-template-columns: 1fr 56px 56px;
  align-items: center;
  gap: var(--sp-200);
}
.columns { padding: var(--sp-100) 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
.col { text-align: center; }
.row { padding: var(--sp-300) 0; border-top: 1px solid var(--sf-line); }
.text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.name { color: var(--text); }
.quiet .text { padding-right: var(--sp-200); }
.switch {
  width: 42px;
  height: 24px;
  border-radius: var(--radius-round);
  background: var(--outline);
  padding: 2px;
  justify-self: center;
  transition: background 120ms ease;
}
.switch[aria-pressed='true'] { background: var(--primary-main); }
.knob {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-round);
  background: var(--text);
  transform: translateX(0);
  transition: transform 120ms ease;
}
.switch[aria-pressed='true'] .knob { transform: translateX(18px); background: var(--primary-on); }
</style>
