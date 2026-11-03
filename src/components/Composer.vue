<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{ disabled?: boolean; channelName: string; sending?: boolean }>();
const emit = defineEmits<{ (e: 'send', text: string): void }>();
const text = ref('');

function send() {
  const body = text.value.trim();
  if (props.disabled || !body || props.sending) return;
  emit('send', body);
  text.value = '';
}
</script>

<template>
  <div class="wrap">
    <div class="box" :class="{ disabled }">
      <textarea
        v-model="text"
        :disabled="disabled"
        rows="1"
        :placeholder="disabled ? 'Encrypted channel — no keys on this device' : `Message #${channelName}`"
        @keydown.enter.exact.prevent="send"
      />
      <div class="bar">
        <div class="left">
          <button :disabled="disabled" title="Attach"><Icon name="plus" :size="18" /></button>
          <button :disabled="disabled" title="File"><Icon name="clip" :size="18" /></button>
          <button :disabled="disabled" title="Emoji"><Icon name="smile" :size="18" /></button>
        </div>
        <div class="right">
          <button :disabled="disabled" title="Voice message"><Icon name="mic" :size="18" /></button>
          <button class="send" :disabled="disabled || sending || !text.trim()" title="Send" @click="send">
            <Icon name="send" :size="17" />
          </button>
        </div>
      </div>
    </div>
  </div>
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
