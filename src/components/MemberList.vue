<script setup lang="ts">
import { computed, ref } from 'vue';
import { members as mockMembers, type Author } from '../data/mock';

/**
 * Live member roster, or the demo one when there is no session. Presence is not wired (it needs
 * the server's presence channel), so everybody is listed in join order rather than split into
 * online and offline: a made-up "online" heading would be worse than none.
 */
const props = defineProps<{
  members?: Author[];
  /** Who is online, by profile id, as the instance reports it. */
  presence?: Record<string, { online: boolean; status: number; label: string }>;
}>();
const emit = defineEmits<{
  (e: 'select', person: Author): void;
  (e: 'actions', person: Author): void;
}>();

interface Row {
  /** The profile id — presence, and every other per-person thing, is keyed by it. */
  id?: string;
  name: string;
  initial: string;
  color: string;
  role: 'admin' | 'mod' | null;
  avatarUrl?: string;
  status: 'member' | 'online' | 'idle' | 'offline';
}

const roster = computed<Row[]>(() =>
  props.members?.length
    ? props.members.map((m) => ({
        id: m.id,
        name: m.name,
        initial: m.initial,
        color: m.color,
        role: m.role ?? null,
        avatarUrl: m.avatarUrl,
        status: 'member',
      }))
    : (mockMembers as Row[])
);
/** A picture that fails to load falls back to the initial, as it does in the message list. */
const broken = ref<Record<string, true>>({});
/** The instance's answer wins over the roster's placeholder: it is the only one that is real. */
function presenceOf(id: string | undefined): { online: boolean; status: number; label: string } | undefined {
  return id ? props.presence?.[id] : undefined;
}
/** With real members the split is presence; the demo roster keeps its own pretend statuses. */
const live = computed(() => (props.members?.length ?? 0) > 0);
const online = computed(() =>
  live.value ? roster.value.filter((m) => presenceOf(m.id)?.online) : roster.value.filter((m) => m.status !== 'offline')
);
const offline = computed(() =>
  live.value ? roster.value.filter((m) => !presenceOf(m.id)?.online) : roster.value.filter((m) => m.status === 'offline')
);
const isOnline = (id: string | undefined): boolean => presenceOf(id)?.online === true;
</script>

<template>
  <aside class="members">
    <section v-for="g in [{ t: `Online — ${online.length}`, list: online }, { t: `Offline — ${offline.length}`, list: offline }]" :key="g.t">
      <div class="title">{{ g.t }}</div>
      <button
        v-for="m in g.list"
        :key="m.name"
        class="row"
        :class="{ dim: !isOnline(m.id) }"
        :disabled="!props.members?.length"
        @click="emit('select', (props.members ?? []).find((p) => p.name === m.name) ?? { name: m.name, initial: m.initial, color: m.color })"
      >
        <div class="av" :style="!m.avatarUrl || broken[m.name] ? { background: m.color } : undefined">
          <img
            v-if="m.avatarUrl && !broken[m.name]"
            :src="m.avatarUrl"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="broken[m.name] = true"
          />
          <template v-else>{{ m.initial }}</template>
        </div>
        <div class="who">
          <span class="name">{{ m.name }}</span>
          <span v-if="m.role" class="role" :class="m.role">{{ m.role === 'admin' ? 'admin' : 'mod' }}</span>
        </div>
        <button
          class="more"
          title="Actions"
          :disabled="!props.members?.length"
          @click.stop="
            emit(
              'actions',
              (props.members ?? []).find((p) => p.name === m.name) ?? { name: m.name, initial: m.initial, color: m.color }
            )
          "
        >
          <Icon name="dots" :size="14" />
        </button>
        <span
          v-if="presenceOf(m.id)"
          class="presence"
          :class="{ off: !isOnline(m.id), away: (presenceOf(m.id)?.status ?? 1) > 1 && isOnline(m.id) }"
          :title="presenceOf(m.id)?.label ?? (isOnline(m.id) ? 'Online' : 'Offline')"
        />
      </button>
    </section>
  </aside>
</template>

<style scoped>
.members {
  width: var(--members-width);
  overflow-y: auto;
  padding: var(--sp-300) var(--sp-200);
  background: var(--sf-container);
  border-left: 1px solid var(--sf-line);
}
.title {
  padding: var(--sp-200) var(--sp-200) var(--sp-100);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  padding: var(--sp-100) var(--sp-200);
  border-radius: var(--radius-sm);
}
.row:hover { background: var(--sf-hover); }
.row.dim { opacity: 0.45; }
.av img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; display: block; }
.av {
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border-radius: var(--radius-round);
  color: #1a1a1a;
  font-size: var(--fs-xs);
  font-weight: 700;
}
.who { display: flex; align-items: center; gap: var(--sp-200); min-width: 0; }
.more { flex: none; padding: 2px 4px; color: var(--text-tertiary); }
.presence {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: var(--radius-round);
  background: var(--positive, #3fc47a);
}
.presence.away { background: var(--warning, #e0a33e); }
.presence.off { background: var(--text-tertiary); opacity: 0.5; }
.name { font-size: var(--fs-sm); color: var(--text); }
.role {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: var(--radius-xs);
}
.role.mod { background: var(--primary-container); color: var(--primary-on-container); }
.role.admin { background: var(--critical-container); color: #f5d6d6; }
.idle {
  width: 8px; height: 8px;
  border-radius: var(--radius-round);
  background: var(--warning);
  border: 2px solid var(--sf-container);
}
</style>
