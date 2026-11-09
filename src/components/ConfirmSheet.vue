<script setup lang="ts">
import Icon from './Icon.vue';

/** One question with a consequence: "delete this?" asks before it does. */
const props = defineProps<{
  title: string;
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
}>();
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'close'): void }>();
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" :aria-label="props.title">
      <header>
        <span>{{ props.title }}</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p class="text">{{ props.text }}</p>
      <p v-if="props.error" class="error">{{ props.error }}</p>

      <button class="primary" :class="{ danger: props.danger }" :disabled="props.busy" @click="emit('confirm')">
        {{ props.busy ? 'Working…' : (props.confirmLabel ?? 'Confirm') }}
      </button>
      <button class="ghost-wide" @click="emit('close')">Cancel</button>
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
.text { margin: 0 0 var(--sp-300); color: var(--text-secondary); }
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary.danger { background: var(--critical); color: var(--critical-on, #fff); }
.primary:disabled { opacity: 0.5; }
.ghost-wide {
  width: 100%;
  margin-top: var(--sp-200);
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
}
.error { margin: 0 0 var(--sp-300); color: var(--critical); font-size: var(--fs-sm); }
</style>
