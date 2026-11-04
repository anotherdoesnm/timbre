<script setup lang="ts">
import Icon from './Icon.vue';
import type { Author } from '../data/mock';

/**
 * The card behind a tapped `@mention`.
 *
 * A mention is a link to a person, and the only thing this client can honestly show about someone
 * it has not listed anywhere else is the profile row: face, name, handle, role, home instance. It
 * is a bottom sheet rather than a popover because on a phone the mention is under the thumb.
 */
const props = defineProps<{
  /** `id` and `name` only when the lookup found nothing; the handle is still worth showing. */
  person: Partial<Author> & { name: string; username?: string; domain?: string };
  onClose: () => void;
}>();

const handle = (): string => {
  const user = props.person.username ?? props.person.name;
  return props.person.domain ? `@${user}@${props.person.domain}` : `@${user}`;
};
</script>

<template>
  <div class="backdrop" @click.self="onClose()">
    <div class="card" role="dialog" aria-label="Profile">
      <header>
        <span>Profile</span>
        <button class="close" aria-label="Close" @click="onClose()"><Icon name="close" :size="18" /></button>
      </header>
      <div class="who">
        <span class="avatar" :style="person.avatarUrl ? undefined : { background: person.color ?? 'var(--primary-main)' }">
          <img v-if="person.avatarUrl" :src="person.avatarUrl" alt="" referrerpolicy="no-referrer" />
          <template v-else>{{ (person.initial ?? person.name.slice(0, 1)).toUpperCase() }}</template>
        </span>
        <span class="text">
          <span class="name">
            {{ person.name }}
            <span v-if="person.role" class="role" :class="person.role">{{ person.role }}</span>
            <span v-else-if="person.bot" class="role bot">bot</span>
          </span>
          <span class="handle">{{ handle() }}</span>
        </span>
      </div>
      <button class="row" @click="onClose()">
        <Icon name="check" :size="16" />
        <span>Done</span>
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
.card {
  width: 100%;
  max-width: 420px;
  padding: var(--sp-200) var(--sp-200) calc(var(--sp-500) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
  animation: card-up 160ms ease-out;
}
@keyframes card-up { from { transform: translateY(12px); opacity: 0.6; } to { transform: none; opacity: 1; } }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300);
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
  padding: var(--sp-200) var(--sp-300) var(--sp-400);
}
.avatar {
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
.text { display: flex; flex-direction: column; min-width: 0; }
.name { font-weight: 600; display: flex; align-items: baseline; gap: var(--sp-200); }
.handle { color: var(--text-tertiary); font-size: var(--fs-sm); overflow-wrap: anywhere; }
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
.role.bot { background: var(--sf-base); color: var(--text-tertiary); }
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
</style>
