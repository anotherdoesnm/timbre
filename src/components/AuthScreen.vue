<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Icon from './Icon.vue';
import { discoverInstance, refreshProviders, type InstanceInfo } from '../services/discover';
import { lastSignIn, navigateToSignIn, signInWithPassword } from '../services/auth';
import { adoptSession, describeToken, parseSessionBlob } from '../services/sessionImport';

const props = withDefaults(defineProps<{ autoInstance?: InstanceInfo | null }>(), { autoInstance: null });
const emit = defineEmits<{ (e: 'authenticated'): void }>();

const demo = new URLSearchParams(location.search).get('demo') === '1';
// The instance matches its allowlist against exactly this string; there is no address bar
// in the shell, so the screen has to say it out loud.
const origin = location.origin;
const redirect = `${location.origin}/auth/callback`;
const last = lastSignIn();
const host = ref(last?.instance ?? '');
const loading = ref(false);
const error = ref('');
const instance = ref<InstanceInfo | null>(null);
const showPassword = ref(false);
// The instance this build is served from; the address step is skipped for it.
const auto = ref(false);
const retrying = ref(false);
const showImport = ref(false);
const blob = ref('');
const importError = ref('');
const pwError = ref('');
const pwLoading = ref(false);

function adopt(inst: InstanceInfo) {
  instance.value = inst;
  host.value = inst.origin;
  auto.value = inst.selfHosted === true;
  // No providers means the only way in is a password: do not make the user press a button
  // that only reveals a form.
  if (!inst.providers.length) showPassword.value = true;
}

// App.vue resolves the instance this page is served from before rendering this screen; it
// arrives already resolved, and the user never sees an empty address field.
watch(
  () => props.autoInstance,
  (inst) => {
    if (inst && !instance.value && !host.value) adopt(inst);
  },
  { immediate: true }
);

function importSession() {
  const inst = instance.value;
  if (!inst) return;
  const parsed = parseSessionBlob(blob.value);
  if (!parsed) {
    importError.value = 'No access_token found — paste the localStorage JSON or a callback URL fragment';
    return;
  }
  const verdict = describeToken(parsed.access);
  if (!verdict.ok) {
    importError.value = `Not usable: ${verdict.reason} (${verdict.label})`;
    return;
  }
  adoptSession(inst, parsed.access, parsed.refresh);
  emit('authenticated');
}
const email = ref(last?.email ?? '');
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

async function retryProviders() {
  if (!instance.value || retrying.value) return;
  retrying.value = true;
  instance.value = await refreshProviders(instance.value, { demo });
  retrying.value = false;
}

async function usePassword() {
  const inst = instance.value;
  if (!inst || pwLoading.value) return;
  pwError.value = '';
  pwLoading.value = true;
  try {
    await signInWithPassword(inst, email.value.trim(), password.value);
    emit('authenticated');
  } catch (e) {
    pwError.value = e instanceof Error ? e.message : String(e);
  } finally {
    pwLoading.value = false;
  }
}

async function startProvider(id: string) {
  const inst = instance.value;
  if (!inst) return;
  if (demo) {
    location.hash = 'auth/callback';
    return;
  }
  try {
    await navigateToSignIn(inst, id);
  } catch (e) {
    // A refused permission used to fail silently: no window, no error, a dead button.
    error.value = e instanceof Error && e.message === 'oauth-cancelled'
      ? 'Sign-in cancelled'
      : `Could not open sign-in: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function reset() {
  instance.value = null;
  showPassword.value = false;
  auto.value = false;
  host.value = '';
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
      <p v-if="auto" class="sub">
        This build is served by the instance below, so there is no address to type.
        <button class="inline-link" @click="reset">Use another one</button>
      </p>
      <p v-else class="sub">Sign in to Harmony. Enter an instance address — Timbre finds its API and sign-in methods on its own.</p>

      <form v-if="!instance" @submit.prevent="submit">
        <label class="label" for="host">Instance</label>
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
          {{ loading ? 'Checking…' : 'Continue' }}
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
          <span v-if="instance.demo" class="chip">demo</span>
        </div>

        <template v-if="providers.length">
          <div class="divider"><span>continue with</span></div>
          <button v-for="p in providers" :key="p.id" class="provider" @click="startProvider(p.id)">
            <span class="badge">{{ p.badge }}</span>
            <span class="provider-label">{{ p.label }}</span>
            <Icon name="chevron" :size="16" class="chev" />
          </button>
        </template>

        <template v-else>
          <p v-if="instance.providersError" class="warn">
            Could not read the sign-in methods ({{ instance.providersError }}). The instance most likely
            supports them — the answer just did not arrive.
          </p>
          <p v-else class="warn">This instance offers no sign-in methods — password only.</p>
          <button class="ghost" :disabled="retrying" @click="retryProviders">
            {{ retrying ? 'Asking…' : 'Retry' }}
          </button>
        </template>

        <div class="divider"><span>or</span></div>

        <form v-if="showPassword" class="pw" @submit.prevent="usePassword">
          <div class="field"><input v-model="email" placeholder="Email" type="email" autocomplete="username" /></div>
          <div class="field"><input v-model="password" placeholder="Password" type="password" autocomplete="current-password" /></div>
          <button class="primary" type="submit" :disabled="pwLoading || !email || !password">
            {{ pwLoading ? 'Signing in…' : 'Sign in' }}
          </button>
          <p v-if="pwError" class="warn">{{ pwError }}</p>
        </form>
        <button v-else class="text-btn" @click="showPassword = true">Sign in with password</button>

        <button v-if="!auto" class="text-btn muted" @click="reset">Another instance</button>

        <template v-if="showImport">
          <p class="hint">
            Until the instance allows our <code>redirect_to</code>, bring a session with you: open the
            instance in a browser, sign in, and copy <code>sb-*-auth-token</code> from
            DevTools → Application → Local Storage.
          </p>
          <textarea v-model="blob" class="blob" rows="4" placeholder='{"access_token":"eyJ…","refresh_token":"…"}' />
          <p v-if="importError" class="warn">{{ importError }}</p>
          <button class="ghost" @click="importSession">Use this session</button>
        </template>
        <button v-else class="text-btn muted" @click="showImport = true">I already have a session</button>
      </div>

      <footer class="legal">
        <div class="row">
          <span class="brand">Timbre</span>
          <span class="dot">·</span>
          <a href="https://github.com/y4my4my4m/harmony" target="_blank" rel="noreferrer">Powered by Harmony</a>
        </div>
        <div class="note">independent client, not affiliated with the project</div>
        <div class="origin">origin: {{ origin }} · redirect: {{ redirect }}</div>
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

/* Sits inside a sentence, so it must not break the line rhythm or look like a button. */
.inline-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary-main);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.inline-link:hover { color: var(--primary-hover); }

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

.hint { margin: var(--sp-200) 0; font-size: var(--fs-xs); line-height: 1.5; color: var(--text-tertiary); }
.hint code, .blob { font-family: var(--font-mono); font-size: 10px; }
.blob {
  width: 100%;
  margin-bottom: var(--sp-200);
  padding: var(--sp-200);
  border-radius: var(--radius-sm);
  border: 1px solid var(--sfv-line);
  background: var(--bg-container);
  color: var(--text);
  resize: vertical;
}
.ghost {
  width: 100%;
  height: 36px;
  margin-bottom: var(--sp-200);
  border-radius: var(--radius-md);
  border: 1px solid var(--sfv-line);
  color: var(--text);
  font-size: var(--fs-sm);
}
.ghost:hover:not(:disabled) { background: var(--sfv-container); }
.ghost:disabled { opacity: 0.6; }
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
.legal .origin { width: 100%; margin-top: 2px; font-family: var(--font-mono); font-size: 9px; color: var(--text-tertiary); word-break: break-all; }
.legal .brand { color: var(--primary-main); font-weight: 600; }
</style>
