<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';

/**
 * One field, one button. Category names, channel renames, channel topics — nothing here needs a
 * sheet of its own, and five near-identical sheets is how a client grows.
 */
const props = defineProps<{
  title: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  submitLabel?: string;
  busy?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  (e: 'submit', value: string): void;
  (e: 'close'): void;
}>();

const value = ref(props.initial ?? '');

function submit(): void {
  const trimmed = value.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed);
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" :aria-label="props.title">
      <header>
        <span>{{ props.title }}</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="props.error" class="error">{{ props.error }}</p>

      <label v-if="props.label" class="field">
        <span class="label">{{ props.label }}</span>
        <input
          v-model="value"
          class="input"
          :placeholder="props.placeholder"
          maxlength="60"
          autofocus
          @keyup.enter="submit"
        />
      </label>
      <input v-else v-model="value" class="input" :placeholder="props.placeholder" maxlength="60" autofocus @keyup.enter="submit" />

      <button class="primary" :disabled="props.busy || !value.trim()" @click="submit">
        {{ props.busy ? 'Working…' : (props.submitLabel ?? 'Save') }}
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
.field { display: flex; flex-direction: column; gap: var(--sp-100); margin-bottom: var(--sp-300); }
.label { color: var(--text-tertiary); font-size: var(--fs-sm); }
.input {
  width: 100%;
  margin-bottom: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
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
.error { margin: 0 0 var(--sp-300); color: var(--critical); font-size: var(--fs-sm); }
</style>
