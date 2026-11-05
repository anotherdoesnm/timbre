<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Message } from '../data/mock';

/**
 * A poll inside a message: the question, the answers with their bars, and one tap to vote.
 *
 * Counts and the caller's own votes come from the instance, never from local arithmetic — the same
 * poll is open in other clients, and a single-choice poll replaces the previous answer.
 */
const props = defineProps<{ poll: NonNullable<Message['poll']> }>();
const emit = defineEmits<{ (e: 'vote', pollId: string, optionIds: string[]): void }>();

const picked = ref<string[]>([...props.poll.myOptionIds]);
watch(
  () => props.poll.myOptionIds.join(','),
  () => (picked.value = [...props.poll.myOptionIds])
);

const total = computed(() => props.poll.options.reduce((sum, o) => sum + o.votes, 0));
const share = (votes: number): number => (total.value ? Math.round((votes / total.value) * 100) : 0);
const hasVoted = computed(() => props.poll.myOptionIds.length > 0);
const expired = computed(() => props.poll.closed || (!!props.poll.expiresAt && Date.parse(props.poll.expiresAt) <= Date.now()));

function toggle(optionId: string): void {
  if (expired.value) return;
  if (!props.poll.allowMultiple) {
    emit('vote', props.poll.id, [optionId]);
    return;
  }
  picked.value = picked.value.includes(optionId)
    ? picked.value.filter((id) => id !== optionId)
    : [...picked.value, optionId];
  emit('vote', props.poll.id, picked.value);
}

function until(): string {
  if (!props.poll.expiresAt) return '';
  const at = Date.parse(props.poll.expiresAt);
  if (!Number.isFinite(at)) return '';
  if (at <= Date.now()) return 'closed';
  const hours = Math.round((at - Date.now()) / 3600000);
  return hours >= 24 ? `${Math.round(hours / 24)}d left` : `${hours}h left`;
}
</script>

<template>
  <div class="poll" :class="{ closed: expired }">
    <p class="question">{{ poll.question }}</p>
    <button
      v-for="option in poll.options"
      :key="option.id"
      class="option"
      :class="{ mine: poll.myOptionIds.includes(option.id) }"
      :disabled="expired"
      @click.stop="toggle(option.id)"
    >
      <span class="bar" :style="{ width: `${share(option.votes)}%` }" />
      <span class="label">
        <span class="text">{{ option.text }}</span>
        <span class="votes">{{ option.votes }} · {{ share(option.votes) }}%</span>
      </span>
    </button>
    <p class="meta">
      {{ poll.totalVoters }} {{ poll.totalVoters === 1 ? 'voter' : 'voters' }}
      <template v-if="until()"> · {{ until() }}</template>
      <template v-if="poll.allowMultiple && !expired"> · multiple answers</template>
      <template v-else-if="!hasVoted && !expired"> · tap to vote</template>
    </p>
  </div>
</template>

<style scoped>
.poll {
  margin-top: var(--sp-200);
  padding: var(--sp-300);
  border: 1px solid var(--sf-line);
  border-radius: var(--radius-lg);
  background: var(--sf-container);
  max-width: 420px;
}
.question { margin: 0 0 var(--sp-300); color: var(--text); font-weight: 600; }
.option {
  position: relative;
  display: block;
  width: 100%;
  margin-bottom: var(--sp-200);
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--sf-line);
  border-radius: var(--radius-md);
  background: var(--sf-base);
  overflow: hidden;
  text-align: left;
}
.option:disabled { opacity: 0.85; }
/* The bar sits behind the label: a table of percentages is harder to read at a glance. */
.bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--primary-container);
  opacity: 0.55;
}
.label { position: relative; display: flex; justify-content: space-between; gap: var(--sp-200); }
.option.mine { border-color: var(--primary-main); }
.option.mine .text { font-weight: 600; color: var(--text); }
.text { color: var(--text-secondary); overflow-wrap: anywhere; }
.votes { color: var(--text-tertiary); font-size: var(--fs-xs); white-space: nowrap; }
.meta { margin: var(--sp-100) 0 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
</style>
