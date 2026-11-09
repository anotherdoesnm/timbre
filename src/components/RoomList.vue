<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import ServerMenu from './ServerMenu.vue';
import EmojiText from './EmojiText.vue';
import type { Channel } from '../data/mock';
import type { Conversation } from '../services/data';
import type { CustomEmoji } from '../services/emoji';

const props = defineProps<{
  serverName: string;
  channels: Channel[];
  activeId: string;
  me?: { name: string; role: 'admin' | 'mod' | null };
  live?: boolean;
  unreadNotifications?: number;
  dms?: Conversation[];
  /** Unread per category, so a collapsed or busy category can say how much is in it. */
  categoryUnread?: Record<string, number>;
  /** Presence of the people in the conversations, keyed by profile id. */
  dmPresence?: Record<string, { online: boolean; status: number; label: string }>;
  /** May this person manage the open server: roles, channels, categories. */
  canManage?: boolean;
  /** For shortcodes in a conversation's name. */
  customEmoji?: CustomEmoji[];
}>();
const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'servers'): void;
  (e: 'settings'): void;
  (e: 'create-channel'): void;
  (e: 'create-category'): void;
  (e: 'invite'): void;
  (e: 'server-notifications'): void;
  (e: 'mark-server-read'): void;
  (e: 'mark-channel-read', id: string): void;
  (e: 'mute-channel', id: string, muted: boolean): void;
  (e: 'rename-channel', channel: Channel): void;
  (e: 'delete-channel', channel: Channel): void;
  (e: 'account'): void;
  (e: 'notifications'): void;
  (e: 'new-dm'): void;
}>();

const menuOpen = ref(false);
/** Which channel's context menu is open, and where it was asked for. */
const channelMenu = ref<{ channel: Channel; top: number } | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressed: { id: string; x: number; y: number } | null = null;
/** A long press also produces a click; opening the menu and the channel together is not a feature. */
let swallowClick = false;

function onRowClick(channel: Channel): void {
  if (swallowClick) {
    swallowClick = false;
    return;
  }
  emit('select', channel.id);
}

/** A long press is how a phone asks for a context menu; a right click is how a desktop does. */
function startPress(event: PointerEvent, channel: Channel): void {
  if (event.button !== 0) return;
  pressed = { id: channel.id, x: event.clientX, y: event.clientY };
  // Read the row's position now: `currentTarget` is only valid while the event is being dispatched,
  // and it is null by the time the long press fires. That was a TypeError on every long press.
  const bottom = (event.currentTarget as HTMLElement).getBoundingClientRect().bottom;
  cancelPress();
  pressTimer = setTimeout(() => {
    channelMenu.value = { channel, top: bottom + 4 };
    swallowClick = true;
    pressTimer = null;
  }, 420);
}

function cancelPress(): void {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  pressed = null;
}

function movePress(event: PointerEvent): void {
  if (!pressed || !pressTimer) return;
  if (Math.abs(event.clientX - pressed.x) > 8 || Math.abs(event.clientY - pressed.y) > 8) cancelPress();
}

function openMenu(event: MouseEvent, channel: Channel): void {
  event.preventDefault();
  const row = (event.currentTarget as HTMLElement).getBoundingClientRect();
  channelMenu.value = { channel, top: row.bottom + 4 };
}

function copyId(id: string): void {
  void navigator.clipboard?.writeText(id).catch(() => undefined);
  channelMenu.value = null;
}

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
      <!-- The name of the server opens what belongs to *this* server. Switching servers is the
           rail on the left (and the last item in this menu on a narrow screen). -->
      <button class="server-switch" :title="`${serverName} menu`" @click="menuOpen = !menuOpen">
        <span class="server-name">{{ serverName }}</span>
        <Icon name="chevron" :size="16" />
      </button>
      <ServerMenu
        v-if="menuOpen"
        :server-name="serverName"
        :can-manage="!!props.canManage"
        :live="props.live"
        @close="menuOpen = false"
        @settings="menuOpen = false; emit('settings')"
        @create-channel="menuOpen = false; emit('create-channel')"
        @create-category="menuOpen = false; emit('create-category')"
        @invite="menuOpen = false; emit('invite')"
        @notifications="menuOpen = false; emit('server-notifications')"
        @mark-read="menuOpen = false; emit('mark-server-read')"
        @switch-server="menuOpen = false; emit('servers')"
      />
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
          <span
            v-if="d.other?.id && props.dmPresence?.[d.other.id]"
            class="dm-presence"
            :class="{ off: !props.dmPresence[d.other.id].online }"
            :title="props.dmPresence[d.other.id].label"
          />
          <span class="name"><EmojiText :text="d.title" :emoji="props.customEmoji" /></span>
          <Icon v-if="d.muted" name="bell-off" :size="13" class="muted-mark" />
          <span v-if="d.mentions" class="badge mention">{{ d.mentions }}</span>
          <span v-else-if="d.unread" class="badge" />
        </button>
        <p v-if="!props.dms?.length" class="dm-empty">No conversations yet</p>
      </section>

      <section v-for="g in groups" :key="g.title" class="group">
        <div class="group-title">
          <span>{{ g.title }}</span>
          <span v-if="props.categoryUnread?.[g.title]" class="group-count">{{ props.categoryUnread[g.title] }}</span>
        </div>
        <button
          v-for="c in g.items"
          :key="c.id"
          class="row"
          :class="{ active: c.id === activeId, unread: !!c.unread && c.id !== activeId }"
          @click="onRowClick(c)"
          @pointerdown="startPress($event, c)"
          @pointermove="movePress"
          @pointerup="cancelPress"
          @pointercancel="cancelPress"
          @contextmenu="openMenu($event, c)"
        >
          <Icon :name="c.kind === 'voice' ? 'volume' : 'hash'" :size="16" />
          <span class="name">{{ c.name }}</span>
          <Icon v-if="c.encrypted" name="lock" :size="13" class="lock" />
          <Icon v-if="c.muted" name="bell-off" :size="13" class="muted-mark" />
          <span v-if="c.mention" class="badge mention">{{ c.mention }}</span>
          <span v-else-if="c.unread" class="badge" />
        </button>
      </section>

      <!-- A channel's own actions, where the channel is. Upstream has the same menu; ours used to
           have only the mute bell in the header, so renaming or deleting a channel was impossible. -->
      <template v-if="channelMenu">
        <div class="menu-backdrop" @click="channelMenu = null" />
        <nav class="channel-menu" :style="{ top: `${channelMenu.top}px` }" role="menu">
          <button role="menuitem" @click="emit('mark-channel-read', channelMenu.channel.id); channelMenu = null">
            <Icon name="check" :size="15" /> Mark as read
          </button>
          <button role="menuitem" @click="copyId(channelMenu.channel.id)">
            <Icon name="hash" :size="15" /> Copy channel ID
          </button>
          <button
            role="menuitem"
            @click="emit('mute-channel', channelMenu.channel.id, !channelMenu.channel.muted); channelMenu = null"
          >
            <Icon :name="channelMenu.channel.muted ? 'bell' : 'bell-off'" :size="15" />
            {{ channelMenu.channel.muted ? 'Unmute channel' : 'Mute channel' }}
          </button>
          <template v-if="props.canManage">
            <div class="menu-split" />
            <button role="menuitem" @click="emit('rename-channel', channelMenu.channel); channelMenu = null">
              <Icon name="poll" :size="15" /> Edit channel
            </button>
            <button class="danger" role="menuitem" @click="emit('delete-channel', channelMenu.channel); channelMenu = null">
              <Icon name="close" :size="15" /> Delete channel
            </button>
          </template>
        </nav>
      </template>
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
.menu-backdrop { position: fixed; inset: 0; z-index: 44; }
.channel-menu {
  position: absolute;
  z-index: 45;
  left: var(--sp-300);
  right: var(--sp-200);
  display: flex;
  flex-direction: column;
  padding: var(--sp-100);
  border: 1px solid var(--bg-line);
  border-radius: var(--radius-lg);
  background: var(--sf-container);
  box-shadow: var(--shadow-3);
}
.channel-menu button {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-300);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: var(--fs-md);
  text-align: left;
}
.channel-menu button:hover { background: var(--sfv-container); }
.channel-menu button.danger { color: var(--critical); }
.menu-split { height: 1px; margin: var(--sp-100) 0; background: var(--bg-line); }
.rooms {
  /* The server menu is anchored to this column, not to the viewport. */
  position: relative;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-200);
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
.group-count {
  padding: 0 5px;
  border-radius: var(--radius-xs);
  background: var(--primary-container);
  color: var(--primary-on-container);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.dm-title { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-200); }
.new-dm { padding: 2px; color: var(--text-tertiary); }
.dm-empty { margin: 0; padding: var(--sp-100) var(--sp-300) var(--sp-200); color: var(--text-tertiary); font-size: var(--fs-xs); }
.dm-presence {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: var(--radius-round);
  background: var(--positive, #3fc47a);
}
.dm-presence.off { background: var(--text-tertiary); opacity: 0.5; }
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
