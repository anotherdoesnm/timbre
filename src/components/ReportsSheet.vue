<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';
import type { ReportEntry } from '../services/data';

/**
 * The moderators' queue: what people reported, and what to do about it.
 *
 * `get_reports_with_details` answers for moderators; the actions are the instance's `moderate_report`
 * with its own vocabulary (`investigate`, `resolve`, `dismiss`), and the note is what the reporter is
 * told.
 */
defineProps<{ reports: ReportEntry[]; loading?: boolean; error?: string; busyId?: string }>();
const emit = defineEmits<{
  (e: 'act', reportId: string, action: 'investigate' | 'resolve' | 'dismiss', note?: string): void;
  (e: 'close'): void;
}>();

const noteFor = ref<string | null>(null);
const note = ref('');

function when(iso: string): string {
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? at.toLocaleDateString() : '';
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Reports">
      <header>
        <span>Reports</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !reports.length" class="hint">Loading…</p>
      <p v-else-if="!reports.length" class="hint">Nothing pending.</p>

      <div v-for="report in reports" :key="report.id" class="card">
        <div class="head">
          <span class="reason">{{ report.reason.replace(/_/g, ' ') }}</span>
          <span class="meta">{{ report.type }} · {{ report.reporter }} · {{ when(report.createdAt) }}</span>
        </div>
        <p class="target"><strong>{{ report.target }}</strong><template v-if="report.preview">: {{ report.preview }}</template></p>
        <p v-if="report.comment" class="comment">“{{ report.comment }}”</p>

        <input
          v-if="noteFor === report.id"
          v-model="note"
          class="note"
          maxlength="500"
          placeholder="Note sent to the reporter (optional)"
        />
        <div class="actions">
          <button :disabled="busyId === report.id" @click="noteFor = report.id; emit('act', report.id, 'investigate', note)">Investigate</button>
          <button :disabled="busyId === report.id" @click="noteFor = null; emit('act', report.id, 'resolve', note)">Resolve</button>
          <button class="ghost" :disabled="busyId === report.id" @click="noteFor = null; emit('act', report.id, 'dismiss', note)">Dismiss</button>
        </div>
      </div>
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
  padding: var(--sp-200) 0 var(--sp-200);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.hint { margin: 0; padding: var(--sp-200) 0; color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.card { padding: var(--sp-300) 0; border-top: 1px solid var(--sf-line); }
.head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-200); }
.reason { color: var(--text); font-weight: 600; text-transform: capitalize; }
.meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.target { margin: var(--sp-100) 0; color: var(--text-secondary); font-size: var(--fs-sm); overflow-wrap: anywhere; }
.comment { margin: 0 0 var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-sm); font-style: italic; }
.note {
  width: 100%;
  margin-bottom: var(--sp-200);
  padding: var(--sp-200);
  border: 1px solid var(--outline);
  border-radius: var(--radius-md);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.actions { display: flex; gap: var(--sp-200); }
.actions button {
  flex: 1;
  padding: var(--sp-200);
  border-radius: var(--radius-md);
  background: var(--sfv-container);
  color: var(--text);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.actions button.ghost { background: var(--sf-base); color: var(--text-tertiary); }
.actions button:disabled { opacity: 0.6; }
</style>
