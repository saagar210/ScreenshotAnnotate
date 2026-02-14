mod capture;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Register the global shortcut (Cmd+Shift+5)
            // This will emit an event when triggered
            let handle = app.handle().clone();

            app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+5", move |_app, _shortcut, _event| {
                // Emit event to frontend to trigger capture
                let _ = handle.emit("trigger-capture", ());
            })?;

            app.global_shortcut().register("CmdOrCtrl+Shift+5")?;

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Cleanup temp files when window closes
                capture::cleanup_temp_files();
            }
        })
        .invoke_handler(tauri::generate_handler![
            capture::capture_screenshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
