use serde::{Deserialize, Serialize};
use std::process::Command;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureResult {
    pub temp_path: String,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn capture_screenshot() -> Result<CaptureResult, String> {
    // Generate unique temp file path
    let temp_path = std::env::temp_dir()
        .join(format!("sa_{}.png", Uuid::new_v4()))
        .to_string_lossy()
        .to_string();

    // Run macOS screencapture CLI with interactive mode (-i)
    let output = Command::new("screencapture")
        .arg("-i") // Interactive mode (region selection)
        .arg(&temp_path)
        .output()
        .map_err(|e| format!("Failed to execute screencapture: {}", e))?;

    // Check if user cancelled (screencapture returns non-zero exit code on Esc)
    if !output.status.success() {
        // Check if file was created (sometimes screencapture creates empty file on cancel)
        if std::path::Path::new(&temp_path).exists() {
            let _ = std::fs::remove_file(&temp_path);
        }
        return Err("CAPTURE_CANCELLED".to_string());
    }

    // Verify file exists
    if !std::path::Path::new(&temp_path).exists() {
        return Err("Screenshot file not created".to_string());
    }

    // Read image dimensions
    let dimensions = image::image_dimensions(&temp_path)
        .map_err(|e| format!("Failed to read image dimensions: {}", e))?;

    Ok(CaptureResult {
        temp_path,
        width: dimensions.0,
        height: dimensions.1,
    })
}

/// Clean up temp files on app exit
pub fn cleanup_temp_files() {
    let temp_dir = std::env::temp_dir();
    if let Ok(entries) = std::fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with("sa_") && name.ends_with(".png") {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }
}
