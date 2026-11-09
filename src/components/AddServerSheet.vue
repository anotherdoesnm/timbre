<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';

/**
 * Adding a server: make one, or join one somebody sent you a link to.
 *
 * Both are ways to get a new entry in the rail, which is why they share a sheet and why the sheet
 * hangs off the rail's "+" — the same place Discord and Cinny put it.
 */
const props = defineProps<{ busy?: boolean; error?: string }>();
const emit = defineEmits<{
  (e: 'create', name: string, isPublic: boolean): void;
  (e: 'join'): void;
  (e: 'close'): void;
}>();

const name = ref('');
const isPublic = ref(false);

function submit(): void {
  const value = name.value.trim();
  if (!value) return;
  emit('create', value, isPublic.value);
  name.value = '';
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Add a server">
      <header>
        <span>Add a server</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="props.error" class="error">{{ props.error }}</p>

      <label class="field">
        <span class="label">Name</span>
        <input v-model="name" class="input" maxlength="60" placeholder="My place" @keyup.enter="submit" />
      </label>
      <button class="toggle" :aria-pressed="isPublic ? 'true' : 'false'" @click="isPublic = !isPublic">
        <Icon :name="isPublic ? 'check' : 'plus'" :size="14" />
        <span>List it in public discovery</span>
      </button>
      <button class="primary" :disabled="props.busy || !name.trim()" @click="submit">
        {{ props.busy ? 'Creating…' : 'Create server' }}
      </button>
      <p class="fine">You become the owner; the instance adds #general and a voice channel.</p>

      <div class="split" />
      <button class="ghost-wide" @click="emit('join')">
        <Icon name="at" :size="15" /> Join with an invite
      </button>
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
.field { display: flex; flex-direction: column; gap: var(--sp-100); margin-bottom: var(--sp-200); }
.label { color: var(--text-tertiary); font-size: var(--fs-sm); }
.input {
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  width: 100%;
  margin-bottom: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
  text-align: left;
}
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:disabled { opacity: 0.5; }
.fine { margin: var(--sp-200) 0 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
.error { margin: 0 0 var(--sp-300); color: var(--critical); font-size: var(--fs-sm); }
.split { height: 1px; margin: var(--sp-300) 0; background: var(--bg-line); }
.ghost-wide {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-200);
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
}
</style>
