import { createApp } from 'vue';
import App from './App.vue';
import './styles/tokens.css';
import './styles/base.css';

// Android draws the app edge to edge (this build targets a recent SDK), so the system navigation
// bar sits *over* the bottom of the UI. The inset that compensates lives in CSS, but only for the
// shell: in a browser the same env() is the toolbar artefact that once left a 48px gap above the
// composer.
const shell =
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
if (shell) {
  document.documentElement.classList.add('shell');
}

createApp(App).mount('#app');
