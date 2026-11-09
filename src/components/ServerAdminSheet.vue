<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import type { Channel, Server } from '../data/mock';

/**
 * Making a place: a new server, a new channel in the one you own, and an invite link for it.
 *
 * Everything here is the instance's own rule — `servers` may only be created with yourself as the
 * owner, `channels` only by the owner, `invites` by any member — so a refusal is shown as the
 * instance worded it rather than guessed at in advance.
 */
const props = defineProps<{
  servers: Server[];
  activeId: string;
  channels: Channel[];
  /** `https://<instance>` — invite links are built from it. */
  instanceUrl: string;
  busy?: boolean;
  error?: string;
  /** The server's current defaults, if it has any. */
  notify?: { muted: boolean; level: string };
  onJoinServer?: (name: string, isPublic: boolean) => Promise<void>;
  onJoinChannel?: (name: string, type: 0 | 1) => Promise<void>;
  onCreateInvite?: () => Promise<string>;
  onNotify?: (patch: { muted?: boolean; level?: string }) => Promise<void>;
  onRoles?: () => void;
  onBans?: () => void;
  onReports?: () => void;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const tab = ref<'server' | 'channel' | 'invite' | 'alerts'>('server');
const LEVELS: { value: string; label: string; hint: string }[] = [
  { value: 'all', label: 'Everything', hint: 'every message' },
  { value: 'mentions', label: 'Mentions', hint: 'only @you and replies' },
  { value: 'none', label: 'Nothing', hint: 'no notifications from this server' },
];
const serverName = ref('');
const serverPublic = ref(false);
const channelName = ref('');
const channelKind = ref<'text' | 'voice'>('text');
const inviteCode = ref('');
const copied = ref(false);
const localBusy = ref(false);
const localError = ref('');

const activeServer = computed(() => props.servers.find((s) => s.id === props.activeId));
const textChannels = computed(() => props.channels.filter((c) => c.kind === 'text'));

async function submitServer(): Promise<void> {
  if (!serverName.value.trim() || !props.onJoinServer) return;
  localBusy.value = true;
  localError.value = '';
  try {
    await props.onJoinServer(serverName.value.trim(), serverPublic.value);
    serverName.value = '';
  } catch (e) {
    localError.value = e instanceof Error ? e.message : String(e);
  } finally {
    localBusy.value = false;
  }
}

async function submitChannel(): Promise<void> {
  if (!channelName.value.trim() || !props.onJoinChannel) return;
  localBusy.value = true;
  localError.value = '';
  try {
    await props.onJoinChannel(channelName.value.trim(), channelKind.value === 'voice' ? 1 : 0);
    channelName.value = '';
  } catch (e) {
    localError.value = e instanceof Error ? e.message : String(e);
  } finally {
    localBusy.value = false;
  }
}

async function makeInvite(): Promise<void> {
  if (!props.onCreateInvite) return;
  localBusy.value = true;
  localError.value = '';
  try {
    inviteCode.value = await props.onCreateInvite();
  } catch (e) {
    localError.value = e instanceof Error ? e.message : String(e);
  } finally {
    localBusy.value = false;
  }
}

const inviteLink = computed(() =>
  inviteCode.value ? `${props.instanceUrl.replace(/\/$/, '')}/invite/${inviteCode.value}` : ''
);

async function copy(): Promise<void> {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    localError.value = 'Could not copy — select the link and copy it by hand';
  }
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Server settings">
      <header>
        <span>Server settings</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <nav class="tabs">
        <button :class="{ on: tab === 'server' }" @click="tab = 'server'">This server</button>
        <button :class="{ on: tab === 'channel' }" @click="tab = 'channel'">New channel</button>
        <button :class="{ on: tab === 'invite' }" @click="tab = 'invite'">Invite</button>
        <button :class="{ on: tab === 'alerts' }" @click="tab = 'alerts'">Alerts</button>
      </nav>

      <p v-if="localError || error" class="error">{{ localError || error }}</p>

      <template v-if="tab === 'server'">
        <!-- Management first: this is the tab the sheet opens on, and roles, bans and the report
             queue are what somebody came here for. They used to sit at the bottom of Alerts. -->
        <template v-if="props.onRoles || props.onBans || props.onReports">
          <p class="lead">Manage <strong>{{ activeServer?.name ?? 'this server' }}</strong></p>
          <button v-if="props.onRoles" class="ghost-wide" @click="props.onRoles?.()">
            <Icon name="shield" :size="14" /> Roles and permissions
          </button>
          <button v-if="props.onBans" class="ghost-wide" @click="props.onBans?.()">
            <Icon name="bell-off" :size="14" /> Banned members
          </button>
          <button v-if="props.onReports" class="ghost-wide" @click="props.onReports?.()">
            <Icon name="inbox" :size="14" /> Reports
          </button>
          <p class="fine">Permissions for one channel live behind the "…" in that channel's header.</p>
        </template>

        <p class="lead">Create a server</p>
        <label class="field">
          <span class="label">Name</span>
          <input v-model="serverName" class="input" maxlength="60" placeholder="My place" />
        </label>
        <button class="toggle" :aria-pressed="serverPublic ? 'true' : 'false'" @click="serverPublic = !serverPublic">
          <Icon :name="serverPublic ? 'check' : 'plus'" :size="14" />
          <span>List it in public discovery</span>
        </button>
        <button class="primary" :disabled="localBusy || !serverName.trim()" @click="submitServer">
          {{ localBusy ? 'Creating…' : 'Create server' }}
        </button>
        <p class="fine">You become the owner; the instance adds #general and a voice channel.</p>
      </template>

      <template v-else-if="tab === 'channel'">
        <p class="lead">In <strong>{{ activeServer?.name ?? 'this server' }}</strong></p>
        <label class="field">
          <span class="label">Name</span>
          <input v-model="channelName" class="input" maxlength="40" placeholder="off-topic" />
        </label>
        <div class="row">
          <button class="toggle" :aria-pressed="channelKind === 'text' ? 'true' : 'false'" @click="channelKind = 'text'">
            <Icon name="hash" :size="14" /><span>Text</span>
          </button>
          <button class="toggle" :aria-pressed="channelKind === 'voice' ? 'true' : 'false'" @click="channelKind = 'voice'">
            <Icon name="mic" :size="14" /><span>Voice</span>
          </button>
        </div>
        <button class="primary" :disabled="localBusy || !channelName.trim()" @click="submitChannel">
          {{ localBusy ? 'Creating…' : 'Create channel' }}
        </button>
        <p class="fine">
          Only a server's owner may add channels — that is the instance's rule, not this sheet's.
          {{ textChannels.length }} text {{ textChannels.length === 1 ? 'channel' : 'channels' }} here.
        </p>
      </template>

      <template v-else-if="tab === 'alerts'">
        <p class="lead">How <strong>{{ activeServer?.name ?? 'this server' }}</strong> may interrupt.</p>
        <button
          v-for="level in LEVELS"
          :key="level.value"
          class="level"
          :class="{ on: (props.notify?.level ?? 'mentions') === level.value }"
          @click="props.onNotify?.({ level: level.value })"
        >
          <span class="level-label">{{ level.label }}</span>
          <span class="level-hint">{{ level.hint }}</span>
        </button>
        <button class="toggle" :aria-pressed="props.notify?.muted ? 'true' : 'false'" @click="props.onNotify?.({ muted: !props.notify?.muted })">
          <Icon :name="props.notify?.muted ? 'bell-off' : 'bell'" :size="14" />
          <span>{{ props.notify?.muted ? 'Muted — the badges still move' : 'Mute this server' }}</span>
        </button>
        <p class="fine">A per-channel mute always wins over this.</p>
      </template>

      <template v-else>
        <p class="lead">An invite for <strong>{{ activeServer?.name ?? 'this server' }}</strong>.</p>
        <button class="primary" :disabled="localBusy" @click="makeInvite">
          {{ localBusy ? 'Creating…' : inviteCode ? 'Create another' : 'Create invite link' }}
        </button>
        <div v-if="inviteLink" class="link">
          <code>{{ inviteLink }}</code>
          <button class="copy" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        </div>
        <p class="fine">Anyone with the link can join, as long as the invite is not used up.</p>
      </template>
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
  max-width: 480px;
  max-height: 85vh;
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
.tabs { display: flex; gap: var(--sp-200); margin-bottom: var(--sp-300); }
.tabs button {
  flex: 1;
  padding: var(--sp-200);
  border-radius: var(--radius-md);
  background: var(--sf-base);
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}
.level {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--sp-200);
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  text-align: left;
}
.level.on { outline: 1px solid var(--primary-main); background: var(--primary-container); }
.level-label { color: var(--text); font-weight: 600; }
.level-hint { color: var(--text-tertiary); font-size: var(--fs-xs); }
.ghost-wide {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-200);
  margin-top: var(--sp-300);
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font-weight: 600;
}
.tabs button.on { background: var(--primary-container); color: var(--primary-on-container); font-weight: 600; }
.lead { margin: 0 0 var(--sp-300); color: var(--text-secondary); font-size: var(--fs-sm); }
.field { display: flex; flex-direction: column; gap: var(--sp-100); margin-bottom: var(--sp-300); }
.label { font-size: var(--fs-sm); color: var(--text-tertiary); }
.input {
  padding: var(--sp-200) var(--sp-300);
  border: 1px solid var(--outline);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text);
  font: inherit;
}
.row { display: flex; gap: var(--sp-200); margin-bottom: var(--sp-300); }
.toggle { display: flex; align-items: center; gap: var(--sp-200); color: var(--text-secondary); font-size: var(--fs-sm); }
.toggle[aria-pressed='true'] { color: var(--primary-main); }
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:disabled { opacity: 0.5; }
.fine { margin: var(--sp-200) 0 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
.error { margin: 0 0 var(--sp-200); color: var(--critical); font-size: var(--fs-sm); }
.link {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin-top: var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-md);
  background: var(--sf-base);
}
.link code { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--text); font-size: var(--fs-xs); }
.copy { color: var(--primary-main); font-size: var(--fs-sm); font-weight: 600; }
</style>
