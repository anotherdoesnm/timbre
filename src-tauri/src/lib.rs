//! Tauri shell around the Vite build.
//!
//! No commands yet: the OAuth popup is created from JavaScript through
//! `@tauri-apps/api/webviewWindow`, so the shell only has to own the windows and the
//! bundle. Navigation policy for the popup (external provider pages must stay inside it)
//! is the first thing to revisit once a build exists.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("timbre: failed to start");
}
