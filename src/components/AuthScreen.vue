<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Icon from './Icon.vue';
import ProviderMark from './ProviderMark.vue';
import { discoverInstance, refreshProviders, type InstanceInfo } from '../services/discover';
import { lastSignIn, navigateToSignIn, signInWithPassword, fetchAuthUser } from '../services/auth';
import { adoptSession, describeToken, parseSessionBlob } from '../services/sessionImport';
import {
  chooseUsername,
  createAccount,
  joinServer,
  suggestUsername,
  usernameTaken,
  suggestedServers,
  type ServerSuggestion,
} from '../services/onboarding';
import type { Session } from '../services/auth';

const props = withDefaults(
  defineProps<{
    autoInstance?: InstanceInfo | null;
    probing?: boolean;
    /** A stored session whose account has no profile yet: resume at the username step. */
    resume?: { session: Session; instance: InstanceInfo } | null;
  }>(),
  { autoInstance: null, probing: false, resume: null }
);
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
// Same three steps as the official web app: credentials → username → a suggested server that
// the person accepts or declines. Nothing joins a server on its own.
const step = ref<'signin' | 'signup' | 'username' | 'server'>('signin');
const newUsername = ref('');
// The provider usually says who you are; the profile row is the only thing it cannot fill in.
const newDisplayName = ref('');
const signupError = ref('');
const signupLoading = ref(false);
/** The account exists from step one on; the profile and the membership follow it. */
const pending = ref<Session | null>(null);
const suggested = ref<ServerSuggestion[]>([]);
const joining = ref(false);

function adopt(inst: InstanceInfo, opts: { auto?: boolean } = {}) {
  instance.value = inst;
  host.value = inst.origin;
  auto.value = opts.auto === true && inst.selfHosted === true;
  // With no providers a password is the only way in, so the form is the screen — a button
  // that exists only to reveal it, and an "or" with nothing on the other side, is noise.
  showPassword.value = !inst.providers.length;
}

// App.vue resolves the instance this page is served from before rendering this screen; it
// arrives already resolved, and the user never sees an empty address field.
watch(
  () => props.autoInstance,
  (inst) => {
    if (inst && !instance.value && !host.value) adopt(inst, { auto: true });
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

const providerMeta: Record<string, { label: string }> = {
  github: { label: 'GitHub' },
  google: { label: 'Google' },
  twitch: { label: 'Twitch' },
};

const providers = computed<{ id: string; label: string; icon?: string }[]>(() => {
  const inst = instance.value;
  if (!inst) return [];
  // Built-in providers come from GoTrue's settings endpoint; an instance's own OIDC providers do
  // not appear there at all, and their display names live in `instance_config`. A provider the
  // instance configured but the client never lists is a configured feature nobody can reach.
  const custom = (inst.customProviders ?? []).map((p) => ({
    id: p.id,
    label: p.name,
    icon: p.icon,
  }));
  const known = new Set(custom.map((p) => p.id));
  const builtin = inst.providers
    .filter((id) => !known.has(id))
    .map((id) => ({
      id,
      label: providerMeta[id]?.label ?? id,
    }));
  return [...custom, ...builtin];
});

async function submit() {
  if (loading.value) return;
  error.value = '';
  loading.value = true;
  const result = await discoverInstance(host.value, { demo });
  loading.value = false;
  if (result.ok) adopt(result.instance);
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

async function submitCredentials() {
  const inst = instance.value;
  if (!inst || signupLoading.value) return;
  signupError.value = '';
  signupLoading.value = true;
  try {
    pending.value = await createAccount(inst, email.value.trim(), password.value);
    step.value = 'username';
  } catch (e) {
    signupError.value = e instanceof Error ? e.message : String(e);
  } finally {
    signupLoading.value = false;
  }
}

async function submitUsername() {
  const inst = instance.value;
  const session = pending.value;
  if (!inst || !session || signupLoading.value) return;
  signupError.value = '';
  signupLoading.value = true;
  try {
    await chooseUsername(session, inst, newUsername.value, newDisplayName.value);
    suggested.value = await suggestedServers(session);
    // An instance with nothing public to offer just lets the person in.
    if (!suggested.value.length) emit('authenticated');
    else step.value = 'server';
  } catch (e) {
    signupError.value = e instanceof Error ? e.message : String(e);
  } finally {
    signupLoading.value = false;
  }
}

async function acceptServer(id: string) {
  const inst = instance.value;
  const session = pending.value;
  if (!inst || !session || joining.value) return;
  joining.value = true;
  try {
    await joinServer(session, inst, id);
  } catch (e) {
    signupError.value = e instanceof Error ? e.message : String(e);
  } finally {
    joining.value = false;
    emit('authenticated');
  }
}

function skipServer() {
  emit('authenticated');
}

watch(
  () => props.resume,
  (value) => {
    if (!value) return;
    instance.value = value.instance;
    pending.value = value.session;
    auto.value = value.instance.selfHosted === true;
    step.value = 'username';
    void prefillFromProvider(value.session);
  },
  { immediate: true }
);

/**
 * GoTrue keeps the provider's claims in `user_metadata`, so a sign-up through OAuth already knows
 * a plausible handle: asking for one blind, as if the account were new and empty, is what made the
 * official client feel automatic and this one feel like paperwork. A guess that is taken still
 * fails loudly at Continue, and the field stays editable.
 */
async function prefillFromProvider(session: Session): Promise<void> {
  const user = await fetchAuthUser(session);
  if (!user) return;
  const inst = instance.value;
  if (!newUsername.value) {
    let guess = suggestUsername(user.metadata, user.email);
    // A provider that only sends a name (dex does) lands on the address' local part, and that
    // handle is the one most likely to be taken already. Asking someone to invent a variant
    // after they just proved who they are is the step this is meant to remove.
    if (guess && inst) {
      for (let n = 2; n <= 9 && (await usernameTaken(inst, guess)); n += 1) {
        const base = guess.replace(/[0-9]+$/, '');
        guess = `${base}${n}`;
        if (guess.length > 32) break;
      }
    }
    newUsername.value = guess;
  }
  const name = user.metadata.full_name ?? user.metadata.name;
  if (!newDisplayName.value && typeof name === 'string') newDisplayName.value = name.slice(0, 40);
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
  step.value = 'signin';
  pending.value = null;
  signupError.value = '';
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
      <!-- A skeleton, not a message: the same-origin lookup takes a fraction of a second and
           a line of text would read as a second flash. -->
      <div v-if="probing" class="probing" aria-hidden="true">
        <span class="skel sub-line" />
        <span class="skel card-line" />
        <span class="skel field-line" />
        <span class="skel field-line" />
      </div>
      <p v-else-if="auto" class="sub">
        This build is served by the instance below, so there is no address to type.
        <button class="inline-link" @click="reset">Use another one</button>
      </p>
      <p v-else class="sub">Sign in to Harmony. Enter an instance address — Timbre finds its API and sign-in methods on its own.</p>

      <form v-if="!instance && !probing" @submit.prevent="submit">
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

      <!-- `v-else` here was the negation of `!instance && !probing`, which is still true while
           probing (instance is null then) — the block rendered with no instance and threw on
           `instance.name` for the fraction of a second the lookup takes. -->
      <div v-else-if="instance" class="found">
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

        <template v-if="step === 'signin' && providers.length">
          <div class="divider"><span>continue with</span></div>
          <button v-for="p in providers" :key="p.id" class="provider" @click="startProvider(p.id)">
            <ProviderMark :id="p.id" :name="p.label" :icon="p.icon" />
            <span class="provider-label">{{ p.label }}</span>
            <Icon name="chevron" :size="16" class="chev" />
          </button>
          <div class="divider"><span>or</span></div>
        </template>

        <!-- Only a real failure deserves an explanation and a retry. An instance that simply
             has no OAuth configured goes straight to the password form. -->
        <template v-else-if="step === 'signin' && instance.providersError">
          <p class="warn">
            Could not read the sign-in methods ({{ instance.providersError }}). The instance most likely
            offers some — the answer just did not arrive.
          </p>
          <button class="ghost" :disabled="retrying" @click="retryProviders">
            {{ retrying ? 'Asking…' : 'Retry' }}
          </button>
          <div class="divider"><span>or</span></div>
        </template>

        <template v-if="step === 'signin'">
          <form v-if="showPassword" class="pw" @submit.prevent="usePassword">
            <div class="field"><input v-model="email" placeholder="Email" type="email" autocomplete="username" /></div>
            <div class="field"><input v-model="password" placeholder="Password" type="password" autocomplete="current-password" /></div>
            <button class="primary" type="submit" :disabled="pwLoading || !email || !password">
              {{ pwLoading ? 'Signing in…' : 'Sign in' }}
            </button>
            <p v-if="pwError" class="warn">{{ pwError }}</p>
            <button class="text-btn" type="button" @click="step = 'signup'; pwError = ''">
              Create an account
            </button>
          </form>
          <button v-else class="text-btn" @click="showPassword = true">Sign in with password</button>
        </template>

        <form v-else-if="step === 'signup'" class="pw" @submit.prevent="submitCredentials">
          <p class="hint">Step 1 of 3 — the account on {{ instance.origin }}.</p>
          <div class="field"><input v-model="email" placeholder="Email" type="email" autocomplete="email" /></div>
          <div class="field"><input v-model="password" placeholder="Password" type="password" autocomplete="new-password" /></div>
          <button class="primary" type="submit" :disabled="signupLoading || !email || !password">
            {{ signupLoading ? 'Creating…' : 'Continue' }}
          </button>
          <p v-if="signupError" class="warn">{{ signupError }}</p>
          <button class="text-btn" type="button" @click="step = 'signin'; signupError = ''">
            I already have an account
          </button>
        </form>

        <form v-else-if="step === 'username'" class="pw" @submit.prevent="submitUsername">
          <p class="hint">Step 2 of 3 — pick the username people here will see. The account exists now, so
            this can be finished later if you close the app. Both fields come from your provider where
            it knows them.</p>
          <div class="field"><input v-model="newUsername" placeholder="Username" autocomplete="nickname" /></div>
          <div class="field"><input v-model="newDisplayName" placeholder="Display name" autocomplete="name" /></div>
          <button class="primary" type="submit" :disabled="signupLoading || !newUsername">
            {{ signupLoading ? 'Saving…' : 'Continue' }}
          </button>
          <p v-if="signupError" class="warn">{{ signupError }}</p>
        </form>

        <div v-else class="pw">
          <p class="hint">
            Step 3 of 3 — {{ suggested[0].name }} is a public server on this instance. Join it, or
            look around on your own first; nothing is joined without asking.
          </p>
          <button class="primary" :disabled="joining" @click="acceptServer(suggested[0].id)">
            {{ joining ? 'Joining…' : 'Join ' + suggested[0].name }}
          </button>
          <button class="text-btn" type="button" @click="skipServer">Not now</button>
          <p v-if="signupError" class="warn">{{ signupError }}</p>
        </div>

        <button v-if="!auto && step === 'signin'" class="text-btn muted" @click="reset">Another instance</button>

        <template v-if="step === 'signin' && showImport">
          <p class="hint">
            Until the instance allows our <code>redirect_to</code>, bring a session with you: open the
            instance in a browser, sign in, and copy <code>sb-*-auth-token</code> from
            DevTools → Application → Local Storage.
          </p>
          <textarea v-model="blob" class="blob" rows="4" placeholder='{"access_token":"eyJ…","refresh_token":"…"}' />
          <p v-if="importError" class="warn">{{ importError }}</p>
          <button class="ghost" @click="importSession">Use this session</button>
        </template>
        <button v-else-if="step === 'signin'" class="text-btn muted" @click="showImport = true">I already have a session</button>
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

.probing { display: grid; gap: var(--sp-200); margin-bottom: var(--sp-500); }
.skel { display: block; border-radius: var(--radius-md); background: var(--sfv-container); animation: probe-pulse 1.1s ease-in-out infinite; }
.skel.sub-line { width: 72%; height: 14px; }
.skel.card-line { height: 64px; margin-top: var(--sp-200); }
.skel.field-line { height: 44px; }
@keyframes probe-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }

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
