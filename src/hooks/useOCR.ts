import { useState, useCallback, useRef } from 'react';
import { createWorker, type Worker } from 'tesseract.js';
import { findAllPii, type PiiMatch } from '../lib/pii-patterns';

export interface OcrWord {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  confidence: number;
}

export interface PiiRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'email' | 'phone' | 'ip' | 'credit_card';
  matchedText: string;
  confidence: number;
}

const OCR_TIMEOUT_MS = 8000; // 8 seconds

export function useOCR() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const initializeWorker = useCallback(async () => {
    // If already initialized, return
    if (workerRef.current) {
      return;
    }

    // If initialization in progress, wait for it
    if (initPromiseRef.current) {
      await initPromiseRef.current;
      return;
    }

    setIsInitializing(true);
    setError(null);

    const initPromise = (async () => {
      try {
        const worker = await createWorker('eng', 1, {
          // Download progress logging
          logger: (m) => {
            if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
              console.log(`OCR: ${m.status} - ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        workerRef.current = worker;
        setIsInitializing(false);
      } catch (err) {
        console.error('Failed to initialize OCR worker:', err);
        setError(String(err));
        setIsInitializing(false);
        throw err;
      }
    })();

    initPromiseRef.current = initPromise;
    await initPromise;
    initPromiseRef.current = null;
  }, []);

  const detectPii = useCallback(
    async (imageDataUrl: string): Promise<{ regions: PiiRegion[]; timedOut: boolean } | null> => {
      setIsProcessing(true);
      setError(null);

      try {
        // Ensure worker is initialized
        await initializeWorker();

        if (!workerRef.current) {
          throw new Error('OCR worker not initialized');
        }

        // Create timeout promise
        const timeoutPromise = new Promise<'timeout'>((resolve) => {
          setTimeout(() => resolve('timeout'), OCR_TIMEOUT_MS);
        });

        // Run OCR with timeout
        const ocrPromise = workerRef.current.recognize(imageDataUrl);

        const result = await Promise.race([ocrPromise, timeoutPromise]);

        if (result === 'timeout') {
          setIsProcessing(false);
          return { regions: [], timedOut: true };
        }

        // Extract words with bounding boxes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultData = result.data as any;
        const words: OcrWord[] = (resultData.words || []).map((word: any) => ({
          text: word.text,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1,
          },
          confidence: word.confidence,
        }));

        // Concatenate all text
        const fullText = words.map(w => w.text).join(' ');

        // Find PII patterns in text
        const piiMatches = findAllPii(fullText);

        // Map PII matches back to bounding boxes
        const regions = mapPiiToRegions(piiMatches, words, fullText);

        setIsProcessing(false);
        return { regions, timedOut: false };
      } catch (err) {
        console.error('OCR detection failed:', err);
        setError(String(err));
        setIsProcessing(false);
        return null;
      }
    },
    [initializeWorker],
  );

  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return {
    detectPii,
    isInitializing,
    isProcessing,
    error,
    terminateWorker,
  };
}

/**
 * Map PII text matches to image bounding boxes
 */
function mapPiiToRegions(
  piiMatches: PiiMatch[],
  words: OcrWord[],
  fullText: string,
): PiiRegion[] {
  const regions: PiiRegion[] = [];

  for (const match of piiMatches) {
    // Find which words correspond to this PII match
    const matchingWords = findWordsForTextRange(match.startIndex, match.endIndex, words, fullText);

    if (matchingWords.length === 0) continue;

    // Calculate bounding box that encompasses all matching words
    const x0 = Math.min(...matchingWords.map(w => w.bbox.x0));
    const y0 = Math.min(...matchingWords.map(w => w.bbox.y0));
    const x1 = Math.max(...matchingWords.map(w => w.bbox.x1));
    const y1 = Math.max(...matchingWords.map(w => w.bbox.y1));

    // Average confidence of all words
    const avgConfidence =
      matchingWords.reduce((sum, w) => sum + w.confidence, 0) / matchingWords.length;

    regions.push({
      x: x0,
      y: y0,
      width: x1 - x0,
      height: y1 - y0,
      type: match.type,
      matchedText: match.text,
      confidence: avgConfidence / 100, // Tesseract confidence is 0-100, normalize to 0-1
    });
  }

  return regions;
}

/**
 * Find words that overlap with a text range
 */
function findWordsForTextRange(
  startIndex: number,
  endIndex: number,
  words: OcrWord[],
  _fullText: string,
): OcrWord[] {
  const matchingWords: OcrWord[] = [];
  let currentIndex = 0;

  for (const word of words) {
    const wordStart = currentIndex;
    const wordEnd = currentIndex + word.text.length;

    // Check if this word overlaps with the PII match range
    if (wordEnd > startIndex && wordStart < endIndex) {
      matchingWords.push(word);
    }

    // Move to next word (account for space between words)
    currentIndex = wordEnd + 1;

    if (currentIndex > endIndex) break;
  }

  return matchingWords;
}
