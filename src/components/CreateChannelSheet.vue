<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';

/**
 * A new channel in the open server.
 *
 * The category is chosen here rather than guessed: the instance files a channel under whatever
 * `category` it was created with, and "which heading does it appear under" is not something a
 * person should discover after the fact.
 */
const props = defineProps<{
  serverName: string;
  categories: { id: string; name: string; kind: 'text' | 'voice' }[];
  busy?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  (e: 'create', name: string, type: 0 | 1, categoryId: string | null): void;
  (e: 'close'): void;
}>();

const name = ref('');
const kind = ref<'text' | 'voice'>('text');
const categoryId = ref<string>('');

const options = computed(() => props.categories.filter((c) => c.kind === kind.value));
const chosen = computed(() => {
  if (categoryId.value && options.value.some((c) => c.id === categoryId.value)) return categoryId.value;
  return options.value[0]?.id ?? '';
});

function submit(): void {
  const value = name.value.trim();
  if (!value) return;
  emit('create', value, kind.value === 'voice' ? 1 : 0, chosen.value || null);
  name.value = '';
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Create channel">
      <header>
        <span>Create channel</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p class="lead">In <strong>{{ props.serverName }}</strong></p>
      <p v-if="props.error" class="error">{{ props.error }}</p>

      <label class="field">
        <span class="label">Name</span>
        <input v-model="name" class="input" maxlength="40" placeholder="off-topic" @keyup.enter="submit" />
      </label>

      <div class="row">
        <button class="toggle" :aria-pressed="kind === 'text'" @click="kind = 'text'; categoryId = ''">
          <Icon name="hash" :size="14" /><span>Text</span>
        </button>
        <button class="toggle" :aria-pressed="kind === 'voice'" @click="kind = 'voice'; categoryId = ''">
          <Icon name="volume" :size="14" /><span>Voice</span>
        </button>
      </div>

      <label v-if="options.length" class="field">
        <span class="label">Category</span>
        <select v-model="categoryId" class="input">
          <option v-for="c in options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>

      <button class="primary" :disabled="props.busy || !name.trim()" @click="submit">
        {{ props.busy ? 'Creating…' : 'Create channel' }}
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
.lead { margin: 0 0 var(--sp-300); color: var(--text-secondary); }
.field { display: flex; flex-direction: column; gap: var(--sp-100); margin-bottom: var(--sp-300); }
.label { color: var(--text-tertiary); font-size: var(--fs-sm); }
.input {
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.row { display: flex; gap: var(--sp-200); margin-bottom: var(--sp-300); }
.toggle {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
}
.toggle[aria-pressed='true'] { background: var(--primary-container); color: var(--primary-on-container); }
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
