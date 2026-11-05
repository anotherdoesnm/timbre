<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';

/**
 * Writing a poll: a question, two to ten answers, whether more than one may be picked, and how
 * long it stays open. The instance posts the message itself, so this dialog only collects.
 */
const emit = defineEmits<{
  (e: 'create', poll: { question: string; options: string[]; allowMultiple: boolean; durationHours: number }): void;
  (e: 'close'): void;
}>();

const question = ref('');
const options = ref<string[]>(['', '']);
const allowMultiple = ref(false);
const durationHours = ref(24);

const filled = computed(() => options.value.map((o) => o.trim()).filter(Boolean));
const valid = computed(() => question.value.trim().length > 0 && filled.value.length >= 2);

function addOption(): void {
  if (options.value.length < 10) options.value.push('');
}
function removeOption(index: number): void {
  if (options.value.length > 2) options.value.splice(index, 1);
}
function create(): void {
  if (!valid.value) return;
  emit('create', {
    question: question.value.trim(),
    options: filled.value,
    allowMultiple: allowMultiple.value,
    durationHours: durationHours.value,
  });
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="New poll">
      <header>
        <span>New poll</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <label class="field">
        <span class="label">Question</span>
        <input v-model="question" class="input" type="text" maxlength="200" placeholder="Ask something" />
      </label>

      <div class="field">
        <span class="label">Answers</span>
        <div v-for="(_, i) in options" :key="i" class="option">
          <input v-model="options[i]" class="input" type="text" maxlength="100" :placeholder="`Answer ${i + 1}`" />
          <button v-if="options.length > 2" class="drop" :aria-label="`Remove answer ${i + 1}`" @click="removeOption(i)">
            <Icon name="close" :size="14" />
          </button>
        </div>
        <button v-if="options.length < 10" class="ghost" @click="addOption">
          <Icon name="plus" :size="14" /> Add an answer
        </button>
      </div>

      <div class="row">
        <button class="toggle" :aria-pressed="allowMultiple ? 'true' : 'false'" @click="allowMultiple = !allowMultiple">
          <Icon :name="allowMultiple ? 'check' : 'plus'" :size="14" />
          <span>More than one answer</span>
        </button>
        <label class="duration">
          <span class="label">Open for</span>
          <select v-model.number="durationHours" class="select">
            <option :value="1">1 hour</option>
            <option :value="24">1 day</option>
            <option :value="72">3 days</option>
            <option :value="168">1 week</option>
          </select>
        </label>
      </div>

      <button class="primary" :disabled="!valid" @click="create">Post poll</button>
      <p v-if="!valid" class="hint">A question and at least two answers.</p>
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
.field { display: flex; flex-direction: column; gap: var(--sp-100); margin-bottom: var(--sp-300); }
.label { font-size: var(--fs-sm); color: var(--text-tertiary); }
.input {
  width: 100%;
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.option { display: flex; align-items: center; gap: var(--sp-200); margin-bottom: var(--sp-200); }
.drop { color: var(--text-tertiary); padding: var(--sp-100); }
.ghost { display: flex; align-items: center; gap: var(--sp-100); color: var(--primary-main); font-size: var(--fs-sm); }
.row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-300); margin-bottom: var(--sp-300); }
.toggle { display: flex; align-items: center; gap: var(--sp-200); color: var(--text-secondary); font-size: var(--fs-sm); }
.duration { display: flex; align-items: center; gap: var(--sp-200); }
.select {
  padding: var(--sp-100) var(--sp-200);
  border: 1px solid var(--outline);
  border-radius: var(--radius-md);
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
.primary:disabled { opacity: 0.45; }
.hint { margin: var(--sp-200) 0 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
</style>
