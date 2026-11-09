<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';

/**
 * Editing a channel: what it is called, what it is for, and where it is listed.
 *
 * The instance keeps all three on the channel row (`name`, `description`, `category`), so a single
 * save covers rename, topic and moving it between headings. The old sheet offered only the name,
 * which made "Edit channel" a rename button wearing the wrong label.
 */
const props = defineProps<{
  channel: Channel;
  categories: { id: string; name: string; kind: 'text' | 'voice' }[];
  busy?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  (e: 'save', patch: { name: string; description: string | null; category: string | null }): void;
  (e: 'close'): void;
}>();

const name = ref(props.channel.name);
const topic = ref('');
const category = ref<string>(props.channel.categoryId ?? '');
const options = props.categories.filter((c) => c.kind === props.channel.kind);

function save(): void {
  const value = name.value.trim();
  if (!value) return;
  emit('save', {
    name: value,
    description: topic.value.trim() || null,
    category: category.value || null,
  });
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Edit channel">
      <header>
        <span>Edit channel</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="props.error" class="error">{{ props.error }}</p>

      <label class="field">
        <span class="label">Name</span>
        <input v-model="name" class="input" maxlength="40" @keyup.enter="save" />
      </label>

      <label class="field">
        <span class="label">Topic</span>
        <textarea
          v-model="topic"
          class="input area"
          rows="3"
          maxlength="300"
          placeholder="What is this channel for?"
        />
      </label>

      <label v-if="options.length" class="field">
        <span class="label">Category</span>
        <select v-model="category" class="input">
          <option value="">No category</option>
          <option v-for="c in options" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>

      <button class="primary" :disabled="props.busy || !name.trim()" @click="save">
        {{ props.busy ? 'Saving…' : 'Save' }}
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
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.area { resize: vertical; min-height: 72px; }
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
