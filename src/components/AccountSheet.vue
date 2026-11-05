<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{
  name: string;
  username?: string;
  instance: string;
  role?: 'admin' | 'mod' | null;
  avatarUrl?: string;
  busy?: boolean;
  error?: string;
  notifications?: 'unsupported' | 'default' | 'granted' | 'denied';
  dnd?: boolean;
  dndLabel?: string;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'signout'): void;
  (e: 'rename', name: string): void;
  (e: 'avatar', file: File): void;
  (e: 'enable-notifications'): void;
  (e: 'toggle-dnd'): void;
  (e: 'notification-settings'): void;
}>();

const draft = ref(props.name);
// The two things every bug report needs, printed from the build itself rather than remembered.
const version = __APP_VERSION__;
const sha = __BUILD_SHA__;
// A rename is a two-step thing on a phone (type, then save); the button stays dead until the
// text actually differs, so a stray tap cannot rewrite the name.
const dirty = computed(() => draft.value.trim() !== '' && draft.value.trim() !== props.name);
const fileInput = ref<HTMLInputElement | null>(null);

function pick(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('avatar', file);
  input.value = '';
}
</script>

<template>
  <!-- The account corner. On a phone it was hidden together with the rail, which left no way
       to see who you are signed in as — and no way to sign out at all. It is also the only
       place a profile can be changed: the instance ships no settings screen of its own. -->
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Account">
      <header>
        <span>Account</span>
        <button class="close" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="18" />
        </button>
      </header>

      <div class="who">
        <button
          class="avatar"
          :style="avatarUrl ? undefined : { background: 'var(--primary-main)' }"
          :disabled="busy"
          aria-label="Change avatar"
          @click="fileInput?.click()"
        >
          <img v-if="avatarUrl" :src="avatarUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ name.slice(0, 1).toUpperCase() }}</template>
          <span class="pencil" aria-hidden="true">✎</span>
        </button>
        <span class="text">
          <span class="name">{{ name }}</span>
          <span class="meta">
            <template v-if="username">@{{ username }} · </template>{{ instance }}<template v-if="role"> · {{ role }}</template>
          </span>
        </span>
        <input ref="fileInput" class="file" type="file" accept="image/*" @change="pick" />
      </div>

      <label class="field">
        <span class="label">Display name</span>
        <input
          v-model="draft"
          class="input"
          type="text"
          maxlength="40"
          autocomplete="off"
          :disabled="busy"
          @keyup.enter="dirty && emit('rename', draft)"
        />
      </label>
      <div class="actions">
        <button class="save" :disabled="!dirty || busy" @click="emit('rename', draft)">
          {{ busy ? 'Saving…' : 'Save' }}
        </button>
        <span v-if="error" class="error">{{ error }}</span>
      </div>

      <button
        v-if="notifications !== 'granted'"
        class="row"
        :disabled="notifications === 'unsupported' || notifications === 'denied' || busy"
        @click="emit('enable-notifications')"
      >
        <Icon name="bell" :size="16" />
        <span>
          {{ notifications === 'unsupported'
            ? 'Notifications are not available here'
            : notifications === 'denied'
              ? 'Notifications blocked in the browser settings'
              : 'Turn on notifications' }}
        </span>
      </button>
      <p v-else class="hint">Notifications are on while the app is open.</p>

      <!-- Do-not-disturb is an instance setting; this switch is how it gets flipped without the
           official client, and the line under it says when the quiet window runs. -->
      <button class="row" :disabled="busy" :aria-pressed="dnd ? 'true' : 'false'" @click="emit('toggle-dnd')">
        <Icon :name="dnd ? 'bell-off' : 'bell'" :size="16" />
        <span>
          {{ dnd ? 'Do not disturb is on' : 'Do not disturb' }}
          <span v-if="dnd && dndLabel" class="hint-inline">— {{ dndLabel }}</span>
        </span>
      </button>

      <button class="row" :disabled="busy" @click="emit('notification-settings')">
        <Icon name="inbox" :size="16" />
        <span>Notification settings<span class="hint-inline"> — which events interrupt</span></span>
      </button>

      <p class="build">Timbre {{ version }} · {{ sha }}</p>

      <button class="row danger" :disabled="busy" @click="emit('signout')">
        <Icon name="close" :size="16" />
        <span>Sign out</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 420px;
  max-height: 70vh;
  overflow-y: auto;
  /* Sheets are fixed to the viewport, so the parent's nav-bar padding does not apply: the
     last row would sit under the Android navigation bar without this. */
  padding: var(--sp-200) var(--sp-200) calc(var(--sp-500) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
  animation: sheet-up 160ms ease-out;
}
@keyframes sheet-up { from { transform: translateY(12px); opacity: 0.6; } to { transform: none; opacity: 1; } }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300) var(--sp-300);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.close { padding: var(--sp-100); color: var(--text-tertiary); }
.who {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) var(--sp-300) var(--sp-300);
}
.avatar {
  position: relative;
  width: 48px;
  height: 48px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  color: var(--primary-on);
  font-weight: 700;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* A button that looks like a picture needs one hint that it is a control. */
.pencil {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: var(--sf-container);
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1;
}
.file { display: none; }
.text { display: flex; flex-direction: column; min-width: 0; }
.name { font-weight: 600; }
.meta { color: var(--text-tertiary); font-size: var(--fs-sm); overflow-wrap: anywhere; }
.field { display: flex; flex-direction: column; gap: var(--sp-100); padding: var(--sp-200) var(--sp-300) 0; }
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
.input:focus { outline: 2px solid var(--primary-main); outline-offset: -1px; }
.actions { display: flex; align-items: center; gap: var(--sp-200); padding: var(--sp-200) var(--sp-300); }
.save {
  padding: var(--sp-200) var(--sp-400);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.save:disabled { opacity: 0.45; }
.error { color: var(--critical); font-size: var(--fs-sm); overflow-wrap: anywhere; }
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  text-align: left;
}
.row:active { background: var(--sfv-container); }
.row.danger { color: var(--critical); }
.hint-inline { color: var(--text-tertiary); font-size: var(--fs-sm); }
.build { margin: var(--sp-300) 0 var(--sp-100); color: var(--text-tertiary); font-size: var(--fs-xs); }
.hint { margin: 0; padding: var(--sp-100) var(--sp-300) var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-sm); }
</style>
