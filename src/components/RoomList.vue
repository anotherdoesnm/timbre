<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
import type { Channel } from '../data/mock';

const props = defineProps<{ serverName: string; channels: Channel[]; activeId: string }>();
const emit = defineEmits<{ (e: 'select', id: string): void }>();

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
      <span class="server-name">{{ serverName }}</span>
      <Icon name="chevron" :size="16" />
    </header>

    <div class="search">
      <Icon name="search" :size="15" />
      <input placeholder="Поиск" />
    </div>

    <div class="scroll">
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
          <span v-if="c.mention" class="badge mention">{{ c.mention }}</span>
          <span v-else-if="c.unread" class="badge" />
        </button>
      </section>
    </div>

    <footer class="me">
      <div class="avatar">K</div>
      <div class="me-text">
        <span class="me-name">kirill</span>
        <span class="me-status">модератор</span>
      </div>
      <Icon name="shield" :size="15" />
    </footer>
  </aside>
</template>

<style scoped>
.rooms {
  width: var(--rooms-width);
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
.scroll { flex: 1; overflow-y: auto; padding-bottom: var(--sp-300); }
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
.me-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.me-name { font-size: var(--fs-sm); color: var(--text); font-weight: 600; }
.me-status { font-size: var(--fs-xs); color: var(--text-tertiary); }
</style>
