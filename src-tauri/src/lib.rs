mod capture;
mod credentials;
mod export;
mod history;
mod upload;

use tauri::Emitter;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Register the global shortcut (Cmd+Shift+5)
            // This will emit an event when triggered
            let handle = app.handle().clone();

            app.global_shortcut().on_shortcut(
                "CmdOrCtrl+Shift+5",
                move |_app, _shortcut, _event| {
                    // Emit event to frontend to trigger capture
                    let _ = handle.emit("trigger-capture", ());
                },
            )?;

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
            export::export_annotated,
            history::save_to_history,
            history::get_history,
            history::delete_from_history,
            history::get_storage_usage,
            credentials::store_credential,
            credentials::get_credential,
            credentials::delete_credential,
            upload::upload_screenshot,
            upload::validate_credentials,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
