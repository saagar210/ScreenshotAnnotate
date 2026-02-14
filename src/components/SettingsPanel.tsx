import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SettingsPanelProps {
  onClose: () => void;
}

interface ValidationRequest {
  service: string;
  base_url: string;
  email: string;
  api_token: string;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  // Jira settings
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraValidationStatus, setJiraValidationStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [jiraValidationError, setJiraValidationError] = useState('');

  // Zendesk settings
  const [zendeskSubdomain, setZendeskSubdomain] = useState('');
  const [zendeskEmail, setZendeskEmail] = useState('');
  const [zendeskApiToken, setZendeskApiToken] = useState('');
  const [zendeskValidationStatus, setZendeskValidationStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [zendeskValidationError, setZendeskValidationError] = useState('');

  // General settings
  const [defaultColor, setDefaultColor] = useState('#FF0000');
  const [defaultThickness, setDefaultThickness] = useState(3);
  const [historyRetentionDays, setHistoryRetentionDays] = useState(30);
  const [storageBudgetMb, setStorageBudgetMb] = useState(500);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const loadCredentials = async () => {
    try {
      // Load Jira credentials
      const jiraUrl = (await invoke('get_credential', {
        service: 'jira_base_url',
      })) as string | null;
      const jEmail = (await invoke('get_credential', { service: 'jira_email' })) as string | null;
      const jToken = (await invoke('get_credential', {
        service: 'jira_api_token',
      })) as string | null;

      if (jiraUrl) setJiraBaseUrl(jiraUrl);
      if (jEmail) setJiraEmail(jEmail);
      if (jToken) setJiraApiToken('••••••••'); // Don't show actual token

      // Load Zendesk credentials
      const zendeskSub = (await invoke('get_credential', {
        service: 'zendesk_subdomain',
      })) as string | null;
      const zEmail = (await invoke('get_credential', {
        service: 'zendesk_email',
      })) as string | null;
      const zToken = (await invoke('get_credential', {
        service: 'zendesk_api_token',
      })) as string | null;

      if (zendeskSub) setZendeskSubdomain(zendeskSub);
      if (zEmail) setZendeskEmail(zEmail);
      if (zToken) setZendeskApiToken('••••••••'); // Don't show actual token
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  };

  const saveJiraCredentials = async () => {
    try {
      await invoke('store_credential', {
        service: 'jira_base_url',
        token: jiraBaseUrl.trim(),
      });
      await invoke('store_credential', {
        service: 'jira_email',
        token: jiraEmail.trim(),
      });
      // Only save API token if it's not the masked value
      if (jiraApiToken !== '••••••••') {
        await invoke('store_credential', {
          service: 'jira_api_token',
          token: jiraApiToken.trim(),
        });
      }
      alert('Jira credentials saved!');
    } catch (err) {
      alert(`Failed to save Jira credentials: ${err}`);
    }
  };

  const saveZendeskCredentials = async () => {
    try {
      await invoke('store_credential', {
        service: 'zendesk_subdomain',
        token: zendeskSubdomain.trim(),
      });
      await invoke('store_credential', {
        service: 'zendesk_email',
        token: zendeskEmail.trim(),
      });
      // Only save API token if it's not the masked value
      if (zendeskApiToken !== '••••••••') {
        await invoke('store_credential', {
          service: 'zendesk_api_token',
          token: zendeskApiToken.trim(),
        });
      }
      alert('Zendesk credentials saved!');
    } catch (err) {
      alert(`Failed to save Zendesk credentials: ${err}`);
    }
  };

  const testJiraConnection = async () => {
    setJiraValidationStatus('testing');
    setJiraValidationError('');

    try {
      // Get the actual token (not masked)
      let tokenToUse = jiraApiToken;
      if (jiraApiToken === '••••••••') {
        const storedToken = (await invoke('get_credential', {
          service: 'jira_api_token',
        })) as string | null;
        if (!storedToken) {
          setJiraValidationStatus('error');
          setJiraValidationError('No API token configured');
          return;
        }
        tokenToUse = storedToken;
      }

      const validationRequest: ValidationRequest = {
        service: 'jira',
        base_url: jiraBaseUrl.trim(),
        email: jiraEmail.trim(),
        api_token: tokenToUse,
      };

      const isValid = (await invoke('validate_credentials', {
        request: validationRequest,
      })) as boolean;

      if (isValid) {
        setJiraValidationStatus('success');
      } else {
        setJiraValidationStatus('error');
        setJiraValidationError('Authentication failed');
      }
    } catch (err) {
      setJiraValidationStatus('error');
      setJiraValidationError(String(err));
    }
  };

  const testZendeskConnection = async () => {
    setZendeskValidationStatus('testing');
    setZendeskValidationError('');

    try {
      // Get the actual token (not masked)
      let tokenToUse = zendeskApiToken;
      if (zendeskApiToken === '••••••••') {
        const storedToken = (await invoke('get_credential', {
          service: 'zendesk_api_token',
        })) as string | null;
        if (!storedToken) {
          setZendeskValidationStatus('error');
          setZendeskValidationError('No API token configured');
          return;
        }
        tokenToUse = storedToken;
      }

      const validationRequest: ValidationRequest = {
        service: 'zendesk',
        base_url: zendeskSubdomain.trim(),
        email: zendeskEmail.trim(),
        api_token: tokenToUse,
      };

      const isValid = (await invoke('validate_credentials', {
        request: validationRequest,
      })) as boolean;

      if (isValid) {
        setZendeskValidationStatus('success');
      } else {
        setZendeskValidationStatus('error');
        setZendeskValidationError('Authentication failed');
      }
    } catch (err) {
      setZendeskValidationStatus('error');
      setZendeskValidationError(String(err));
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="settings-content">
        {/* Jira Section */}
        <section className="settings-section">
          <h3>Jira Configuration</h3>
          <div className="form-group">
            <label>Base URL</label>
            <input
              type="text"
              value={jiraBaseUrl}
              onChange={(e) => setJiraBaseUrl(e.target.value)}
              placeholder="https://your-domain.atlassian.net"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>
          <div className="form-group">
            <label>API Token</label>
            <input
              type="password"
              value={jiraApiToken}
              onChange={(e) => setJiraApiToken(e.target.value)}
              placeholder="Your Jira API token"
            />
          </div>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={saveJiraCredentials}>
              Save Credentials
            </button>
            <button
              className="btn-primary"
              onClick={testJiraConnection}
              disabled={jiraValidationStatus === 'testing'}
            >
              {jiraValidationStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {jiraValidationStatus === 'success' && (
            <div className="validation-success">✓ Connection successful!</div>
          )}
          {jiraValidationStatus === 'error' && (
            <div className="validation-error">✗ {jiraValidationError || 'Connection failed'}</div>
          )}
        </section>

        {/* Zendesk Section */}
        <section className="settings-section">
          <h3>Zendesk Configuration</h3>
          <div className="form-group">
            <label>Subdomain</label>
            <input
              type="text"
              value={zendeskSubdomain}
              onChange={(e) => setZendeskSubdomain(e.target.value)}
              placeholder="your-company (from your-company.zendesk.com)"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={zendeskEmail}
              onChange={(e) => setZendeskEmail(e.target.value)}
              placeholder="your-email@example.com"
            />
          </div>
          <div className="form-group">
            <label>API Token</label>
            <input
              type="password"
              value={zendeskApiToken}
              onChange={(e) => setZendeskApiToken(e.target.value)}
              placeholder="Your Zendesk API token"
            />
          </div>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={saveZendeskCredentials}>
              Save Credentials
            </button>
            <button
              className="btn-primary"
              onClick={testZendeskConnection}
              disabled={zendeskValidationStatus === 'testing'}
            >
              {zendeskValidationStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {zendeskValidationStatus === 'success' && (
            <div className="validation-success">✓ Connection successful!</div>
          )}
          {zendeskValidationStatus === 'error' && (
            <div className="validation-error">
              ✗ {zendeskValidationError || 'Connection failed'}
            </div>
          )}
        </section>

        {/* General Settings Section */}
        <section className="settings-section">
          <h3>General Settings</h3>
          <div className="form-group">
            <label>Default Color</label>
            <input
              type="color"
              value={defaultColor}
              onChange={(e) => setDefaultColor(e.target.value)}
            />
            <span className="color-preview" style={{ backgroundColor: defaultColor }} />
          </div>
          <div className="form-group">
            <label>Default Thickness: {defaultThickness}px</label>
            <input
              type="range"
              min="1"
              max="8"
              value={defaultThickness}
              onChange={(e) => setDefaultThickness(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>History Retention</label>
            <select
              value={historyRetentionDays}
              onChange={(e) => setHistoryRetentionDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <div className="form-group">
            <label>Storage Budget: {storageBudgetMb} MB</label>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={storageBudgetMb}
              onChange={(e) => setStorageBudgetMb(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
              <option value="system">System (Auto)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </section>
      </div>
    </div>
  );
}
