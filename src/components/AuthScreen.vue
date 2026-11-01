<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import { discoverInstance, type InstanceInfo } from '../services/discover';
import { navigateToSignIn } from '../services/auth';

const emit = defineEmits<{ (e: 'authenticated'): void }>();

const demo = new URLSearchParams(location.search).get('demo') === '1';
const host = ref('');
const loading = ref(false);
const error = ref('');
const instance = ref<InstanceInfo | null>(null);
const showPassword = ref(false);
const email = ref('');
const password = ref('');

const providerMeta: Record<string, { label: string; badge: string }> = {
  github: { label: 'GitHub', badge: 'GH' },
  google: { label: 'Google', badge: 'G' },
};

const providers = computed(() =>
  (instance.value?.providers ?? []).map((id) => ({
    id,
    label: providerMeta[id]?.label ?? id,
    badge: providerMeta[id]?.badge ?? id.slice(0, 2).toUpperCase(),
  }))
);

async function submit() {
  if (loading.value) return;
  error.value = '';
  loading.value = true;
  const result = await discoverInstance(host.value, { demo });
  loading.value = false;
  if (result.ok) instance.value = result.instance;
  else error.value = result.error.message;
}

async function startProvider(id: string) {
  const inst = instance.value;
  if (!inst) return;
  if (demo) {
    location.hash = 'auth/callback';
    return;
  }
  await navigateToSignIn(inst, id);
}

function reset() {
  instance.value = null;
  showPassword.value = false;
  error.value = '';
}
</script>

<template>
  <div class="auth">
    <div class="card">
      <div class="mark">
        <Icon name="hash" :size="22" />
      </div>

      <h1>Timbre</h1>
      <p class="sub">Вход в Harmony. Введите адрес инстанса — Timbre сам найдёт его API и способы входа.</p>

      <form v-if="!instance" @submit.prevent="submit">
        <label class="label" for="host">Инстанс</label>
        <div class="field" :class="{ invalid: !!error }">
          <Icon name="search" :size="16" />
          <input
            id="host"
            v-model="host"
            placeholder="har.mony.lol"
            autocomplete="off"
            spellcheck="false"
            :disabled="loading"
            @input="error = ''"
          />
        </div>
        <button class="primary" type="submit" :disabled="loading || !host.trim()">
          {{ loading ? 'Проверяем…' : 'Продолжить' }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>

      <div v-else class="found">
        <div class="inst">
          <div class="inst-avatar">{{ instance.name.slice(0, 1) }}</div>
          <div class="inst-text">
            <div class="inst-name">{{ instance.name }}</div>
            <div class="inst-meta">
              {{ instance.origin }}
              <template v-if="instance.version"> · v{{ instance.version }}</template>
              · {{ instance.capabilities.length }} capabilities
            </div>
          </div>
          <span v-if="instance.demo" class="chip">демо</span>
        </div>

        <template v-if="providers.length">
          <div class="divider"><span>продолжить через</span></div>
          <button v-for="p in providers" :key="p.id" class="provider" @click="startProvider(p.id)">
            <span class="badge">{{ p.badge }}</span>
            <span class="provider-label">{{ p.label }}</span>
            <Icon name="chevron" :size="16" class="chev" />
          </button>
        </template>

        <template v-else>
          <p class="warn">Инстанс не сообщил ни одного способа входа — попробуйте пароль.</p>
        </template>

        <div class="divider"><span>или</span></div>

        <form v-if="showPassword" class="pw" @submit.prevent="emit('authenticated')">
          <div class="field"><input v-model="email" placeholder="Почта" type="email" /></div>
          <div class="field"><input v-model="password" placeholder="Пароль" type="password" /></div>
          <button class="primary" type="submit" :disabled="!email || !password">Войти</button>
        </form>
        <button v-else class="text-btn" @click="showPassword = true">Войти по паролю</button>

        <button class="text-btn muted" @click="reset">Другой инстанс</button>
      </div>

      <footer class="legal">
        <div class="row">
          <span class="brand">Timbre</span>
          <span class="dot">·</span>
          <a href="https://github.com/y4my4my4m/harmony" target="_blank" rel="noreferrer">Powered by Harmony</a>
        </div>
        <div class="note">независимый клиент, не связан с проектом</div>
      </footer>
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
  background: var(--sf-container);
  border: 1px solid var(--sf-line);
  border-radius: var(--radius-xl);
  padding: var(--sp-600) var(--sp-600) var(--sp-400);
  box-shadow: var(--shadow-3);
}
.mark {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--primary-main);
  color: var(--primary-on);
  margin-bottom: var(--sp-400);
}
h1 { margin: 0 0 var(--sp-100); font-size: 21px; letter-spacing: -0.01em; }
.sub { margin: 0 0 var(--sp-500); color: var(--text-tertiary); font-size: var(--fs-sm); line-height: 1.5; }

.label {
  display: block;
  margin-bottom: var(--sp-100);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  font-weight: 600;
}
.field {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  height: 40px;
  padding: 0 var(--sp-300);
  border-radius: var(--radius-md);
  background: var(--sfv-container);
  border: 1px solid transparent;
  color: var(--text-tertiary);
  margin-bottom: var(--sp-300);
}
.field:focus-within { border-color: var(--primary-main); }
.field.invalid { border-color: var(--critical); }
.field input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: var(--fs-base);
}
.field input::placeholder { color: var(--text-tertiary); }

.primary {
  width: 100%;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--primary-main);
  color: var(--primary-on);
  font-weight: 600;
  font-size: var(--fs-base);
}
.primary:hover:not(:disabled) { background: var(--primary-hover); }
.primary:disabled { opacity: 0.5; cursor: not-allowed; }

.error {
  margin: var(--sp-300) 0 0;
  padding: var(--sp-200) var(--sp-300);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--critical-container) 60%, transparent);
  color: var(--critical);
  font-size: var(--fs-sm);
}

.inst {
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: var(--sp-300);
  border-radius: var(--radius-md);
  background: var(--sfv-container);
  margin-bottom: var(--sp-400);
}
.inst-avatar {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  border-radius: var(--radius-md);
  background: var(--primary-container);
  color: var(--primary-on-container);
  font-weight: 700;
}
.inst-text { flex: 1; min-width: 0; }
.inst-name { font-weight: 600; }
.inst-meta { margin-top: 2px; font-size: var(--fs-xs); line-height: 1.45; color: var(--text-tertiary); }
.chip {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--sfv-line);
  color: var(--text);
}

.divider {
  display: flex;
  align-items: center;
  gap: var(--sp-200);
  margin: var(--sp-300) 0;
  color: var(--text-tertiary);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--sf-line);
}

.provider {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: var(--sp-300);
  padding: 0 var(--sp-300);
  margin-bottom: var(--sp-200);
  border-radius: var(--radius-md);
  background: var(--sfv-container);
  color: var(--text);
  font-size: var(--fs-base);
}
.provider:hover { background: var(--sfv-hover); }
.badge {
  width: 24px; height: 24px;
  display: grid; place-items: center;
  border-radius: var(--radius-xs);
  background: var(--bg-container);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.provider-label { flex: 1; text-align: left; }
.chev { transform: rotate(-90deg); color: var(--text-tertiary); }

.text-btn {
  width: 100%;
  height: 34px;
  margin-top: var(--sp-100);
  color: var(--primary-main);
  font-size: var(--fs-sm);
  border-radius: var(--radius-sm);
}
.text-btn:hover { background: var(--sfv-container); }
.text-btn.muted { color: var(--text-tertiary); }

.pw .field { margin-bottom: var(--sp-200); }
.warn { margin: 0; font-size: var(--fs-sm); color: var(--warning); }

.legal {
  margin-top: var(--sp-400);
  padding-top: var(--sp-300);
  line-height: 1.55;
  border-top: 1px solid var(--sf-line);
  font-size: 11px;
  color: var(--text-tertiary);
}
.legal .row { display: flex; gap: 6px; justify-content: center; align-items: baseline; }
.legal .dot { color: var(--text-tertiary); }
.legal .note { margin-top: 2px; color: var(--text-tertiary); }
.legal a { color: var(--text-secondary); }
.legal .brand { color: var(--primary-main); font-weight: 600; }
</style>
