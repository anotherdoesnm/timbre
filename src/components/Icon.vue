<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });

const paths: Record<string, string> = {
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  volume: 'M11 5 6 9H3v6h3l5 4zM16 8a5 5 0 0 1 0 8',
  lock: 'M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M17 5a3 3 0 0 1 0 6M22 20a5 5 0 0 0-4-4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 10h.01M15 10h.01M8.5 14.5a4 4 0 0 0 7 0',
  clip: 'M8.5 12.5 15 6a3 3 0 0 1 4.2 4.2l-7.1 7.1a5 5 0 0 1-7.1-7.1l7.1-7.1',
  send: 'M4 12 20 4l-4 16-4-6z',
  chevron: 'm6 9 6 6 6-6',
  mic: 'M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0',
  thread: 'M4 6h16M4 12h10M4 18h7M16 14l4 3-4 3z',
  sticker: 'M4 4h16v10l-6 6H4zM14 20v-6h6',
  poll: 'M5 20V10M12 20V4M19 20v-7',
  pin: 'M9 3h6l-1 6 4 4H6l4-4zM12 13v8',
  'bell-off': 'M9 9a6 6 0 0 1 9 5c0 2 .3 3.2 1 4M6.6 6.6A6 6 0 0 0 6 9c0 5-2 6-2 6h13M10 20a2 2 0 0 0 4 0M3 3l18 18',
  shield: 'M12 3l7 3v6c0 4-3 6-7 9-4-3-7-5-7-9V6z',
  at: 'M12 21a9 9 0 1 0-9-9M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM16 8v5a2 2 0 0 0 4 0',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  inbox: 'M3 12h5l2 3h4l2-3h5M3 12l3-7h12l3 7v6H3z',
  reply: 'M9 10 4 15l5 5M4 15h9a6 6 0 0 0 6-6V5',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17.5 19 7',
};
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[props.name] ?? ''" />
  </svg>
</template>
