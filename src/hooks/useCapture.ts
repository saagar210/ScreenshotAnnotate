import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import type { CaptureResult } from '../types';

export function useCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureScreenshot = async (): Promise<CaptureResult | null> => {
    // Debounce: if already capturing, ignore
    if (isCapturing) {
      return null;
    }

    setIsCapturing(true);
    setError(null);

    try {
      const result = await invoke<CaptureResult>('capture_screenshot');
      setIsCapturing(false);
      return result;
    } catch (err) {
      setIsCapturing(false);
      const errorMsg = String(err);

      // Handle known error types
      if (errorMsg.includes('CAPTURE_CANCELLED')) {
        // User pressed Esc - not a real error
        return null;
      }

      setError(errorMsg);
      return null;
    }
  };

  // Listen for global hotkey trigger events
  useEffect(() => {
    const unlisten = listen('trigger-capture', () => {
      // This event is emitted when the global hotkey is pressed
      // The actual capture will be triggered by the parent component
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return {
    captureScreenshot,
    isCapturing,
    error,
  };
}
