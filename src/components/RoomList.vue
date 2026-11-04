<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';
import type { Conversation } from '../services/data';

const props = defineProps<{
  serverName: string;
  channels: Channel[];
  activeId: string;
  me?: { name: string; role: 'admin' | 'mod' | null };
  live?: boolean;
  unreadNotifications?: number;
  dms?: Conversation[];
}>();
const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'servers'): void;
  (e: 'account'): void;
  (e: 'notifications'): void;
  (e: 'new-dm'): void;
}>();

const groups = computed(() => {
  const out: { title: string; items: Channel[] }[] = [];
  for (const c of props.channels) {
    const g = out.find((x) => x.title === c.category);
    if (g) g.items.push(c);
    else out.push({ title: c.category, items: [c] });
  }
  return out;
});
</script>

<template>
  <aside class="rooms">
    <header class="rooms-head">
      <button class="server-switch" title="Servers" @click="emit('servers')">
        <span class="server-name">{{ serverName }}</span>
        <Icon name="chevron" :size="16" />
      </button>
    </header>

    <div class="search">
      <Icon name="search" :size="15" />
      <input placeholder="Search" />
    </div>

    <div class="scroll">
      <!-- Direct conversations come first: a message addressed to you is more urgent than a
           channel somebody else is talking in. -->
      <section class="group">
        <div class="group-title dm-title">
          <span>Direct messages</span>
          <button class="new-dm" title="New message" aria-label="New message" @click="emit('new-dm')">
            <Icon name="plus" :size="14" />
          </button>
        </div>
        <button
          v-for="d in props.dms"
          :key="d.id"
          class="row dm"
          :class="{ active: d.id === activeId, unread: !!d.unread && d.id !== activeId }"
          @click="emit('select', d.id)"
        >
          <span class="dm-avatar" :style="d.other?.avatarUrl ? undefined : { background: d.other?.color ?? 'var(--primary-main)' }">
            <img v-if="d.other?.avatarUrl" :src="d.other.avatarUrl" alt="" referrerpolicy="no-referrer" />
            <template v-else>{{ d.other?.initial ?? d.title.slice(0, 1).toUpperCase() }}</template>
          </span>
          <span class="name">{{ d.title }}</span>
          <Icon v-if="d.muted" name="bell-off" :size="13" class="muted-mark" />
          <span v-if="d.mentions" class="badge mention">{{ d.mentions }}</span>
          <span v-else-if="d.unread" class="badge" />
        </button>
        <p v-if="!props.dms?.length" class="dm-empty">No conversations yet</p>
      </section>

      <section v-for="g in groups" :key="g.title" class="group">
        <div class="group-title">{{ g.title }}</div>
        <button
          v-for="c in g.items"
          :key="c.id"
          class="row"
          :class="{ active: c.id === activeId, unread: !!c.unread && c.id !== activeId }"
          @click="emit('select', c.id)"
        >
          <Icon :name="c.kind === 'voice' ? 'volume' : 'hash'" :size="16" />
          <span class="name">{{ c.name }}</span>
          <Icon v-if="c.encrypted" name="lock" :size="13" class="lock" />
          <Icon v-if="c.muted" name="bell-off" :size="13" class="muted-mark" />
          <span v-if="c.mention" class="badge mention">{{ c.mention }}</span>
          <span v-else-if="c.unread" class="badge" />
        </button>
      </section>
    </div>

    <!-- Notification history sits with the account, as in the official client: it is about you,
         not about the channel you happen to have open. -->
    <div class="me">
      <button class="me-who" @click="emit('account')">
        <div class="avatar">{{ (me?.name ?? 'you').slice(0, 1).toUpperCase() }}</div>
        <div class="me-text">
          <span class="me-name">{{ me?.name ?? 'you' }}</span>
          <span class="me-status">{{ live ? 'instance session' : 'demo data' }}</span>
        </div>
        <Icon v-if="me?.role" name="shield" :size="15" />
      </button>
      <button
        class="me-notifications"
        title="Notifications"
        :aria-label="unreadNotifications ? `Notifications, ${unreadNotifications} unread` : 'Notifications'"
        @click="emit('notifications')"
      >
        <Icon name="bell" :size="16" />
        <span v-if="unreadNotifications" class="me-dot" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.rooms {
  width: var(--rooms-width);
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--sf-container);
  border-right: 1px solid var(--sf-line);
}
.rooms-head {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--sp-300);
  border-bottom: 1px solid var(--sf-line);
  color: var(--text);
}
.server-switch {
  display: flex;
  align-items: center;
  gap: var(--sp-100);
  min-width: 0;
  padding: var(--sp-100) var(--sp-200);
  margin-left: calc(var(--sp-200) * -1);
  border-radius: var(--radius-md);
  color: var(--text);
}
.server-switch:active { background: var(--sfv-container); }
.server-name { font-weight: 600; font-size: var(--fs-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin: var(--sp-300);
  padding: 0 var(--sp-300);
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--sfv-container);
  color: var(--text-tertiary);
}
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: var(--fs-sm);
}
.scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-bottom: var(--sp-300); }
@media (hover: hover) and (pointer: fine) { .scroll { scrollbar-gutter: stable; } }
.group { margin-bottom: var(--sp-200); }
.group-title {
  padding: var(--sp-200) var(--sp-300) var(--sp-100);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.row {
  width: calc(100% - var(--sp-200));
  margin: 0 var(--sp-100);
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  height: 32px;
  padding: 0 var(--sp-200);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-align: left;
}
.row:hover { background: var(--sf-hover); color: var(--text); }
.row.active { background: var(--sfv-active); color: var(--text); }
.muted-mark { color: var(--text-tertiary); flex: none; }
.dm-title { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-200); }
.new-dm { padding: 2px; color: var(--text-tertiary); }
.dm-empty { margin: 0; padding: var(--sp-100) var(--sp-300) var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-xs); }
.dm-avatar {
  width: 18px;
  height: 18px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  color: var(--primary-on);
  font-size: 9px;
  font-weight: 700;
  overflow: hidden;
}
.dm-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.row.unread { color: var(--text); }
.row.unread .name { font-weight: 600; }
.name { flex: 1; font-size: var(--fs-base); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lock { color: var(--text-tertiary); }
.badge {
  min-width: 8px;
  height: 8px;
  border-radius: var(--radius-round);
  background: var(--secondary-main);
}
.badge.mention {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--secondary-on);
}
.me {
  display: flex;
  align-items: center;
  gap: var(--sp-100);
  align-items: center;
  gap: var(--sp-200);
  padding: var(--sp-200) var(--sp-300);
  background: var(--bg-container);
  border-top: 1px solid var(--sf-line);
  color: var(--text-tertiary);
}
.avatar {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: var(--primary-container);
  color: var(--primary-on-container);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.me-who {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  min-width: 0;
  color: inherit;
  text-align: left;
}
.me-notifications { position: relative; padding: var(--sp-200); color: var(--text-tertiary); }
.me-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-radius: var(--radius-round);
  background: var(--primary-main);
}
.me-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.me-name { font-size: var(--fs-sm); color: var(--text); font-weight: 600; }
.me-status { font-size: var(--fs-xs); color: var(--text-tertiary); }
</style>
