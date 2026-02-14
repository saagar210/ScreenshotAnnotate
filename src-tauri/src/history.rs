use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

const STORAGE_BUDGET_MB: u64 = 500;
const STORAGE_BUDGET_BYTES: u64 = STORAGE_BUDGET_MB * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotMeta {
    pub id: String,
    pub original_path: String,
    pub annotated_path: Option<String>,
    pub thumbnail_path: String,
    pub created_at: String,
    pub ticket_id: Option<String>,
    pub uploaded_url: Option<String>,
    pub size_bytes: u64,
    pub annotation_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageUsage {
    pub used_bytes: u64,
    pub budget_bytes: u64,
    pub item_count: usize,
}

#[tauri::command]
pub async fn save_to_history(
    original_path: String,
    annotated_path: Option<String>,
    thumbnail_path: String,
    annotations_json: String,
    ticket_id: Option<String>,
) -> Result<String, String> {
    let history_dir = get_history_dir()?;
    let id = Uuid::new_v4().to_string();
    let screenshot_dir = history_dir.join(&id);

    // Create screenshot directory
    fs::create_dir_all(&screenshot_dir)
        .map_err(|e| format!("Failed to create screenshot directory: {}", e))?;

    // Copy original file
    let original_dest = screenshot_dir.join("original.png");
    fs::copy(&original_path, &original_dest)
        .map_err(|e| format!("Failed to copy original: {}", e))?;

    // Copy annotated file if present
    let annotated_dest = if let Some(ref annotated) = annotated_path {
        let dest = screenshot_dir.join("annotated.png");
        fs::copy(annotated, &dest).map_err(|e| format!("Failed to copy annotated: {}", e))?;
        Some(dest.to_string_lossy().to_string())
    } else {
        None
    };

    // Copy thumbnail
    let thumbnail_dest = screenshot_dir.join("thumbnail.png");
    fs::copy(&thumbnail_path, &thumbnail_dest)
        .map_err(|e| format!("Failed to copy thumbnail: {}", e))?;

    // Save annotations JSON
    let annotations_dest = screenshot_dir.join("annotations.json");
    fs::write(&annotations_dest, &annotations_json)
        .map_err(|e| format!("Failed to write annotations: {}", e))?;

    // Calculate size
    let size_bytes = calculate_dir_size(&screenshot_dir)?;

    // Parse annotation count
    let annotations: serde_json::Value = serde_json::from_str(&annotations_json)
        .map_err(|e| format!("Failed to parse annotations JSON: {}", e))?;
    let annotation_count = annotations.as_array().map(|a| a.len()).unwrap_or(0);

    // Create metadata
    let meta = ScreenshotMeta {
        id: id.clone(),
        original_path: original_dest.to_string_lossy().to_string(),
        annotated_path: annotated_dest,
        thumbnail_path: thumbnail_dest.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        ticket_id,
        uploaded_url: None,
        size_bytes,
        annotation_count,
    };

    // Save metadata
    let meta_path = screenshot_dir.join("meta.json");
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&meta_path, meta_json).map_err(|e| format!("Failed to write metadata: {}", e))?;

    // Update index
    update_index(&meta)?;

    // Enforce storage budget
    enforce_storage_budget()?;

    Ok(id)
}

#[tauri::command]
pub async fn get_history(
    search: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<ScreenshotMeta>, String> {
    let index = load_index()?;
    let limit = limit.unwrap_or(20) as usize;

    let mut results: Vec<ScreenshotMeta> = if let Some(search_term) = search {
        let search_lower = search_term.to_lowercase();
        index
            .into_iter()
            .filter(|meta| {
                meta.ticket_id
                    .as_ref()
                    .map(|t| t.to_lowercase().contains(&search_lower))
                    .unwrap_or(false)
                    || meta.created_at.to_lowercase().contains(&search_lower)
            })
            .collect()
    } else {
        index
    };

    // Sort by created_at descending (most recent first)
    results.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Limit results
    results.truncate(limit);

    Ok(results)
}

#[tauri::command]
pub async fn delete_from_history(id: String) -> Result<(), String> {
    let history_dir = get_history_dir()?;
    let screenshot_dir = history_dir.join(&id);

    if screenshot_dir.exists() {
        fs::remove_dir_all(&screenshot_dir)
            .map_err(|e| format!("Failed to delete screenshot directory: {}", e))?;
    }

    // Remove from index
    remove_from_index(&id)?;

    Ok(())
}

#[tauri::command]
pub async fn get_storage_usage() -> Result<StorageUsage, String> {
    let history_dir = get_history_dir()?;
    let mut used_bytes = 0u64;
    let mut item_count = 0usize;

    if history_dir.exists() {
        for entry in fs::read_dir(&history_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.path().is_dir() {
                used_bytes += calculate_dir_size(&entry.path())?;
                item_count += 1;
            }
        }
    }

    Ok(StorageUsage {
        used_bytes,
        budget_bytes: STORAGE_BUDGET_BYTES,
        item_count,
    })
}

// Helper functions

fn get_history_dir() -> Result<PathBuf, String> {
    let app_support = dirs::data_local_dir()
        .ok_or_else(|| "Failed to get local data directory".to_string())?;

    let history_dir = app_support.join("com.screenshot-annotate").join("history");

    if !history_dir.exists() {
        fs::create_dir_all(&history_dir)
            .map_err(|e| format!("Failed to create history directory: {}", e))?;
    }

    Ok(history_dir)
}

fn get_index_path() -> Result<PathBuf, String> {
    let history_dir = get_history_dir()?;
    Ok(history_dir.join("index.json"))
}

fn load_index() -> Result<Vec<ScreenshotMeta>, String> {
    let index_path = get_index_path()?;

    if !index_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn update_index(meta: &ScreenshotMeta) -> Result<(), String> {
    let index_path = get_index_path()?;
    let mut index = load_index()?;

    // Add or update entry
    if let Some(existing) = index.iter_mut().find(|m| m.id == meta.id) {
        *existing = meta.clone();
    } else {
        index.push(meta.clone());
    }

    let json = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
    fs::write(&index_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

fn remove_from_index(id: &str) -> Result<(), String> {
    let index_path = get_index_path()?;
    let mut index = load_index()?;

    index.retain(|m| m.id != id);

    let json = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
    fs::write(&index_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

fn calculate_dir_size(path: &PathBuf) -> Result<u64, String> {
    let mut size = 0u64;

    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;

        if metadata.is_file() {
            size += metadata.len();
        } else if metadata.is_dir() {
            size += calculate_dir_size(&entry.path())?;
        }
    }

    Ok(size)
}

fn enforce_storage_budget() -> Result<(), String> {
    let usage = futures::executor::block_on(get_storage_usage())?;

    if usage.used_bytes <= STORAGE_BUDGET_BYTES {
        return Ok(());
    }

    // Load index and sort by created_at ascending (oldest first)
    let mut index = load_index()?;
    index.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    let history_dir = get_history_dir()?;
    let mut current_size = usage.used_bytes;

    // Delete oldest entries until under budget
    for meta in index.iter() {
        if current_size <= STORAGE_BUDGET_BYTES {
            break;
        }

        let screenshot_dir = history_dir.join(&meta.id);
        if screenshot_dir.exists() {
            let dir_size = calculate_dir_size(&screenshot_dir)?;
            fs::remove_dir_all(&screenshot_dir).map_err(|e| e.to_string())?;
            remove_from_index(&meta.id)?;
            current_size = current_size.saturating_sub(dir_size);
        }
    }

    Ok(())
}
