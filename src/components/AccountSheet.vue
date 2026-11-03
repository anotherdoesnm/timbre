<script setup lang="ts">
import Icon from './Icon.vue';

defineProps<{ name: string; instance: string; role?: 'admin' | 'mod' | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'signout'): void }>();
</script>

<template>
  <!-- The account corner. On a phone it was hidden together with the rail, which left no way
       to see who you are signed in as — and no way to sign out at all. -->
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-label="Account">
      <header>
        <span>Account</span>
        <button class="close" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="18" />
        </button>
      </header>
      <div class="who">
        <span class="tile">{{ name.slice(0, 1).toUpperCase() }}</span>
        <span class="text">
          <span class="name">{{ name }}</span>
          <span class="meta">{{ instance }}<template v-if="role"> · {{ role }}</template></span>
        </span>
      </div>
      <button class="row danger" @click="emit('signout')">
        <Icon name="close" :size="16" />
        <span>Sign out</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 0.45);
}
.sheet {
  width: 100%;
  max-width: 420px;
  max-height: 70vh;
  overflow-y: auto;
  padding: var(--sp-200) var(--sp-200) var(--sp-500);
  background: var(--sf-container);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);
  animation: sheet-up 160ms ease-out;
}
@keyframes sheet-up { from { transform: translateY(12px); opacity: 0.6; } to { transform: none; opacity: 1; } }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-200) var(--sp-300) var(--sp-300);
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
  padding: var(--sp-200) var(--sp-300) var(--sp-300);
}
.tile {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-round);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 700;
}
.text { display: flex; flex-direction: column; min-width: 0; }
.name { font-weight: 600; }
.meta { color: var(--text-tertiary); font-size: var(--fs-sm); }
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
.row.danger { color: var(--critical); }
</style>
