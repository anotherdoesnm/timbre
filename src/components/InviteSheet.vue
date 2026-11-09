<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';

/**
 * The invite for the open server: make one, copy it.
 *
 * `create_invite` is the instance's own rule — any member may make one — so the sheet says so and
 * shows a refusal in the instance's words rather than hiding the button.
 */
const props = defineProps<{ serverName: string; onCreate: () => Promise<string> }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const link = ref('');
const busy = ref(false);
const copied = ref(false);
const error = ref('');

async function make(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    link.value = await props.onCreate();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function copy(): Promise<void> {
  if (!link.value) return;
  try {
    await navigator.clipboard.writeText(link.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    error.value = 'The clipboard is not available here — select the link instead';
  }
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Invite">
      <header>
        <span>Invite</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p class="lead">An invite for <strong>{{ props.serverName }}</strong>.</p>
      <p v-if="error" class="error">{{ error }}</p>

      <button class="primary" :disabled="busy" @click="make">
        {{ busy ? 'Creating…' : link ? 'Create another' : 'Create invite link' }}
      </button>

      <div v-if="link" class="link">
        <code>{{ link }}</code>
        <button class="copy" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
      </div>
      <p class="fine">Anyone with the link can join, as long as the invite is not used up.</p>
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
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:disabled { opacity: 0.5; }
.link {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin-top: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
}
.link code { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: var(--fs-sm); }
.copy { padding: var(--sp-100) var(--sp-200); border-radius: var(--radius-sm); background: var(--sfv-container); color: var(--text); }
.fine { margin: var(--sp-200) 0 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
.error { margin: 0 0 var(--sp-300); color: var(--critical); font-size: var(--fs-sm); }
</style>
