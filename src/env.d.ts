/// <reference types="vite/client" />

/** Injected by `define` in vite.config.ts. */
declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;

/** Markdown imported as text: the changelog the "What's new" sheet shows. */
declare module '*.md?raw' {
  const content: string;
  export default content;
}
