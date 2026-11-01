<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import { completeSignIn, type Session } from '../services/auth';
import { finishOAuthPopup, isOAuthPopup } from '../services/tauriOAuth';

const props = defineProps<{ query: string; demo: boolean }>();
const emit = defineEmits<{ (e: 'done', session: Session): void; (e: 'cancel'): void }>();

const phase = ref<'working' | 'ok' | 'error'>('working');
// Whatever happens next, this line says which page is rendering and what it received:
// after an OAuth round trip through a webview that is the only reliable evidence.
const diag = `${location.origin}${location.pathname} | hash=${location.hash.slice(0, 90) || '-'} | query=${
  location.search.slice(0, 90) || '-'
}`;
const error = ref('');
const who = ref('');

onMounted(async () => {
  if (props.demo) {
    await new Promise((r) => setTimeout(r, 500));
    who.value = 'kirill · GitHub · har.mony.lol';
    phase.value = 'ok';
    return;
  }
  const params = new URLSearchParams(props.query);
  try {
    const session = await completeSignIn({
      code: params.get('code') ?? undefined,
      accessToken: params.get('access_token') ?? undefined,
      refreshToken: params.get('refresh_token') ?? undefined,
    });
    who.value = `${session.user?.user_metadata?.user_name ?? session.user?.email ?? 'аккаунт'} · ${
      session.provider ?? 'oauth'
    } · ${session.instance}`;
    phase.value = 'ok';
    if (await isOAuthPopup()) {
      await finishOAuthPopup();
      return;
    }
    emit('done', session);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    phase.value = 'error';
  }
});
</script>

<template>
  <div class="auth">
    <div class="card">
      <div class="mark" :class="phase">
        <Icon v-if="phase === 'ok'" name="shield" :size="22" />
        <Icon v-else-if="phase === 'error'" name="lock" :size="22" />
        <Icon v-else name="users" :size="22" />
      </div>

      <h1 v-if="phase === 'working'">Завершаем вход…</h1>
      <h1 v-else-if="phase === 'ok'">Вход выполнен</h1>
      <h1 v-else>Не получилось</h1>

      <p v-if="phase === 'working'" class="sub">Обмениваем код на сессию с инстансом.</p>
      <p v-else-if="phase === 'ok'" class="sub">{{ who }}</p>
      <p v-else class="sub">{{ error }}</p>

      <button v-if="phase === 'ok'" class="primary" @click="emit('done', {} as Session)">Продолжить</button>
      <button v-else-if="phase === 'error'" class="primary" @click="emit('cancel')">Вернуться ко входу</button>
      <div v-else class="spinner" />

      <p class="diag">{{ diag }}</p>
    </div>
  </div>
</template>

<style scoped>
.auth {
  height: 100%;
  display: grid;
  place-items: center;
  padding: var(--sp-600);
  background:
    radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--primary-container) 45%, transparent) 0%, transparent 60%),
    var(--bg-container);
}
.card {
  width: 100%;
  max-width: 420px;
  text-align: center;
  background: var(--sf-container);
  border: 1px solid var(--sf-line);
  border-radius: var(--radius-xl);
  padding: var(--sp-600);
  box-shadow: var(--shadow-3);
}
.mark {
  width: 44px; height: 44px;
  margin: 0 auto var(--sp-400);
  display: grid; place-items: center;
  border-radius: var(--radius-lg);
  background: var(--sfv-container);
  color: var(--text-secondary);
}
.mark.ok { background: var(--success); color: #0f3d2a; }
.mark.error { background: var(--critical-container); color: #f5d6d6; }
h1 { margin: 0 0 var(--sp-200); font-size: 19px; }
.sub { margin: 0 0 var(--sp-500); color: var(--text-tertiary); font-size: var(--fs-sm); line-height: 1.5; word-break: break-word; }
.primary {
  width: 100%;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
}
.primary:hover { background: var(--primary-hover); }
.diag {
  margin: var(--sp-400) 0 0;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-tertiary);
  overflow-wrap: anywhere;
  text-align: left;
}
.spinner {
  width: 22px; height: 22px;
  margin: 0 auto;
  border-radius: var(--radius-round);
  border: 2px solid var(--sfv-line);
  border-top-color: var(--primary-main);
  animation: spin 700ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
