import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

interface UploadWizardProps {
  filePath: string;
  onClose: () => void;
  onSuccess: (ticketUrl: string) => void;
}

interface UploadRequest {
  service: string;
  ticket_id: string;
  file_path: string;
  comment: string;
  base_url: string;
  email: string;
  api_token: string;
}

interface UploadResult {
  ticket_url: string;
  attachment_url: string;
}

export function UploadWizard({ filePath, onClose, onSuccess }: UploadWizardProps) {
  const [service, setService] = useState<'jira' | 'zendesk'>('jira');
  const [ticketId, setTicketId] = useState('');
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  // Try to pre-fill ticket ID from clipboard
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const clipboardText = await readText();
        if (!clipboardText) return;

        // Check if it matches a Jira ticket pattern (e.g., PROJ-123)
        const jiraPattern = /^[A-Z]+-\d+$/;
        // Check if it matches a Zendesk ticket pattern (e.g., 12345)
        const zendeskPattern = /^\d+$/;

        if (jiraPattern.test(clipboardText.trim())) {
          setTicketId(clipboardText.trim());
          setService('jira');
        } else if (zendeskPattern.test(clipboardText.trim())) {
          setTicketId(clipboardText.trim());
          setService('zendesk');
        }
      } catch (err) {
        // Clipboard read failed, ignore
        console.error('Failed to read clipboard:', err);
      }
    };

    checkClipboard();
  }, []);

  const validateTicketId = (): boolean => {
    if (service === 'jira') {
      const jiraPattern = /^[A-Z]+-\d+$/;
      return jiraPattern.test(ticketId.trim());
    } else {
      const zendeskPattern = /^\d+$/;
      return zendeskPattern.test(ticketId.trim());
    }
  };

  const handleUpload = async () => {
    if (!validateTicketId()) {
      setError(
        service === 'jira'
          ? 'Invalid Jira ticket ID. Format should be: PROJ-123'
          : 'Invalid Zendesk ticket ID. Should be a number.'
      );
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get credentials from Keychain
      const baseUrl = (await invoke('get_credential', {
        service: service === 'jira' ? 'jira_base_url' : 'zendesk_subdomain',
      })) as string | null;

      const email = (await invoke('get_credential', {
        service: service === 'jira' ? 'jira_email' : 'zendesk_email',
      })) as string | null;

      const apiToken = (await invoke('get_credential', {
        service: service === 'jira' ? 'jira_api_token' : 'zendesk_api_token',
      })) as string | null;

      if (!baseUrl || !email || !apiToken) {
        setError('Credentials not configured. Please configure in Settings first.');
        setIsUploading(false);
        return;
      }

      const uploadRequest: UploadRequest = {
        service,
        ticket_id: ticketId.trim(),
        file_path: filePath,
        comment: comment.trim(),
        base_url: baseUrl,
        email,
        api_token: apiToken,
      };

      const result = (await invoke('upload_screenshot', {
        request: uploadRequest,
      })) as UploadResult;

      setSuccessUrl(result.ticket_url);
      onSuccess(result.ticket_url);
    } catch (err) {
      const errorMsg = String(err);
      if (errorMsg.includes('UPLOAD_AUTH_FAILED')) {
        setError('Authentication failed. Please update your credentials in Settings.');
      } else if (errorMsg.includes('TICKET_NOT_FOUND')) {
        setError('Ticket not found. Please check the ticket ID and try again.');
      } else if (errorMsg.includes('NETWORK_ERROR')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(`Upload failed: ${errorMsg}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (successUrl) {
      try {
        await writeText(successUrl);
        alert('URL copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };

  if (successUrl) {
    return (
      <div className="upload-wizard">
        <div className="upload-success">
          <div className="success-icon">✓</div>
          <h3>Upload Successful!</h3>
          <p>Screenshot attached to ticket</p>
          <div className="success-url">
            <a href={successUrl} target="_blank" rel="noopener noreferrer">
              {successUrl}
            </a>
          </div>
          <div className="upload-actions">
            <button className="btn-primary" onClick={handleCopyUrl}>
              Copy URL
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-wizard">
      <div className="upload-header">
        <h3>Upload Screenshot</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="upload-form">
        <div className="form-group">
          <label>Service</label>
          <div className="service-selector">
            <label>
              <input
                type="radio"
                name="service"
                value="jira"
                checked={service === 'jira'}
                onChange={() => setService('jira')}
              />
              Jira
            </label>
            <label>
              <input
                type="radio"
                name="service"
                value="zendesk"
                checked={service === 'zendesk'}
                onChange={() => setService('zendesk')}
              />
              Zendesk
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>
            Ticket ID
            <span className="hint">
              {service === 'jira' ? '(e.g., PROJ-123)' : '(e.g., 12345)'}
            </span>
          </label>
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder={service === 'jira' ? 'PROJ-123' : '12345'}
            disabled={isUploading}
          />
        </div>

        <div className="form-group">
          <label>Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment to the ticket..."
            rows={4}
            disabled={isUploading}
          />
        </div>

        {error && (
          <div className="upload-error">
            <p>{error}</p>
            {error.includes('credentials') && (
              <p className="error-hint">
                Configure your {service} credentials in Settings to upload screenshots.
              </p>
            )}
          </div>
        )}

        <div className="upload-actions">
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={isUploading || !ticketId.trim()}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
