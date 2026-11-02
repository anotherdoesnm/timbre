<script setup lang="ts">
import { computed } from 'vue';
import { members } from '../data/mock';

const online = computed(() => members.filter((m) => m.status !== 'offline'));
const offline = computed(() => members.filter((m) => m.status === 'offline'));
</script>

<template>
  <aside class="members">
    <section v-for="g in [{ t: `Online — ${online.length}`, list: online }, { t: `Offline — ${offline.length}`, list: offline }]" :key="g.t">
      <div class="title">{{ g.t }}</div>
      <div v-for="m in g.list" :key="m.name" class="row" :class="{ dim: m.status === 'offline' }">
        <div class="av" :style="{ background: m.color }">{{ m.initial }}</div>
        <div class="who">
          <span class="name">{{ m.name }}</span>
          <span v-if="m.role" class="role" :class="m.role">{{ m.role === 'admin' ? 'admin' : 'mod' }}</span>
        </div>
        <span v-if="m.status === 'idle'" class="idle" title="Away" />
      </div>
    </section>
  </aside>
</template>

<style scoped>
.members {
  width: var(--members-width);
  overflow-y: auto;
  padding: var(--sp-300) var(--sp-200);
  background: var(--sf-container);
  border-left: 1px solid var(--sf-line);
}
.title {
  padding: var(--sp-200) var(--sp-200) var(--sp-100);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  padding: var(--sp-100) var(--sp-200);
  border-radius: var(--radius-sm);
}
.row:hover { background: var(--sf-hover); }
.row.dim { opacity: 0.45; }
.av {
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border-radius: var(--radius-round);
  color: #1a1a1a;
  font-size: var(--fs-xs);
  font-weight: 700;
}
.who { display: flex; align-items: center; gap: var(--sp-200); min-width: 0; }
.name { font-size: var(--fs-sm); color: var(--text); }
.role {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: var(--radius-xs);
}
.role.mod { background: var(--primary-container); color: var(--primary-on-container); }
.role.admin { background: var(--critical-container); color: #f5d6d6; }
.idle {
  width: 8px; height: 8px;
  border-radius: var(--radius-round);
  background: var(--warning);
  border: 2px solid var(--sf-container);
}
</style>
