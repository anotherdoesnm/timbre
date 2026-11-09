<script setup lang="ts">
import { computed } from 'vue';
import { parseSegments } from '../services/markdown';
import { resolveEmoji, type CustomEmoji } from '../services/emoji';

/**
 * Shortcodes in places that are not a message body: a quote, a conversation's name, the
 * "X started a thread" line.
 *
 * The message list resolves emoji itself (it also asks for names its list did not have), but the
 * small pieces around it were plain text — so a quote of somebody called `🔥y4my4m🔥` read
 * `:fire:y4my4m:fire:` and a DM with an emoji in the name looked like a parsing accident.
 */
const props = defineProps<{
  text: string;
  emoji?: CustomEmoji[];
}>();

const parts = computed(() => {
  const out: { text: string; url?: string }[] = [];
  const pattern = /:([a-z0-9_+-]{1,64}):/gi;
  for (const seg of parseSegments(props.text ?? '')) {
    if (seg.kind !== 'text') {
      out.push({ text: seg.text });
      continue;
    }
    let last = 0;
    for (const match of seg.text.matchAll(pattern)) {
      const url = resolveEmoji(match[1], props.emoji ?? []).url;
      if (!url || match.index === undefined) continue;
      if (match.index > last) out.push({ text: seg.text.slice(last, match.index) });
      out.push({ text: match[0], url });
      last = match.index + match[0].length;
    }
    if (!last) out.push({ text: seg.text });
    else if (last < seg.text.length) out.push({ text: seg.text.slice(last) });
  }
  return out;
});
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <img
      v-if="part.url"
      class="inline-emoji"
      :src="part.url"
      :alt="part.text"
      :title="part.text"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<style scoped>
.inline-emoji {
  width: 1.35em;
  height: 1.35em;
  vertical-align: -0.3em;
  object-fit: contain;
}
</style>
