<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { PERMISSION_BITS, type Role } from '../services/data';
import type { Author } from '../data/mock';

/**
 * Roles: what they are, who has them, and making one.
 *
 * The instance keeps a role as a row with a name, a colour and a Discord-style permission bitfield,
 * and `get_user_permissions` maps that bitfield to names. Only a server's owner (or an instance
 * admin) may create, edit or assign — the row level policies say so, so this sheet says so too
 * instead of letting a tap fail.
 */
const props = defineProps<{
  roles: Role[];
  members: Author[];
  /** member profile id → role ids they hold */
  assignments: Record<string, string[]>;
  canManage: boolean;
  loading?: boolean;
  busy?: boolean;
  error?: string;
  onAssign?: (userId: string, roleId: string, assign: boolean) => Promise<void>;
  onCreate?: (role: { name: string; color?: string; permissions: number }) => Promise<void>;
  onDelete?: (roleId: string) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const selected = ref<string | null>(null);
const creating = ref(false);
const name = ref('');
const color = ref('#7a6cf0');
const granted = ref<number>(0);

const role = computed(() => props.roles.find((r) => r.id === selected.value) ?? null);
const holders = computed(() => (role.value ? props.assignments[role.value.id] ?? [] : []));

function has(userId: string, roleId: string): boolean {
  return (props.assignments[userId] ?? []).includes(roleId);
}
function toggle(userId: string): void {
  if (!role.value || !props.canManage) return;
  void props.onAssign?.(userId, role.value.id, !has(userId, role.value.id));
}
function togglePermission(bit: number): void {
  granted.value = (granted.value & bit) === bit ? granted.value & ~bit : granted.value | bit;
}
const permissionNames = computed(() =>
  PERMISSION_BITS.filter((p) => (granted.value & p.bit) === p.bit).map((p) => p.name)
);
async function submit(): Promise<void> {
  if (!name.value.trim() || !props.canManage) return;
  await props.onCreate?.({ name: name.value.trim(), color: color.value, permissions: granted.value });
  name.value = '';
  granted.value = 0;
  creating.value = false;
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Roles">
      <header>
        <span>{{ role ? role.name : 'Roles' }}</span>
        <button class="close" aria-label="Close" @click="role ? (selected = null) : emit('close')">
          <Icon :name="role ? 'back' : 'close'" :size="18" />
        </button>
      </header>

      <p v-if="!canManage" class="hint">
        Only the server's owner can change roles — the instance's rule, not this screen's.
      </p>
      <p v-if="error" class="hint error">{{ error }}</p>
      <p v-else-if="loading && !roles.length" class="hint">Loading…</p>

      <!-- one role: who holds it -->
      <template v-if="role">
        <p class="sub">
          {{ holders.length }} {{ holders.length === 1 ? 'member' : 'members' }}
          <template v-if="role.isDefault"> · the default role, held by everyone</template>
        </p>
        <button
          v-for="person in members"
          :key="person.id ?? person.name"
          class="row"
          :disabled="!canManage || busy"
          @click="toggle(person.id ?? '')"
        >
          <span class="avatar" :style="person.avatarUrl ? undefined : { background: person.color }">
            <img v-if="person.avatarUrl" :src="person.avatarUrl" alt="" referrerpolicy="no-referrer" />
            <template v-else>{{ person.initial }}</template>
          </span>
          <span class="name">{{ person.name }}</span>
          <span class="check" :class="{ on: person.id ? has(person.id, role.id) : false }">
            <Icon name="check" :size="14" />
          </span>
        </button>
        <button
          v-if="!role.isDefault && canManage"
          class="danger"
          :disabled="busy"
          @click="props.onDelete?.(role.id); selected = null"
        >
          Delete this role
        </button>
      </template>

      <!-- the list, plus creating -->
      <template v-else>
        <button v-for="r in roles" :key="r.id" class="row" @click="selected = r.id">
          <span class="swatch" :style="{ background: r.color ?? 'var(--text-tertiary)' }" />
          <span class="name">{{ r.name }}</span>
          <span class="meta">{{ r.members }}</span>
          <span v-if="r.isDefault" class="tag">default</span>
        </button>

        <button v-if="canManage && !creating" class="ghost" @click="creating = true">
          <Icon name="plus" :size="14" /> New role
        </button>

        <div v-if="creating" class="create">
          <label class="field">
            <span class="label">Name</span>
            <input v-model="name" class="input" maxlength="40" placeholder="Moderators" />
          </label>
          <label class="field">
            <span class="label">Colour</span>
            <input v-model="color" class="input color" type="color" />
          </label>
          <div class="perms">
            <button
              v-for="p in PERMISSION_BITS"
              :key="p.name"
              class="perm"
              :class="{ on: (granted & p.bit) === p.bit }"
              @click="togglePermission(p.bit)"
            >
              {{ p.label }}
            </button>
          </div>
          <p class="fine">{{ permissionNames.length }} permission(s) granted.</p>
          <button class="primary" :disabled="busy || !name.trim()" @click="submit">Create role</button>
        </div>
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
.hint { margin: 0 0 var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-sm); }
.hint.error { color: var(--critical); }
.sub { margin: 0 0 var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-sm); }
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
.avatar {
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  color: var(--primary-on);
  font-size: var(--fs-xs);
  font-weight: 700;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.name { flex: 1; min-width: 0; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { color: var(--text-tertiary); font-size: var(--fs-xs); }
.tag {
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: var(--sfv-container);
  color: var(--text-tertiary);
  font-size: 10px;
  text-transform: uppercase;
}
.check {
  width: 22px;
  height: 22px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  border: 1px solid var(--outline);
  color: transparent;
}
.check.on { background: var(--primary-main); border-color: transparent; color: var(--primary-on); }
.ghost { display: flex; align-items: center; gap: var(--sp-100); padding: var(--sp-300) 0; color: var(--primary-main); font-size: var(--fs-sm); }
.create { border-top: 1px solid var(--sf-line); padding-top: var(--sp-300); }
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
.input.color { height: 42px; padding: 4px; }
.perms { display: flex; flex-wrap: wrap; gap: var(--sp-100); margin-bottom: var(--sp-200); }
.perm {
  padding: 4px 8px;
  border-radius: var(--radius-md);
  background: var(--sf-base);
  color: var(--text-secondary);
  font-size: var(--fs-xs);
}
.perm.on { background: var(--primary-container); color: var(--primary-on-container); font-weight: 600; }
.fine { margin: 0 0 var(--sp-300); color: var(--text-tertiary); font-size: var(--fs-xs); }
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:disabled { opacity: 0.5; }
.danger {
  width: 100%;
  margin-top: var(--sp-300);
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--critical-container);
  color: var(--critical);
  font-weight: 600;
}
</style>
