use keyring::Entry;

const SERVICE_NAME: &str = "com.screenshot-annotate";

/// Store a credential in the macOS Keychain
#[tauri::command]
pub async fn store_credential(service: String, token: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &service)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    entry
        .set_password(&token)
        .map_err(|e| format!("Failed to store credential: {}", e))?;

    Ok(())
}

/// Retrieve a credential from the macOS Keychain
#[tauri::command]
pub async fn get_credential(service: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, &service)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve credential: {}", e)),
    }
}

/// Delete a credential from the macOS Keychain
#[tauri::command]
pub async fn delete_credential(service: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &service)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(format!("Failed to delete credential: {}", e)),
    }
}
