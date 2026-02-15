use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::multipart::{Form, Part};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadRequest {
    pub service: String, // "jira" | "zendesk"
    pub ticket_id: String,
    pub file_path: String,
    pub comment: String,
    pub base_url: String, // Jira base URL or Zendesk subdomain
    pub email: String,    // For Jira
    pub api_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    pub ticket_url: String,
    pub attachment_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationRequest {
    pub service: String,
    pub base_url: String,
    pub email: String,
    pub api_token: String,
}

const UPLOAD_TIMEOUT: Duration = Duration::from_secs(15);

fn validate_jira_base_url(base_url: &str) -> Result<String, String> {
    let trimmed = base_url.trim();
    let parsed = Url::parse(trimmed).map_err(|_| "Invalid Jira URL".to_string())?;

    if parsed.scheme() != "https" {
        return Err("Invalid Jira URL: HTTPS is required".to_string());
    }

    if parsed.host_str().is_none() {
        return Err("Invalid Jira URL: missing host".to_string());
    }

    Ok(trimmed.trim_end_matches('/').to_string())
}

fn validate_jira_ticket_id(ticket_id: &str) -> Result<String, String> {
    let trimmed = ticket_id.trim();
    let mut parts = trimmed.splitn(2, '-');
    let project = parts.next().unwrap_or_default();
    let number = parts
        .next()
        .ok_or_else(|| "Invalid Jira ticket ID".to_string())?;

    if project.len() < 2
        || !project
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
    {
        return Err("Invalid Jira ticket ID".to_string());
    }

    if number.is_empty() || !number.chars().all(|c| c.is_ascii_digit()) {
        return Err("Invalid Jira ticket ID".to_string());
    }

    Ok(format!("{}-{}", project, number))
}

fn validate_zendesk_subdomain(subdomain: &str) -> Result<String, String> {
    let normalized = subdomain.trim().to_lowercase();

    if normalized.is_empty() || normalized.len() > 63 {
        return Err("Invalid Zendesk subdomain".to_string());
    }

    if normalized.starts_with('-')
        || normalized.ends_with('-')
        || normalized.contains('.')
        || normalized.contains('/')
    {
        return Err("Invalid Zendesk subdomain".to_string());
    }

    if !normalized
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err("Invalid Zendesk subdomain".to_string());
    }

    Ok(normalized)
}

fn validate_zendesk_ticket_id(ticket_id: &str) -> Result<String, String> {
    let trimmed = ticket_id.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Err("Invalid Zendesk ticket ID".to_string());
    }

    Ok(trimmed.to_string())
}

/// Upload a screenshot to Jira or Zendesk
#[tauri::command]
pub async fn upload_screenshot(request: UploadRequest) -> Result<UploadResult, String> {
    match request.service.as_str() {
        "jira" => upload_to_jira(request).await,
        "zendesk" => upload_to_zendesk(request).await,
        _ => Err(format!("Unknown service: {}", request.service)),
    }
}

/// Validate credentials for a service
#[tauri::command]
pub async fn validate_credentials(request: ValidationRequest) -> Result<bool, String> {
    match request.service.as_str() {
        "jira" => validate_jira(request).await,
        "zendesk" => validate_zendesk(request).await,
        _ => Err(format!("Unknown service: {}", request.service)),
    }
}

async fn upload_to_jira(request: UploadRequest) -> Result<UploadResult, String> {
    let base_url = validate_jira_base_url(&request.base_url)?;
    let ticket_id = validate_jira_ticket_id(&request.ticket_id)?;

    let file_path = Path::new(&request.file_path);
    if !file_path.exists() || !file_path.is_file() {
        return Err("File not found".to_string());
    }

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("screenshot.png");

    // Read file bytes
    let file_bytes =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Create multipart form with file attachment
    let file_part = Part::bytes(file_bytes)
        .file_name(filename.to_string())
        .mime_str("image/png")
        .map_err(|e| format!("Failed to create file part: {}", e))?;

    let form = Form::new().part("file", file_part);

    // Create HTTP client
    let client = reqwest::Client::builder()
        .timeout(UPLOAD_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Upload to Jira
    let url = format!("{}/rest/api/3/issue/{}/attachments", base_url, ticket_id);

    let auth = BASE64.encode(format!("{}:{}", request.email, request.api_token));

    let response = client
        .post(&url)
        .header("Authorization", format!("Basic {}", auth))
        .header("X-Atlassian-Token", "no-check")
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "NETWORK_ERROR: Request timed out".to_string()
            } else if e.is_connect() {
                "NETWORK_ERROR: Connection failed".to_string()
            } else {
                format!("NETWORK_ERROR: {}", e)
            }
        })?;

    let status = response.status();

    if status == 401 || status == 403 {
        return Err("UPLOAD_AUTH_FAILED".to_string());
    } else if status == 404 {
        return Err("TICKET_NOT_FOUND".to_string());
    } else if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Upload failed: {} - {}", status, error_text));
    }

    // Add comment if provided
    if !request.comment.is_empty() {
        let comment_url = format!("{}/rest/api/3/issue/{}/comment", base_url, ticket_id);

        let comment_body = serde_json::json!({
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": request.comment
                            }
                        ]
                    }
                ]
            }
        });

        let comment_response = client
            .post(&comment_url)
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", "application/json")
            .json(&comment_body)
            .send()
            .await
            .map_err(|e| format!("Failed to add comment: {}", e))?;

        let comment_status = comment_response.status();
        if comment_status == 401 || comment_status == 403 {
            return Err("UPLOAD_AUTH_FAILED".to_string());
        } else if comment_status == 404 {
            return Err("TICKET_NOT_FOUND".to_string());
        } else if !comment_status.is_success() {
            let error_text = comment_response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!(
                "Failed to add comment: {} - {}",
                comment_status, error_text
            ));
        }
    }

    let ticket_url = format!("{}/browse/{}", base_url, ticket_id);

    Ok(UploadResult {
        ticket_url: ticket_url.clone(),
        attachment_url: ticket_url,
    })
}

async fn upload_to_zendesk(request: UploadRequest) -> Result<UploadResult, String> {
    let subdomain = validate_zendesk_subdomain(&request.base_url)?;
    let ticket_id = validate_zendesk_ticket_id(&request.ticket_id)?;

    let file_path = Path::new(&request.file_path);
    if !file_path.exists() || !file_path.is_file() {
        return Err("File not found".to_string());
    }

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("screenshot.png");

    // Read file bytes
    let file_bytes =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Create HTTP client
    let client = reqwest::Client::builder()
        .timeout(UPLOAD_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Step 1: Upload file to Zendesk uploads endpoint
    let upload_url = format!(
        "https://{}.zendesk.com/api/v2/uploads?filename={}",
        subdomain, filename
    );

    let auth = BASE64.encode(format!("{}/token:{}", request.email, request.api_token));

    let upload_response = client
        .post(&upload_url)
        .header("Authorization", format!("Basic {}", auth))
        .header("Content-Type", "image/png")
        .body(file_bytes)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "NETWORK_ERROR: Request timed out".to_string()
            } else if e.is_connect() {
                "NETWORK_ERROR: Connection failed".to_string()
            } else {
                format!("NETWORK_ERROR: {}", e)
            }
        })?;

    let upload_status = upload_response.status();

    if upload_status == 401 || upload_status == 403 {
        return Err("UPLOAD_AUTH_FAILED".to_string());
    } else if !upload_status.is_success() {
        let error_text = upload_response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "File upload failed: {} - {}",
            upload_status, error_text
        ));
    }

    #[derive(Deserialize)]
    struct UploadResponse {
        upload: Upload,
    }

    #[derive(Deserialize)]
    struct Upload {
        token: String,
    }

    let upload_data: UploadResponse = upload_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse upload response: {}", e))?;

    // Step 2: Add comment with attachment to ticket
    let comment_url = format!(
        "https://{}.zendesk.com/api/v2/tickets/{}/comments",
        subdomain, ticket_id
    );

    let comment_text = if request.comment.is_empty() {
        "Screenshot attached".to_string()
    } else {
        request.comment.clone()
    };

    let comment_body = serde_json::json!({
        "ticket": {
            "comment": {
                "body": comment_text,
                "uploads": [upload_data.upload.token]
            }
        }
    });

    let comment_response = client
        .put(&comment_url)
        .header("Authorization", format!("Basic {}", auth))
        .header("Content-Type", "application/json")
        .json(&comment_body)
        .send()
        .await
        .map_err(|e| format!("Failed to add comment: {}", e))?;

    let comment_status = comment_response.status();

    if comment_status == 404 {
        return Err("TICKET_NOT_FOUND".to_string());
    } else if !comment_status.is_success() {
        let error_text = comment_response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "Comment failed: {} - {}",
            comment_status, error_text
        ));
    }

    let ticket_url = format!(
        "https://{}.zendesk.com/agent/tickets/{}",
        subdomain, ticket_id
    );

    Ok(UploadResult {
        ticket_url: ticket_url.clone(),
        attachment_url: ticket_url,
    })
}

async fn validate_jira(request: ValidationRequest) -> Result<bool, String> {
    let base_url = validate_jira_base_url(&request.base_url)?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/rest/api/3/myself", base_url);

    let auth = BASE64.encode(format!("{}:{}", request.email, request.api_token));

    let response = client
        .get(&url)
        .header("Authorization", format!("Basic {}", auth))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

async fn validate_zendesk(request: ValidationRequest) -> Result<bool, String> {
    let subdomain = validate_zendesk_subdomain(&request.base_url)?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("https://{}.zendesk.com/api/v2/users/me", subdomain);

    let auth = BASE64.encode(format!("{}/token:{}", request.email, request.api_token));

    let response = client
        .get(&url)
        .header("Authorization", format!("Basic {}", auth))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

#[cfg(test)]
mod tests {
    use super::{
        validate_jira_base_url, validate_jira_ticket_id, validate_zendesk_subdomain,
        validate_zendesk_ticket_id,
    };

    #[test]
    fn jira_base_url_requires_https_and_host() {
        assert!(validate_jira_base_url("https://example.atlassian.net").is_ok());
        assert!(validate_jira_base_url("http://example.atlassian.net").is_err());
        assert!(validate_jira_base_url("not a url").is_err());
        assert!(validate_jira_base_url("https://").is_err());
    }

    #[test]
    fn jira_ticket_id_validation_enforces_expected_format() {
        assert_eq!(
            validate_jira_ticket_id("PROJ-123").unwrap(),
            "PROJ-123".to_string()
        );
        assert!(validate_jira_ticket_id("proj-123").is_err());
        assert!(validate_jira_ticket_id("PROJ-").is_err());
        assert!(validate_jira_ticket_id("PROJ123").is_err());
    }

    #[test]
    fn zendesk_subdomain_validation_rejects_unsafe_values() {
        assert_eq!(
            validate_zendesk_subdomain("my-company").unwrap(),
            "my-company".to_string()
        );
        assert!(validate_zendesk_subdomain("my.company").is_err());
        assert!(validate_zendesk_subdomain("../evil").is_err());
        assert!(validate_zendesk_subdomain("-bad").is_err());
    }

    #[test]
    fn zendesk_ticket_id_requires_digits() {
        assert_eq!(
            validate_zendesk_ticket_id("123456").unwrap(),
            "123456".to_string()
        );
        assert!(validate_zendesk_ticket_id("ABC-123").is_err());
        assert!(validate_zendesk_ticket_id("").is_err());
    }
}
