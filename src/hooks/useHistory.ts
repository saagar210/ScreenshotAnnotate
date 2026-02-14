import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ScreenshotMeta, StorageUsage } from '../types';

export function useHistory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveToHistory = useCallback(
    async (
      originalPath: string,
      annotatedPath: string | null,
      thumbnailPath: string,
      annotationsJson: string,
      ticketId?: string,
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const id = await invoke<string>('save_to_history', {
          originalPath,
          annotatedPath,
          thumbnailPath,
          annotationsJson,
          ticketId: ticketId || null,
        });

        setLoading(false);
        return id;
      } catch (err) {
        setError(String(err));
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const getHistory = useCallback(
    async (search?: string, limit?: number): Promise<ScreenshotMeta[]> => {
      setLoading(true);
      setError(null);

      try {
        const results = await invoke<ScreenshotMeta[]>('get_history', {
          search: search || null,
          limit: limit || 20,
        });

        setLoading(false);
        return results;
      } catch (err) {
        setError(String(err));
        setLoading(false);
        return [];
      }
    },
    [],
  );

  const deleteFromHistory = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await invoke('delete_from_history', { id });
      setLoading(false);
      return true;
    } catch (err) {
      setError(String(err));
      setLoading(false);
      return false;
    }
  }, []);

  const getStorageUsage = useCallback(async (): Promise<StorageUsage | null> => {
    try {
      const usage = await invoke<StorageUsage>('get_storage_usage');
      return usage;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, []);

  return {
    saveToHistory,
    getHistory,
    deleteFromHistory,
    getStorageUsage,
    loading,
    error,
  };
}
