<script setup lang="ts">
import { ref, watch } from 'vue';
import Icon from './Icon.vue';
import { clearDraft, loadDraft, saveDraft } from '../services/drafts';
import EmojiPicker from './EmojiPicker.vue';
import type { CustomEmoji } from '../services/emoji';

const props = defineProps<{
  disabled?: boolean;
  channelName: string;
  sending?: boolean;
  /** An attachment is still uploading: sending now would post a message pointing at nothing. */
  uploading?: boolean;
  replyTo?: { author: string; text: string } | null;
  attached?: { path: string; name: string }[];
  /** When set, the composer edits this message instead of sending a new one. */
  editing?: { id: string; text: string } | null;
  /** Draft identity: the instance and channel the text belongs to. */
  draftInstance?: string;
  draftChannel?: string;
  /** Custom emoji of the instance, for the picker. */
  customEmoji?: CustomEmoji[];
}>();
const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'cancel-reply'): void;
  (e: 'attach', file: File): void;
  (e: 'remove-attachment', path: string): void;
  (e: 'save-edit', text: string): void;
  (e: 'create-poll'): void;
  (e: 'stickers'): void;
  (e: 'cancel-edit'): void;
}>();
const text = ref(loadDraft(props.draftInstance, props.draftChannel));
const emojiOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let draftTimer: ReturnType<typeof setTimeout> | null = null;

// Editing fills the box with the current text once and leaves it alone afterwards, so typing
// is not overwritten by a re-render.
watch(
  () => props.editing?.id ?? null,
  () => {
    text.value = props.editing?.text ?? '';
  },
  { immediate: true }
);

// Saving on every keystroke writes to storage dozens of times a second; 300 ms is below the point
// where losing the text to a crash would hurt.
watch(text, (value) => {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => saveDraft(props.draftInstance, props.draftChannel, value), 300);
});

// Switching channels swaps the draft as well: what was typed belongs to one channel, not the box.
watch(
  () => [props.draftInstance, props.draftChannel] as const,
  ([instance, channel], previous) => {
    if (!previous) return;
    if (draftTimer) clearTimeout(draftTimer);
    saveDraft(previous[0], previous[1], text.value);
    text.value = loadDraft(instance, channel);
  }
);

/** A custom emoji goes in as `:name:` — that is the form every client renders. */
function insertEmoji(value: { char?: string; name?: string }): void {
  emojiOpen.value = false;
  if (value.char) text.value += value.char;
  else if (value.name) text.value += `:${value.name}:`;
}

function submit(): void {
  if (props.editing) {
    const body = text.value.trim();
    if (!body) return;
    emit('save-edit', body);
    return;
  }
  send();
}

function pickFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('attach', file);
  // Same file twice in a row still fires a change event.
  input.value = '';
}

function send() {
  const body = text.value.trim();
  if (props.disabled || props.sending || props.uploading) return;
  if (!body && !props.attached?.length) return;
  emit('send', body);
  text.value = '';
  clearDraft(props.draftInstance, props.draftChannel);
}
</script>

<template>
  <div class="wrap">
    <div class="box" :class="{ disabled }">
      <div v-if="replyTo" class="reply-bar">
        <Icon name="reply" :size="14" />
        <span class="reply-who">{{ replyTo.author }}</span>
        <span class="reply-text">{{ replyTo.text }}</span>
        <button class="reply-close" title="Cancel reply" @click="emit('cancel-reply')">
          <Icon name="close" :size="14" />
        </button>
      </div>
      <div v-if="editing" class="edit-bar">
        <span>Editing message</span>
        <button title="Cancel" @click="emit('cancel-edit')"><Icon name="close" :size="12" /></button>
      </div>
      <div v-if="attached?.length || uploading" class="attached">
        <span v-for="f in attached" :key="f.path" class="attached-chip">
          <Icon name="clip" :size="13" />
          <span class="attached-name">{{ f.name }}</span>
          <button title="Remove" @click="emit('remove-attachment', f.path)">
            <Icon name="close" :size="12" />
          </button>
        </span>
        <span v-if="uploading" class="attached-chip">Uploading…</span>
      </div>
      <textarea
        v-model="text"
        :disabled="disabled"
        rows="1"
        :placeholder="disabled ? 'Encrypted channel — no keys on this device' : `Message #${channelName}`"
        @keydown.enter.exact.prevent="submit"
      />
      <div class="bar">
        <div class="left">
          <button :disabled="disabled" title="More"><Icon name="plus" :size="18" /></button>
          <button :disabled="disabled" title="Attach a file" @click="fileInput?.click()">
            <Icon name="clip" :size="18" />
          </button>
          <input ref="fileInput" type="file" hidden @change="pickFile" />
          <button :disabled="disabled" title="Stickers" @click="emit('stickers')">
            <Icon name="sticker" :size="18" />
          </button>
          <button :disabled="disabled" title="Create a poll" @click="emit('create-poll')">
            <Icon name="poll" :size="18" />
          </button>
          <button :disabled="disabled" title="Emoji" @click="emojiOpen = !emojiOpen">
            <Icon name="smile" :size="18" />
          </button>
        </div>
        <div class="right">
          <button :disabled="disabled" title="Voice message"><Icon name="mic" :size="18" /></button>
          <button
            class="send"
            :disabled="disabled || sending || uploading || (!text.trim() && !attached?.length)"
            :title="editing ? 'Save edit' : 'Send'"
            @click="submit"
          >
            <Icon name="send" :size="17" />
          </button>
        </div>
      </div>
    </div>
  </div>
  <EmojiPicker
    v-if="emojiOpen"
    :custom="customEmoji"
    mode="insert"
    @pick="insertEmoji"
    @close="emojiOpen = false"
  />
</template>

<style scoped>
/* No env(safe-area-inset-bottom) here. Firefox Android reports 48px for it whenever its own
   toolbar is on screen — not a system inset at all — and the composer then floats half a
   centimetre above the bottom. The fixed shell already ends at the visible edge (measured on
   device: inset:0 bottom == innerHeight), so the plain spacing is the whole story. */
.wrap { padding: 0 var(--sp-400) var(--sp-400); }
.box {
  background: var(--sfv-container);
  border: 1px solid var(--sfv-line);
  border-radius: var(--radius-md);
  padding: var(--sp-200) var(--sp-200) var(--sp-100);
  transition: border-color 120ms ease;
}
.box:focus-within { border-color: var(--primary-main); }
.box.disabled { opacity: 0.7; }
textarea {
  width: 100%;
  min-height: 24px;
  max-height: 40vh;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: var(--fs-base);
  line-height: 1.4;
  padding: var(--sp-100) var(--sp-200);
}
textarea::placeholder { color: var(--text-tertiary); }
.edit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: var(--sp-100) var(--sp-200) 0;
  padding: var(--sp-100) var(--sp-200);
  border-left: 2px solid var(--primary-main);
  border-radius: var(--radius-xs);
  background: var(--sfv-active);
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}
.edit-bar button { width: 20px; height: 20px; color: var(--text-tertiary); }
.attached { display: flex; flex-wrap: wrap; gap: var(--sp-100); margin: var(--sp-100) var(--sp-200) 0; }
.attached-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid var(--sfv-line);
  border-radius: var(--radius-round);
  background: var(--sfv-active);
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}
.attached-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.attached-chip button { width: 16px; height: 16px; color: var(--text-tertiary); }
.reply-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin: var(--sp-100) var(--sp-200) 0;
  padding: var(--sp-100) var(--sp-200);
  border-left: 2px solid var(--primary-main);
  border-radius: var(--radius-xs);
  background: var(--sfv-active);
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
}
.reply-who { color: var(--text); font-weight: 600; flex: none; }
.reply-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reply-close { margin-left: auto; width: 22px; height: 22px; color: var(--text-tertiary); }
.bar { display: flex; align-items: center; justify-content: space-between; margin-top: var(--sp-100); }
.left, .right { display: flex; align-items: center; gap: var(--sp-100); }
button {
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
}
button:hover:not(:disabled) { background: var(--sfv-hover); color: var(--text); }
button:disabled { opacity: 0.45; cursor: not-allowed; }
.send {
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  background: var(--primary-main);
  color: var(--primary-on);
}
.send:hover:not(:disabled) { background: var(--primary-hover); color: var(--primary-on); }
</style>
