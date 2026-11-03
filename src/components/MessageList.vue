<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';
import type { Channel, Message } from '../data/mock';

const props = defineProps<{ channel: Channel; messages: Message[]; live?: boolean }>();
const scroller = ref<HTMLElement | null>(null);
// On a phone there is no hover: the toolbar would sit on every message forever. A tap
// selects one message and shows its toolbar.
const selected = ref<string | null>(null);
// matchMedia, not a CSS media query alone: the webview reports hover capability reliably,
// while the hover rule kept winning on Android.
const touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

watch(
  () => props.channel.id,
  async () => {
    await nextTick();
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight });
  },
  { immediate: true }
);
</script>

<template>
  <div class="list" ref="scroller" :class="{ touch }">
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

      <article
        v-for="m in messages"
        :key="m.id"
        class="msg"
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
          <p v-if="m.text" class="text">{{ m.text }}</p>
          <div v-if="m.images?.length" class="images">
            <img v-for="(src, i) in m.images" :key="i" :src="src" alt="" loading="lazy" />
          </div>
        </div>
        <div class="tools">
          <button title="Reply"><Icon name="reply" :size="15" /></button>
          <button title="React"><Icon name="smile" :size="15" /></button>
          <button title="More"><Icon name="dots" :size="15" /></button>
        </div>
      </article>
    </template>
  </div>
</template>

<style scoped>
.list { flex: 1; overflow-y: auto; padding: var(--sp-300) var(--sp-400) var(--sp-500); scrollbar-gutter: stable; }
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
.msg:hover { background: var(--sf-hover); }
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
.time-hover { font-size: 10px; color: var(--text-tertiary); opacity: 0; padding-top: 5px; }
.msg:hover .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.time-hover { opacity: 1; }
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
.text { margin: 0; color: var(--text); line-height: 1.5; overflow-wrap: anywhere; }
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
.msg:hover .images { display: flex; flex-wrap: wrap; gap: var(--sp-200); margin-top: var(--sp-200); }
.images img {
  max-width: min(320px, 100%);
  max-height: 320px;
  border-radius: var(--radius-md);
  display: block;
}
.msg.system .text { color: var(--text-tertiary); font-size: var(--fs-sm); font-style: italic; }
.msg.system .avatar-col { visibility: hidden; }
.tools { display: flex; }
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
