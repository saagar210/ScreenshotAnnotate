use image::ImageFormat;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub annotated_path: String,
    pub thumbnail_path: String,
}

#[tauri::command]
pub async fn export_annotated(
    original_path: String,
    annotation_png_base64: String,
) -> Result<ExportResult, String> {
    // Load original screenshot
    let original_img =
        image::open(&original_path).map_err(|e| format!("Failed to load original image: {}", e))?;

    // Decode annotation layer from base64
    let annotation_data = base64_decode(&annotation_png_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let annotation_img = image::load_from_memory(&annotation_data)
        .map_err(|e| format!("Failed to load annotation image: {}", e))?;

    // Composite annotation layer onto original
    let mut result_img = original_img.to_rgba8();
    image::imageops::overlay(&mut result_img, &annotation_img.to_rgba8(), 0, 0);

    // Generate unique filename
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let temp_dir = std::env::temp_dir();
    let annotated_filename = format!("annotated_{}.png", timestamp);
    let annotated_path = temp_dir.join(&annotated_filename);

    // Save final annotated image
    result_img
        .save_with_format(&annotated_path, ImageFormat::Png)
        .map_err(|e| format!("Failed to save annotated image: {}", e))?;

    // Generate thumbnail (200px width, maintaining aspect ratio)
    let (width, height) = result_img.dimensions();
    let thumbnail_width = 200u32;
    let thumbnail_height = (height as f32 * (thumbnail_width as f32 / width as f32)) as u32;

    let thumbnail_img = image::imageops::resize(
        &result_img,
        thumbnail_width,
        thumbnail_height,
        image::imageops::FilterType::Lanczos3,
    );

    let thumbnail_filename = format!("thumbnail_{}.png", timestamp);
    let thumbnail_path = temp_dir.join(&thumbnail_filename);

    thumbnail_img
        .save_with_format(&thumbnail_path, ImageFormat::Png)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok(ExportResult {
        annotated_path: annotated_path.to_string_lossy().to_string(),
        thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
    })
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    let base64_data = if input.contains("base64,") {
        input.split("base64,").nth(1).unwrap_or(input)
    } else {
        input
    };

    use base64::{engine::general_purpose, Engine as _};
    general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())
}
