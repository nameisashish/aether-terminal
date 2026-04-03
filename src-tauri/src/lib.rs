// ==========================================
// Aether Terminal — Application Entry Point
// Registers all Tauri plugins, IPC commands,
// and manages global state.
// ==========================================

mod pty;

use pty::PtyManager;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger for debug output
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Create the global PTY manager
    let pty_manager = Arc::new(PtyManager::new());

    tauri::Builder::default()
        // ── Plugins ──────────────────────────────
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        // ── Global State ─────────────────────────
        .manage(pty_manager)
        // ── IPC Command Handlers ─────────────────
        .invoke_handler(tauri::generate_handler![
            pty::create_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::destroy_pty,
            pty::get_home_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aether Terminal");
}
