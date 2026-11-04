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
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  twitch:
    'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
};

/** `custom:dex` → `dex`, so an instance's provider can be recognised by its short id too. */
const bare = (id: string): string => id.replace(/^custom:/, '').toLowerCase();
const mark = (): string | undefined => MARKS[bare(props.id)];
const initials = (): string => props.name.slice(0, 2).toUpperCase();
</script>

<template>
  <span class="provider-mark">
    <img v-if="props.icon" :src="props.icon" alt="" referrerpolicy="no-referrer" />
    <svg v-else-if="mark()" viewBox="0 0 24 24" aria-hidden="true"><path :d="mark()" /></svg>
    <template v-else>{{ initials() }}</template>
  </span>
</template>

<style scoped>
/* Not `.mark`: the sign-in screen has its own `.mark` tile (the instance card), and Vue puts a
   parent's scope id on a child component's root element, so the 44px rule reached this span and
   the provider badge came out twice the intended size. */
.provider-mark {
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
.provider-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
.provider-mark svg { width: 16px; height: 16px; fill: currentColor; }
</style>
