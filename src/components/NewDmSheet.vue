<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import type { Author } from '../data/mock';

/**
 * "New message": pick a person, get a conversation.
 *
 * The member list already opens a conversation on tap, but that only works if the person is in the
 * server you have open — this one searches everyone the client knows about and is where people look
 * for a "write to someone" action.
 */
const props = defineProps<{ members: Author[]; meId?: string | null; live?: boolean }>();
const emit = defineEmits<{ (e: 'pick', person: Author): void; (e: 'close'): void }>();

const query = ref('');

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  const people = props.members.filter((m) => !props.meId || m.id !== props.meId);
  if (!q) return people;
  return people.filter((m) => m.name.toLowerCase().includes(q));
});
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="New message">
      <header>
        <span>New message</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <div class="field">
        <Icon name="search" :size="16" />
        <input v-model="query" placeholder="Search people" autocomplete="off" spellcheck="false" />
      </div>

      <p v-if="!live" class="hint">Direct messages need a live session.</p>
      <p v-else-if="!results.length" class="hint">
        {{ query ? 'Nobody by that name here.' : 'Join a server to find people to write to.' }}
      </p>

      <button v-for="person in results" :key="person.id ?? person.name" class="row" @click="emit('pick', person)">
        <span class="avatar" :style="person.avatarUrl ? undefined : { background: person.color }">
          <img v-if="person.avatarUrl" :src="person.avatarUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ person.initial }}</template>
        </span>
        <span class="name">{{ person.name }}</span>
        <span v-if="person.role" class="role" :class="person.role">{{ person.role }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 460px;
  max-height: 75vh;
  overflow-y: auto;
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
.field {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin: 0 var(--sp-300) var(--sp-300);
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--sf-base);
  color: var(--text-tertiary);
}
.field input { flex: 1; min-width: 0; background: none; border: 0; color: var(--text); font: inherit; }
.hint { margin: 0; padding: var(--sp-200) var(--sp-300) var(--sp-400); color: var(--text-tertiary); font-size: var(--fs-sm); }
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
.avatar {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  color: var(--primary-on);
  font-weight: 700;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.name { flex: 1; min-width: 0; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}
.role.mod { background: var(--primary-container); color: var(--primary-on-container); }
.role.admin { background: var(--critical-container); color: #f5d6d6; }
</style>
