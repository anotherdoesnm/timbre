<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';
import EmojiPicker from './EmojiPicker.vue';
import PollCard from './PollCard.vue';
import type { CustomEmoji } from '../services/emoji';
import type { Channel, Message } from '../data/mock';
import { parseSegments, safeHref, type Segment } from '../services/markdown';

const props = defineProps<{
  channel: Channel;
  myId?: string | null;
  messages: Message[];
  live?: boolean;
  /** Custom emoji of the instance, for the picker. */
  customEmoji?: CustomEmoji[];
  /** Open threads, keyed by the message they hang off, for the "N replies" line. */
  threadCounts?: Record<string, number>;
  /** First unread message: the view opens here instead of at the bottom. */
  unreadFromId?: string | null;
  /** Message to jump to (search result). */
  focusId?: string | null;
  hasMore?: boolean;
  loadingOlder?: boolean;
}>();
const emit = defineEmits<{
  (e: 'load-older'): void;
  (e: 'reply', m: Message): void;
  (e: 'react', m: Message, emoji: string, mine: boolean): void;
  (e: 'mention', handle: string): void;
  (e: 'pin', m: Message, pinned: boolean): void;
  (e: 'vote', pollId: string, optionIds: string[]): void;
  (e: 'thread', m: Message): void;
  (e: 'channel', name: string): void;
  (e: 'edit', m: Message): void;
  (e: 'delete', m: Message): void;
}>();
const scroller = ref<HTMLElement | null>(null);
// On a phone there is no hover: the toolbar would sit on every message forever. A tap
// selects one message and shows its toolbar.
const selected = ref<string | null>(null);
// Parsing is cheap but happens on every scroll-driven re-render; one entry per message id is
// enough and keeps a long channel from re-tokenising itself constantly.
const segmentCache = new Map<string, Segment[]>();
function segments(m: Message): Segment[] {
  const hit = segmentCache.get(m.id);
  if (hit) return hit;
  const parsed = parseSegments(m.text);
  segmentCache.set(m.id, parsed);
  return parsed;
}
// A signed attachment URL can be expired or forbidden; a broken image icon tells nobody why.
const broken = ref<Record<string, true>>({});
// `/default_avatar.webp` is served by the instance, not by us; if it is missing the message
// should show initials rather than a torn image.
const brokenAvatars = ref<Record<string, true>>({});
// A short list rather than a full emoji keyboard: the instance has its own emoji table, and
// wiring that (with search and custom uploads) is its own step.
/** Emoji the instance offers on top of Unicode, loaded once by the shell. */
const customEmoji = computed(() => props.customEmoji ?? []);
const pickerFor = ref<string | null>(null);
const menuFor = ref<string | null>(null);
// The attachment currently shown full-screen, if any.
const lightbox = ref<string | null>(null);
function isMine(m: Message): boolean {
  return !!props.myId && m.author.id === props.myId;
}
function mine(m: Message, emoji: string): boolean {
  return !!m.reactions?.find((r) => r.emoji === emoji)?.mine;
}
function pick(m: Message, emoji: string): void {
  pickerFor.value = null;
  emit('react', m, emoji, mine(m, emoji));
}

/** A custom emoji reacts by name, which is what other clients resolve back to its picture. */
function pickCustom(m: Message, value: { char?: string; name?: string }): void {
  const emoji = value.char ?? (value.name ? `:${value.name}:` : '');
  if (!emoji) return;
  pickerFor.value = null;
  emit('react', m, emoji, mine(m, emoji));
}
// Which one is shown is decided in CSS by the pointer, not by this file: on a phone only the
// tapped message carries a toolbar, on a mouse the hovered one.

// Scroll offsets are per channel and outlive the component: switching away and back should land
// where the reader left off, not at the newest message.
const scrollMemory = new Map<string, number>();
let restorePending = true;

// Where the channel should open: on the first unread message when there is one, otherwise where
// the reader was, and only then at the newest.
async function scrollToStart(): Promise<void> {
  await nextTick();
  const el = scroller.value;
  if (!el) return;
  if (props.unreadFromId) {
    const target = el.querySelector<HTMLElement>(`[data-mid="${props.unreadFromId}"]`);
    if (target) {
      el.scrollTop = Math.max(0, target.offsetTop - el.offsetTop - 48);
      return;
    }
  }
  // A stored offset only makes sense once the messages it referred to are rendered, so it is
  // applied after the load and skipped on the first pass with an empty list.
  const saved = restorePending ? scrollMemory.get(props.channel.id) : undefined;
  if (saved !== undefined && props.messages.length > 0) {
    restorePending = false;
    el.scrollTop = saved;
    return;
  }
  el.scrollTo({ top: el.scrollHeight });
}

watch(
  () => [props.channel.id, props.messages.length === 0 ? '' : props.channel.id],
  () => {
    restorePending = true;
    return scrollToStart();
  },
  { immediate: true }
);

// A search result scrolls to its message and flashes it.
watch(
  () => props.focusId,
  async (id) => {
    if (!id) return;
    await nextTick();
    const el = scroller.value?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el || !scroller.value) return;
    scroller.value.scrollTop = Math.max(0, el.offsetTop - scroller.value.offsetTop - 80);
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  }
);

// After a channel loads, the anchor may arrive one tick later; retry once it does.
watch(
  () => props.unreadFromId,
  () => scrollToStart()
);

// Loading older messages must not throw the reader back to where they were: remember the
// distance from the bottom before the page grows, restore it after.
let anchorFromBottom: number | null = null;
function onScroll(): void {
  const el = scroller.value;
  if (!el) return;
  scrollMemory.set(props.channel.id, el.scrollTop);
  if (el.scrollTop < 200 && props.hasMore && !props.loadingOlder) {
    anchorFromBottom = el.scrollHeight - el.scrollTop;
    emit('load-older');
  }
}
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (anchorFromBottom === null || !scroller.value) return;
    scroller.value.scrollTop = scroller.value.scrollHeight - anchorFromBottom;
    anchorFromBottom = null;
  }
);
</script>

<template>
  <div class="list" ref="scroller" @click.self="selected = null; pickerFor = null; menuFor = null" @scroll.passive="onScroll">
    <div v-if="channel.encrypted" class="encrypted">
      <div class="enc-icon"><Icon name="lock" :size="26" /></div>
      <h2>Encrypted channel</h2>
      <p>
        Messages here are encrypted per channel. This device holds no keys, so the decrypted text
        cannot be shown — and nothing can be sent into this channel either, so that no plaintext
        ever lands in an encrypted place.
      </p>
      <button class="ghost">Link this device</button>
    </div>

    <template v-else>
      <div class="intro">
        <div class="intro-icon"><Icon name="hash" :size="26" /></div>
        <h2>{{ live ? '#' + channel.name : 'Start of #' + channel.name }}</h2>
        <p v-if="!live">Skin prototype. The data is a mock — no session is attached.</p>
      </div>

      <!-- Above the oldest message: this end of the list is where history stops. -->
      <div v-if="loadingOlder" class="older-hint">Loading earlier messages…</div>
      <div v-else-if="hasMore === false && messages.length" class="older-hint">Start of the channel</div>

      <template v-for="m in messages" :key="m.id">
        <div v-if="m.id === unreadFromId" class="unread-divider"><span>New messages</span></div>
      <article
        class="msg"
        :data-mid="m.id"
        :class="{ grouped: m.grouped, mention: m.mention, system: m.system, selected: selected === m.id }"
        @click="selected = selected === m.id ? null : m.id"
      >
        <div class="avatar-col">
          <div v-if="!m.grouped" class="avatar" :style="{ background: m.author.color }">
            <img
              v-if="m.author.avatarUrl && !brokenAvatars[m.author.name]"
              :src="m.author.avatarUrl"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="brokenAvatars[m.author.name] = true"
            />
            <template v-else>{{ m.author.initial }}</template>
          </div>
          <span v-else class="time-hover">{{ m.time }}</span>
        </div>
        <div class="body">
          <div v-if="m.replyTo" class="quote">
            <span class="quote-author">{{ m.replyTo.author }}</span>
            <span class="quote-text">{{ m.replyTo.text }}</span>
          </div>
          <header v-if="!m.grouped && !m.system" class="meta">
            <span class="author">{{ m.author.name }}</span>
            <span v-if="m.author.role" class="role" :class="m.author.role">{{ m.author.role === 'admin' ? 'admin' : 'mod' }}</span>
            <span v-else-if="m.author.bot" class="role bot">bot</span>
            <span class="time">{{ m.time }}</span>
            <span v-if="m.edited" class="edited">(edited)</span>
          </header>
          <p v-if="m.text" class="text">
            <template v-for="(seg, i) in segments(m)" :key="i">
              <code v-if="seg.kind === 'code'">{{ seg.text }}</code>
              <strong v-else-if="seg.kind === 'bold'">{{ seg.text }}</strong>
              <em v-else-if="seg.kind === 'italic'">{{ seg.text }}</em>
              <button
                v-else-if="seg.kind === 'mention'"
                type="button"
                class="mention mention-btn"
                @click.stop="emit('mention', seg.text.slice(1))"
              >
                {{ seg.text }}
              </button>
              <button
                v-else-if="seg.kind === 'channel'"
                type="button"
                class="mention channel-btn"
                @click.stop="emit('channel', seg.text.slice(1))"
              >
                {{ seg.text }}
              </button>
              <a
                v-else-if="seg.kind === 'link' && safeHref(seg.href)"
                :href="safeHref(seg.href) ?? undefined"
                target="_blank"
                rel="noreferrer noopener"
                >{{ seg.text }}</a
              >
              <template v-else>{{ seg.text }}</template>
            </template>
          </p>
          <div v-if="m.files?.length" class="files">
            <a
              v-for="f in m.files"
              :key="f.name"
              class="file-chip"
              :href="f.url || undefined"
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name="clip" :size="14" />
              <span>{{ f.name }}</span>
            </a>
          </div>
          <div v-if="m.reactions?.length" class="chips">
            <button
              v-for="r in m.reactions"
              :key="r.emoji"
              class="reaction"
              :class="{ mine: r.mine }"
              @click.stop="emit('react', m, r.emoji, r.mine)"
            >
              <span class="reaction-emoji">{{ r.emoji }}</span>
              <span class="reaction-count">{{ r.count }}</span>
            </button>
          </div>
          <PollCard v-if="m.poll" :poll="m.poll" @vote="(id, ids) => emit('vote', id, ids)" />
          <!-- A thread is otherwise invisible in the channel; this line is the only sign that
               nine of the answers moved somewhere else. -->
          <button v-if="threadCounts?.[m.id]" class="thread-link" @click.stop="emit('thread', m)">
            {{ threadCounts[m.id] }} {{ threadCounts[m.id] === 1 ? 'reply' : 'replies' }} in thread
          </button>
          <div v-if="m.images?.length" class="images">
            <template v-for="(src, i) in m.images" :key="i">
              <!-- Opening the image in place beats `target="_blank"`: inside the shell a new
                   window is an external browser at best, and a dead end at worst. -->
              <button v-if="!broken[src]" class="shot" type="button" @click="lightbox = src">
                <img :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" @error="broken[src] = true" />
              </button>
              <span v-else class="shot-missing">Attachment unavailable — the link has expired</span>
            </template>
          </div>
        </div>
        <div v-if="menuFor === m.id" class="picker menu">
          <button @click.stop="menuFor = null; emit('edit', m)">Edit</button>
          <button class="danger" @click.stop="menuFor = null; emit('delete', m)">Delete</button>
        </div>
        <EmojiPicker
          v-if="pickerFor === m.id"
          :custom="customEmoji"
          mode="reaction"
          @pick="(v) => pickCustom(m, v)"
          @close="pickerFor = null"
        />
        <div class="tools">
          <button title="Reply" @click.stop="emit('reply', m)"><Icon name="reply" :size="15" /></button>
          <button title="Add a reaction" @click.stop="pickerFor = pickerFor === m.id ? null : m.id">
            <Icon name="smile" :size="15" />
          </button>
          <!-- Pinning is a permission on the instance: the button is always there and a refusal
               comes back as an error, which beats hiding a control nobody understands. -->
          <button
            :title="m.pinned ? 'Unpin message' : 'Pin message'"
            :class="{ on: m.pinned }"
            @click.stop="emit('pin', m, !m.pinned)"
          >
            <Icon name="pin" :size="15" />
          </button>
          <button title="Reply in thread" @click.stop="emit('thread', m)">
            <Icon name="thread" :size="15" />
          </button>
          <button v-if="isMine(m)" title="More" @click.stop="menuFor = menuFor === m.id ? null : m.id; pickerFor = null">
            <Icon name="dots" :size="15" />
          </button>
        </div>
      </article>
      </template>
    </template>
  </div>
  <div v-if="lightbox" class="lightbox" @click="lightbox = null">
    <img :src="lightbox" alt="" referrerpolicy="no-referrer" />
    <button class="lb-close" aria-label="Close" @click.stop="lightbox = null">
      <Icon name="close" :size="20" />
    </button>
  </div>
</template>

<style scoped>
.list { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: var(--sp-300) var(--sp-400) var(--sp-500); }
@media (hover: hover) and (pointer: fine) { .list { scrollbar-gutter: stable; } }
.intro { margin: var(--sp-600) 0 var(--sp-500); }
.intro-icon {
  width: 48px; height: 48px;
  display: grid; place-items: center;
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text-secondary);
  margin-bottom: var(--sp-300);
}
.intro h2 { margin: 0 0 var(--sp-100); font-size: var(--fs-lg); }
.intro p { margin: 0; color: var(--text-tertiary); font-size: var(--fs-sm); }

.msg {
  position: relative;
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: var(--sp-300);
  margin-top: var(--sp-300);
  padding: var(--sp-100) var(--sp-200) var(--sp-100) var(--sp-300);
  border-radius: var(--radius-sm);
}
.msg.grouped { margin-top: 0; padding-top: 0; padding-bottom: 0; }
.msg.mention {
  background: color-mix(in srgb, var(--primary-container) 22%, transparent);
  box-shadow: inset 2px 0 0 var(--primary-main);
}
.msg.mention::before { display: none; }
/* A mention or a #channel in the text is a link to something: it answers a tap. */
.mention-btn,
.channel-btn {
  padding: 0 3px;
  border-radius: var(--radius-xs);
  background: var(--primary-container);
  color: var(--primary-on-container);
  font: inherit;
  cursor: pointer;
}
.mention-btn:hover,
.channel-btn:hover { text-decoration: underline; }
.avatar-col { position: relative; display: flex; justify-content: center; }
.avatar {
  width: 38px; height: 38px;
  overflow: hidden;
  display: grid; place-items: center;
  border-radius: var(--radius-round);
  color: #1a1a1a;
  font-weight: 700;
  font-size: var(--fs-sm);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.time-hover { font-size: 10px; color: var(--text-tertiary); padding-top: 5px; }
.body { min-width: 0; }
.meta { display: flex; align-items: baseline; gap: var(--sp-200); margin-bottom: 1px; }
.author { font-weight: 600; color: var(--text); }
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
.role.bot { background: var(--surface-2, #2a2a2e); color: var(--text-tertiary); }
.time { font-size: var(--fs-xs); color: var(--text-tertiary); }
.text { margin: 0; color: var(--text); line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
.text a { color: var(--primary-main); text-decoration: underline; text-underline-offset: 2px; }
.text a:hover { text-decoration-thickness: 2px; }
.text code {
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: var(--sfv-active);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.92em;
}
.text .mention {
  padding: 0 3px;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--primary-container) 55%, transparent);
  color: var(--primary-on-container);
}
.picker.menu {
  top: -10px;
  flex-direction: column;
  flex-wrap: nowrap;
  max-width: 140px;
  padding: 3px;
}
.picker.menu button {
  width: 100%;
  height: 30px;
  justify-content: flex-start;
  padding: 0 var(--sp-200);
  font-size: var(--fs-sm);
  color: var(--text);
}
.picker.menu button.danger { color: var(--critical); }
.edited { color: var(--text-tertiary); font-size: var(--fs-xs); }
.flash { animation: flash-bg 1.6s ease-out; }
@keyframes flash-bg {
  from { background: color-mix(in srgb, var(--primary-container) 65%, transparent); }
  to { background: transparent; }
}
.picker {
  position: absolute;
  right: var(--sp-300);
  top: -46px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 260px;
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--sfv-line);
  background: var(--sfv-active);
  box-shadow: var(--shadow-1);
}
.picker button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-xs);
  font-size: 16px;
  line-height: 1;
}
.picker button:hover { background: var(--sfv-hover); }
.picker button.mine { background: color-mix(in srgb, var(--primary-container) 55%, transparent); }
.files { display: flex; flex-wrap: wrap; gap: var(--sp-200); margin-top: var(--sp-200); }
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-100);
  max-width: 260px;
  padding: var(--sp-100) var(--sp-200);
  border: 1px solid var(--sfv-line);
  border-radius: var(--radius-md);
  background: var(--sfv-container);
  color: var(--text);
  font-size: var(--fs-sm);
  text-decoration: none;
}
.file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chips { display: flex; flex-wrap: wrap; gap: var(--sp-100); margin-top: var(--sp-200); }
.reaction {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border: 1px solid var(--sfv-line);
  border-radius: var(--radius-round);
  background: var(--sfv-container);
  font-size: var(--fs-sm);
  line-height: 1.6;
}
.reaction.mine { border-color: var(--primary-main); background: color-mix(in srgb, var(--primary-container) 45%, transparent); }
.reaction-count { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.reaction-emoji { font-size: 13px; }
.quote {
  display: flex;
  align-items: baseline;
  gap: var(--sp-200);
  margin: 0 0 2px;
  padding-left: var(--sp-200);
  border-left: 2px solid var(--sfv-line);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
  min-width: 0;
}
.quote-author { color: var(--text-secondary); font-weight: 600; flex: none; }
.quote-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unread-divider {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin: var(--sp-300) 0;
  color: var(--critical);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.unread-divider::before,
.unread-divider::after { content: ''; flex: 1; height: 1px; background: var(--critical-container); }
.older-hint {
  padding: var(--sp-300) 0;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-xs);
}
.shot { display: block; padding: 0; background: none; }
/* Above the sheets and the composer: what you tapped came from the message, so it owns the
   screen until dismissed. */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: var(--sp-300);
  background: rgb(0 0 0 / 0.92);
  animation: fade-in 120ms ease-out;
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.lightbox img { max-width: 100%; max-height: 100%; object-fit: contain; }
.lb-close {
  position: absolute;
  top: calc(var(--sp-400) + env(safe-area-inset-top, 0px));
  right: var(--sp-300);
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: rgb(0 0 0 / 0.55);
  color: #fff;
}
.shot-missing {
  display: inline-block;
  padding: var(--sp-200) var(--sp-300);
  border: 1px dashed var(--sfv-line);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
}
.images { display: flex; flex-wrap: wrap; gap: var(--sp-200); margin-top: var(--sp-200); }
.images img {
  max-width: min(320px, 100%);
  max-height: 320px;
  border-radius: var(--radius-md);
  display: block;
}
.msg.system .text { color: var(--text-tertiary); font-size: var(--fs-sm); font-style: italic; }
.msg.system .avatar-col { visibility: hidden; }
.tools {
  position: absolute;
  top: -14px;
  right: var(--sp-300);
  display: none;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--sfv-active);
  border: 1px solid var(--sfv-line);
  box-shadow: var(--shadow-1);
}
/* Desktop hovers, a phone taps: the toolbar belongs to one message either way. A duplicated
   `.tools { display: flex }` from an earlier edit made every message carry one, and the
   floating rows covered the text on a phone. */
@media (hover: hover) and (pointer: fine) {
  .msg:hover { background: var(--sf-hover); }
  .msg:hover .tools { display: flex; }
}
.msg.selected { background: var(--sfv-container); }
.msg.selected .tools { display: flex; }
.tools button {
  width: 26px; height: 26px;
  display: grid; place-items: center;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
}
.tools button:hover { background: var(--sfv-line); color: var(--text); }

.encrypted {
  max-width: 520px;
  margin: 12vh auto 0;
  text-align: center;
  color: var(--text-secondary);
}
.enc-icon {
  width: 56px; height: 56px;
  margin: 0 auto var(--sp-400);
  display: grid; place-items: center;
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--primary-main);
}
.encrypted h2 { margin: 0 0 var(--sp-200); font-size: var(--fs-lg); color: var(--text); }
.encrypted p { margin: 0 0 var(--sp-500); font-size: var(--fs-sm); line-height: 1.6; }
.ghost {
  padding: var(--sp-200) var(--sp-400);
  border-radius: var(--radius-sm);
  border: 1px solid var(--sfv-line);
  color: var(--text);
  font-size: var(--fs-sm);
}
.ghost:hover { background: var(--sfv-container); }
</style>
