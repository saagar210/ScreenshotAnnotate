import { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useHistory } from '../hooks/useHistory';
import type { ScreenshotMeta, StorageUsage } from '../types';

interface HistoryGalleryProps {
  onClose: () => void;
}

export function HistoryGallery({ onClose }: HistoryGalleryProps) {
  const [screenshots, setScreenshots] = useState<ScreenshotMeta[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const { getHistory, deleteFromHistory, getStorageUsage, loading } = useHistory();

  useEffect(() => {
    loadHistory();
    loadStorageUsage();
  }, []);

  const loadHistory = async (search?: string) => {
    const results = await getHistory(search, 20);
    setScreenshots(results);
  };

  const loadStorageUsage = async () => {
    const usage = await getStorageUsage();
    setStorageUsage(usage);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      loadHistory(term);
    } else {
      loadHistory();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this screenshot? This cannot be undone.')) {
      return;
    }

    const success = await deleteFromHistory(id);
    if (success) {
      loadHistory(searchTerm || undefined);
      loadStorageUsage();
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="history-gallery">
      <div className="history-header">
        <h2>Screenshot History</h2>
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="history-search">
        <input
          type="text"
          placeholder="Search by ticket ID or date..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {storageUsage && (
        <div className="storage-usage">
          <div className="storage-bar">
            <div
              className="storage-bar-fill"
              style={{
                width: `${(storageUsage.usedBytes / storageUsage.budgetBytes) * 100}%`,
              }}
            />
          </div>
          <div className="storage-text">
            {formatBytes(storageUsage.usedBytes)} / {formatBytes(storageUsage.budgetBytes)} used
            ({storageUsage.itemCount} screenshot{storageUsage.itemCount !== 1 ? 's' : ''})
          </div>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}

      {!loading && screenshots.length === 0 && (
        <div className="empty-state">
          {searchTerm
            ? `No screenshots match "${searchTerm}"`
            : 'No screenshots yet. Press ⌘⇧5 to capture your first screenshot.'}
        </div>
      )}

      <div className="history-grid">
        {screenshots.map((screenshot) => (
          <div key={screenshot.id} className="history-card">
            <div className="history-thumbnail">
              <img
                src={convertFileSrc(screenshot.thumbnailPath)}
                alt="Screenshot thumbnail"
              />
            </div>
            <div className="history-meta">
              <div className="history-date">{formatDate(screenshot.createdAt)}</div>
              {screenshot.ticketId && (
                <div className="history-ticket">{screenshot.ticketId}</div>
              )}
              {screenshot.uploadedUrl && (
                <div className="history-uploaded">✓ Uploaded</div>
              )}
              <div className="history-stats">
                {screenshot.annotationCount} annotation
                {screenshot.annotationCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="history-actions">
              <button
                className="btn-danger-small"
                onClick={() => handleDelete(screenshot.id)}
                title="Delete"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
