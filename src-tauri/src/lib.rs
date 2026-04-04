// ==========================================
// Aether Terminal — Application Entry Point
// Registers all Tauri plugins, IPC commands,
// and manages global state.
// ==========================================

mod pty;

use pty::PtyManager;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

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
        .plugin(tauri_plugin_dialog::init())
        // ── Menu Setup ────────────────────────────
        .setup(|app| {
            let app_menu = Submenu::with_items(
                app,
                "Aether Terminal",
                true,
                &[&PredefinedMenuItem::quit(app, None)?],
            )?;

            let new_file = MenuItem::with_id(app, "new-file", "New File", true, None::<&str>)?;
            let new_folder = MenuItem::with_id(app, "new-folder", "New Folder", true, None::<&str>)?;
            let open_folder = MenuItem::with_id(app, "open-folder", "Open Folder...", true, None::<&str>)?;
            let close = PredefinedMenuItem::close_window(app, None)?;
            
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &new_file,
                    &new_folder,
                    &PredefinedMenuItem::separator(app)?,
                    &open_folder,
                    &PredefinedMenuItem::separator(app)?,
                    &close,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &close,
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                match event.id.as_ref() {
                    "new-file" => { app_handle.emit("menu-new-file", ()).unwrap_or(()); }
                    "new-folder" => { app_handle.emit("menu-new-folder", ()).unwrap_or(()); }
                    "open-folder" => { app_handle.emit("menu-open-folder", ()).unwrap_or(()); }
                    _ => {}
                }
            });

            Ok(())
        })
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
