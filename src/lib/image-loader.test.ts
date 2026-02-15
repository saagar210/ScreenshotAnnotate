import { describe, expect, it } from 'vitest';
import { loadImageFromUrl } from './image-loader';

function createMockImage(shouldFail: boolean): HTMLImageElement {
  let onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
  let onerror: OnErrorEventHandler | null = null;
  const mock: Partial<HTMLImageElement> = {};

  Object.defineProperty(mock, 'onload', {
    get() {
      return onload;
    },
    set(value) {
      onload = value;
    },
  });

  Object.defineProperty(mock, 'onerror', {
    get() {
      return onerror;
    },
    set(value) {
      onerror = value;
    },
  });

  Object.defineProperty(mock, 'src', {
    set(_value: string) {
      queueMicrotask(() => {
        if (shouldFail) {
          if (typeof onerror === 'function') {
            onerror.call(mock as GlobalEventHandlers, {} as Event);
          }
        } else if (onload) {
          onload.call(mock as GlobalEventHandlers, {} as Event);
        }
      });
    },
  });

  return mock as HTMLImageElement;
}

describe('loadImageFromUrl', () => {
  it('resolves with the loaded image', async () => {
    const image = createMockImage(false);
    const result = await loadImageFromUrl('ok-url', () => image);
    expect(result).toBe(image);
  });

  it('rejects when image loading fails', async () => {
    await expect(loadImageFromUrl('bad-url', () => createMockImage(true))).rejects.toThrow(
      'Failed to load screenshot for OCR',
    );
  });
});
