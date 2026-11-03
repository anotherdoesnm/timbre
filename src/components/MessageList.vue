<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';
import type { Channel, Message } from '../data/mock';
import { parseSegments, safeHref, type Segment } from '../services/markdown';

const props = defineProps<{
  channel: Channel;
  messages: Message[];
  live?: boolean;
  /** First unread message: the view opens here instead of at the bottom. */
  unreadFromId?: string | null;
  hasMore?: boolean;
  loadingOlder?: boolean;
}>();
const emit = defineEmits<{ (e: 'load-older'): void }>();
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
// Which one is shown is decided in CSS by the pointer, not by this file: on a phone only the
// tapped message carries a toolbar, on a mouse the hovered one.

// Where the channel should open: on the first unread message when there is one, otherwise at
// the newest. A channel that jumps to the bottom has hidden everything the person came to read.
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
  el.scrollTo({ top: el.scrollHeight });
}

watch(
  () => [props.channel.id, props.messages.length === 0 ? '' : props.channel.id],
  scrollToStart,
  { immediate: true }
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
  <div class="list" ref="scroller" @click.self="selected = null" @scroll.passive="onScroll">
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
            <img v-if="m.author.avatarUrl" :src="m.author.avatarUrl" alt="" loading="lazy" />
            <template v-else>{{ m.author.initial }}</template>
          </div>
          <span v-else class="time-hover">{{ m.time }}</span>
        </div>
        <div class="body">
          <header v-if="!m.grouped && !m.system" class="meta">
            <span class="author">{{ m.author.name }}</span>
            <span v-if="m.author.role" class="role" :class="m.author.role">{{ m.author.role === 'admin' ? 'admin' : 'mod' }}</span>
            <span class="time">{{ m.time }}</span>
          </header>
          <p v-if="m.text" class="text">
            <template v-for="(seg, i) in segments(m)" :key="i">
              <code v-if="seg.kind === 'code'">{{ seg.text }}</code>
              <strong v-else-if="seg.kind === 'bold'">{{ seg.text }}</strong>
              <em v-else-if="seg.kind === 'italic'">{{ seg.text }}</em>
              <span v-else-if="seg.kind === 'mention'" class="mention">{{ seg.text }}</span>
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
          <div v-if="m.images?.length" class="images">
            <template v-for="(src, i) in m.images" :key="i">
              <a v-if="!broken[src]" :href="src" target="_blank" rel="noreferrer noopener" class="shot">
                <img :src="src" alt="" loading="lazy" @error="broken[src] = true" />
              </a>
              <span v-else class="shot-missing">Attachment unavailable — the link has expired</span>
            </template>
          </div>
        </div>
        <div class="tools">
          <button title="Reply"><Icon name="reply" :size="15" /></button>
          <button title="React"><Icon name="smile" :size="15" /></button>
          <button title="More"><Icon name="dots" :size="15" /></button>
        </div>
      </article>
      </template>
      <div v-if="loadingOlder" class="older-hint">Loading earlier messages…</div>
      <div v-else-if="hasMore === false && messages.length" class="older-hint">Start of the channel</div>
    </template>
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
.shot { display: block; }
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
