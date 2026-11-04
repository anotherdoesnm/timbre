<script setup lang="ts">
/**
 * The mark on a "Continue with …" button.
 *
 * Four cases, in order: the instance gave an icon URL (its own provider), the provider is one of
 * the built-ins whose logo everybody recognises, or there is nothing to show and the initials
 * stand in. A letter tile for GitHub next to a real GitHub logo in the same list of buttons looks
 * like a bug, so the built-ins get their marks here.
 *
 * The paths are the monochrome marks from Simple Icons (CC0), which is also why they sit on the
 * same neutral tile instead of carrying brand colours: this client has one accent, and three
 * differently coloured buttons would fight it.
 */
const props = defineProps<{ id: string; name: string; icon?: string }>();

const MARKS: Record<string, string> = {
  github:
    'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3',
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.78 4.13-1.15 1.15-2.93 2.4-6.06 2.4-4.82 0-8.6-3.89-8.6-8.72s3.78-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05z',
  twitch:
    'M11.57 4.71h1.72v5.15h-1.72zm4.72 0H18v5.15h-1.71zM6 0L1.71 4.29v15.43h5.15V24l4.28-4.29h3.43L22.29 12V0zm14.57 11.14-3.43 3.43h-3.43l-3 3v-3H6.86V1.71h13.71z',
};

/** `custom:dex` → `dex`, so an instance's provider can be recognised by its short id too. */
const bare = (id: string): string => id.replace(/^custom:/, '').toLowerCase();
const mark = (): string | undefined => MARKS[bare(props.id)];
const initials = (): string => props.name.slice(0, 2).toUpperCase();
</script>

<template>
  <span class="mark">
    <img v-if="props.icon" :src="props.icon" alt="" referrerpolicy="no-referrer" />
    <svg v-else-if="mark()" viewBox="0 0 24 24" aria-hidden="true"><path :d="mark()" /></svg>
    <template v-else>{{ initials() }}</template>
  </span>
</template>

<style scoped>
.mark {
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--sf-base);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  overflow: hidden;
}
.mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mark svg { width: 16px; height: 16px; fill: currentColor; }
</style>
