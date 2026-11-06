<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { parseInviteCode, previewInvite, redeemInvite, type InvitePreview } from '../services/data';
import type { Session } from '../services/auth';

/**
 * Joining a server by invite.
 *
 * Two steps on purpose: the code is looked up first, so the person sees which server a link leads
 * to (and whether they are already in it) before anything is redeemed. The join itself is one
 * transaction on the instance — `redeem_invite` checks the invite, counts the use and adds the
 * membership together.
 */
const props = defineProps<{ session: Session | null; initial?: string; onJoined?: (serverId: string) => void }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const input = ref(props.initial ?? '');
const preview = ref<InvitePreview | null>(null);
const error = ref('');
const busy = ref(false);

const code = computed(() => parseInviteCode(input.value));

async function look(): Promise<void> {
  const s = props.session;
  const codeValue = code.value;
  error.value = '';
  preview.value = null;
  if (!s) {
    error.value = 'Sign in first';
    return;
  }
  if (!codeValue) {
    error.value = 'Paste an invite link or code — for example https://har.mony.lol/invite/QBXVAGXE';
    return;
  }
  busy.value = true;
  try {
    const found = await previewInvite(s, codeValue);
    if (!found || found.status === 'not_found') {
      error.value = 'No such invite — check the link';
    } else if (found.status !== 'valid' && !found.isMember) {
      error.value = `This invite is ${found.status.replace(/_/g, ' ')}`;
    } else {
      preview.value = found;
    }
  } finally {
    busy.value = false;
  }
}

async function join(): Promise<void> {
  const s = props.session;
  const codeValue = preview.value?.code ?? code.value;
  if (!s || !codeValue) return;
  busy.value = true;
  error.value = '';
  try {
    const serverId = await redeemInvite(s, codeValue);
    props.onJoined?.(serverId);
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Join a server">
      <header>
        <span>{{ preview?.isMember ? 'Already a member' : 'Join a server' }}</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p class="hint">
        An invite link from any Harmony instance, or just its code.
      </p>
      <form class="field" @submit.prevent="look">
        <input
          v-model="input"
          class="input"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://har.mony.lol/invite/QBXVAGXE"
          @input="preview = null; error = ''"
        />
        <button class="check" type="submit" :disabled="busy || !code">Check</button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="preview" class="card">
        <span class="icon" :style="preview.icon ? undefined : { background: 'var(--primary-main)' }">
          <img v-if="preview.icon" :src="preview.icon" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ (preview.name ?? '?').slice(0, 1).toUpperCase() }}</template>
        </span>
        <span class="body">
          <span class="name">{{ preview.name ?? 'Server' }}</span>
          <span v-if="preview.description" class="description">{{ preview.description }}</span>
        </span>
      </div>

      <button v-if="preview" class="primary" :disabled="busy" @click="join">
        {{ busy ? 'Joining…' : preview.isMember ? 'Open it' : 'Join' }}
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
  padding: var(--sp-200) 0 var(--sp-200);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { color: var(--text-tertiary); }
.hint { margin: 0 0 var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-sm); }
.field { display: flex; gap: var(--sp-200); margin-bottom: var(--sp-300); }
.input {
  flex: 1;
  min-width: 0;
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.check {
  padding: var(--sp-200) var(--sp-400);
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text);
  font-weight: 600;
}
.check:disabled { opacity: 0.5; }
.error { margin: 0 0 var(--sp-300); color: var(--critical); font-size: var(--fs-sm); }
.card {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-300);
  margin-bottom: var(--sp-300);
  border: 1px solid var(--sf-line);
  border-radius: var(--radius-lg);
  background: var(--sf-container);
}
.icon {
  width: 44px;
  height: 44px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  color: var(--primary-on);
  font-weight: 700;
  overflow: hidden;
}
.icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.name { color: var(--text); font-weight: 600; }
.description { color: var(--text-tertiary); font-size: var(--fs-xs); overflow: hidden; text-overflow: ellipsis; }
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:disabled { opacity: 0.6; }
</style>
