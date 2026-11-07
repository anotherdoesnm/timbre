<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { Author } from '../data/mock';

/**
 * What a moderator can do to one person, and what anybody can do about them.
 *
 * Kick and ban are the instance's functions, which check the caller's permission *and* their rank
 * against the target's; the sheet does not try to predict either, it offers the action and shows the
 * refusal if it comes. Reporting is open to everyone, because that is how a guild with strangers in
 * it stays manageable.
 */
const props = defineProps<{
  person: Author;
  canKick: boolean;
  canBan: boolean;
  busy?: boolean;
  error?: string;
  onKick?: (userId: string, reason: string) => Promise<void>;
  onBan?: (userId: string, reason: string) => Promise<void>;
  onReport?: (userId: string, reason: string, comment: string) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const mode = ref<'menu' | 'kick' | 'ban' | 'report'>('menu');
const reason = ref('');
const comment = ref('');
const localError = ref('');

/** The words `create_report` accepts; anything else it treats as `other`. */
const REASONS = ['spam', 'harassment', 'impersonation', 'nsfw', 'illegal_content', 'other'];

async function run(): Promise<void> {
  const id = props.person.id;
  if (!id) return;
  localError.value = '';
  try {
    if (mode.value === 'kick') await props.onKick?.(id, reason.value);
    else if (mode.value === 'ban') await props.onBan?.(id, reason.value);
    else if (mode.value === 'report') await props.onReport?.(id, reason.value || 'other', comment.value);
    emit('close');
  } catch (e) {
    localError.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Member actions">
      <header>
        <span>{{ mode === 'menu' ? props.person.name : `${mode} ${props.person.name}` }}</span>
        <button class="close" aria-label="Close" @click="mode === 'menu' ? emit('close') : (mode = 'menu')">
          <Icon :name="mode === 'menu' ? 'close' : 'back'" :size="18" />
        </button>
      </header>

      <p v-if="localError || error" class="error">{{ localError || error }}</p>

      <template v-if="mode === 'menu'">
        <button v-if="canKick" class="row" @click="mode = 'kick'">
          <Icon name="back" :size="16" /><span>Kick from the server</span>
        </button>
        <button v-if="canBan" class="row danger" @click="mode = 'ban'">
          <Icon name="shield" :size="16" /><span>Ban from the server</span>
        </button>
        <button v-if="props.onReport" class="row" @click="mode = 'report'">
          <Icon name="bell" :size="16" /><span>Report to the moderators</span>
        </button>
        <p class="fine">
          Kick and ban are checked by the instance against your permissions and your role's rank;
          a report goes to the instance's moderators through `create_report`.
        </p>
      </template>

      <template v-else>
        <div class="reasons">
          <button
            v-for="r in REASONS"
            :key="r"
            class="chip"
            :class="{ on: reason === r }"
            @click="reason = r"
          >
            {{ r }}
          </button>
        </div>
        <label v-if="mode === 'report'" class="field">
          <span class="label">What happened (kept with the report)</span>
          <textarea v-model="comment" class="input" rows="3" maxlength="1000" />
        </label>
        <label v-else class="field">
          <span class="label">Reason (optional, shown to moderators)</span>
          <input v-model="reason" class="input" maxlength="200" :placeholder="reason" />
        </label>
        <button class="primary" :class="{ danger: mode !== 'report' }" :disabled="busy" @click="run">
          {{ busy ? 'Working…' : mode === 'report' ? 'Send report' : mode === 'kick' ? 'Kick' : 'Ban' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 47;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 460px;
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
  color: var(--text);
  font-weight: 600;
}
.close { color: var(--text-tertiary); }
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-300) 0;
  border-top: 1px solid var(--sf-line);
  color: var(--text);
  text-align: left;
}
.row.danger { color: var(--critical); }
.fine { margin: var(--sp-300) 0 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
.error { margin: 0 0 var(--sp-200); color: var(--critical); font-size: var(--fs-sm); }
.reasons { display: flex; flex-wrap: wrap; gap: var(--sp-100); margin-bottom: var(--sp-300); }
.chip { padding: 4px 8px; border-radius: var(--radius-md); background: var(--sf-base); color: var(--text-secondary); font-size: var(--fs-xs); }
.chip.on { background: var(--primary-container); color: var(--primary-on-container); font-weight: 600; }
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
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary.danger { background: var(--critical-container); color: var(--critical); }
.primary:disabled { opacity: 0.6; }
</style>
