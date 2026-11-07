<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { CHANNEL_PERMISSIONS, type ChannelOverride } from '../services/data';
import type { Role } from '../services/data';

/**
 * Per-channel permission overrides.
 *
 * A channel can *allow* or *deny* a permission for a role, and the instance stores both masks on one
 * row (`allow_permissions`, `deny_permissions`). "Neutral" is the absence of the bit in both, which is
 * the default state of every permission and the one that lets the server's roles decide.
 */
const props = defineProps<{
  channelName: string;
  roles: Role[];
  overrides: ChannelOverride[];
  canManage: boolean;
  loading?: boolean;
  busy?: boolean;
  error?: string;
  onChange?: (roleId: string, allow: number, deny: number) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const roleId = ref<string | null>(null);
const role = computed(() => props.roles.find((r) => r.id === roleId.value) ?? null);
const current = computed(() => props.overrides.find((o) => o.roleId === roleId.value));

/** Allow, deny, or neither — the three states a permission can be in for one role. */
function stateOf(bit: number): 'allow' | 'deny' | 'neutral' {
  const row = current.value;
  if (!row) return 'neutral';
  if ((row.allow & bit) === bit) return 'allow';
  if ((row.deny & bit) === bit) return 'deny';
  return 'neutral';
}

function set(bit: number, next: 'allow' | 'deny' | 'neutral'): void {
  if (!roleId.value || !props.canManage) return;
  const row = current.value ?? { id: '', roleId: roleId.value, allow: 0, deny: 0 };
  let allow = row.allow & ~bit;
  let deny = row.deny & ~bit;
  if (next === 'allow') allow |= bit;
  if (next === 'deny') deny |= bit;
  void props.onChange?.(roleId.value, allow, deny);
}

function summary(id: string): string {
  const row = props.overrides.find((o) => o.roleId === id);
  if (!row) return '';
  const allowed = CHANNEL_PERMISSIONS.filter((p) => (row.allow & p.bit) === p.bit).length;
  const denied = CHANNEL_PERMISSIONS.filter((p) => (row.deny & p.bit) === p.bit).length;
  return [allowed ? `${allowed} allowed` : '', denied ? `${denied} denied` : ''].filter(Boolean).join(', ');
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Channel permissions">
      <header>
        <span>#{{ channelName }}{{ role ? ` · ${role.name}` : '' }}</span>
        <button class="close" aria-label="Close" @click="roleId ? (roleId = null) : emit('close')">
          <Icon :name="roleId ? 'back' : 'close'" :size="18" />
        </button>
      </header>

      <p v-if="!canManage" class="hint">
        Only the owner, instance staff, or a role with MANAGE_CHANNELS may change these.
      </p>
      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !roles.length" class="hint">Loading…</p>

      <template v-if="!role">
        <button v-for="r in roles" :key="r.id" class="row" @click="roleId = r.id">
          <span class="swatch" :style="{ background: r.color ?? 'var(--text-tertiary)' }" />
          <span class="name">{{ r.name }}</span>
          <span class="meta">{{ summary(r.id) }}</span>
        </button>
      </template>

      <template v-else>
        <div v-for="perm in CHANNEL_PERMISSIONS" :key="perm.name" class="perm">
          <span class="label">{{ perm.label }}</span>
          <span class="states">
            <button
              class="state"
              :class="{ on: stateOf(perm.bit) === 'allow' }"
              title="Allow"
              :disabled="busy || !canManage"
              @click="set(perm.bit, stateOf(perm.bit) === 'allow' ? 'neutral' : 'allow')"
            >
              ✓
            </button>
            <button
              class="state deny"
              :class="{ on: stateOf(perm.bit) === 'deny' }"
              title="Deny"
              :disabled="busy || !canManage"
              @click="set(perm.bit, stateOf(perm.bit) === 'deny' ? 'neutral' : 'deny')"
            >
              ✕
            </button>
          </span>
        </div>
        <p class="fine">Neither ✓ nor ✕ means the server's roles decide.</p>
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
  letter-spacing: 0.02em;
}
.close { color: var(--text-tertiary); }
.hint { margin: 0 0 var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-200) 0;
  border-top: 1px solid var(--sf-line);
  text-align: left;
}
.swatch { width: 12px; height: 12px; flex: none; border-radius: var(--radius-round); }
.name { flex: 1; min-width: 0; color: var(--text); }
.meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.perm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-300);
  padding: var(--sp-200) 0;
  border-top: 1px solid var(--sf-line);
}
.label { color: var(--text-secondary); font-size: var(--fs-sm); }
.states { display: flex; gap: var(--sp-100); flex: none; }
.state {
  width: 30px;
  height: 26px;
  border-radius: var(--radius-md);
  background: var(--sf-base);
  color: var(--text-tertiary);
  font-weight: 700;
}
.state.on { background: var(--positive, #3fc47a); color: #06240f; }
.state.deny.on { background: var(--critical-container); color: var(--critical); }
.state:disabled { opacity: 0.5; }
.fine { margin: var(--sp-300) 0 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
</style>
