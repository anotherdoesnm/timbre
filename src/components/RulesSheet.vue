<script setup lang="ts">
import Icon from './Icon.vue';
import type { ServerWelcome } from '../services/data';

/**
 * The server's rules, with the one control the instance is waiting for.
 *
 * A member who joined after a server started requiring acceptance cannot post until
 * `rules_accepted_at` is set; the send guard raises `RULES_NOT_ACCEPTED`, which is a confusing way
 * to learn about a house rule. This is the screen the official client shows.
 */
defineProps<{ welcome: ServerWelcome; busy?: boolean; error?: string }>();
const emit = defineEmits<{ (e: 'accept'): void; (e: 'close'): void }>();
</script>

<template>
  <div class="backdrop">
    <div class="sheet" role="dialog" aria-label="Server rules">
      <header>
        <span>{{ welcome.name ?? 'This server' }}</span>
        <button class="close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="18" /></button>
      </header>

      <p v-if="welcome.message" class="lead">{{ welcome.message }}</p>

      <ol class="rules">
        <li v-for="(rule, i) in welcome.rules" :key="i">
          <span class="title">{{ rule.title }}</span>
          <span v-if="rule.description" class="description">{{ rule.description }}</span>
        </li>
      </ol>
      <p v-if="!welcome.rules.length" class="lead">
        This server asks new members to accept its rules before posting, but has not written any
        down.
      </p>

      <p v-if="error" class="error">{{ error }}</p>

      <button class="primary" :disabled="busy" @click="emit('accept')">
        {{ busy ? 'Saving…' : 'I understand and agree' }}
      </button>
      <p class="fine">You can keep reading without accepting; posting is what waits.</p>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 47;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.55);
}
.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  padding: var(--sp-200) var(--sp-300) calc(var(--sp-400) + var(--nav-inset, 0px));
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-200);
  padding: var(--sp-200) 0 var(--sp-300);
  color: var(--text);
  font-size: var(--fs-lg);
  font-weight: 600;
}
.close { color: var(--text-tertiary); }
.lead { margin: 0 0 var(--sp-300); color: var(--text-secondary); white-space: pre-wrap; }
.rules { margin: 0 0 var(--sp-400); padding-left: var(--sp-400); color: var(--text-secondary); }
.rules li { margin-bottom: var(--sp-300); }
.title { display: block; color: var(--text); font-weight: 600; }
.description { display: block; font-size: var(--fs-sm); }
.error { margin: 0 0 var(--sp-300); color: var(--critical); font-size: var(--fs-sm); }
.primary {
  width: 100%;
  padding: var(--sp-300);
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:disabled { opacity: 0.6; }
.fine { margin: var(--sp-200) 0 0; color: var(--text-tertiary); font-size: var(--fs-xs); }
</style>
