import { invoke } from '@tauri-apps/api/core';
import { toPng } from 'html-to-image';
import type { ExportResult } from '../types';

export function useExport() {
  const exportAnnotations = async (
    svgElement: SVGSVGElement,
    originalPath: string,
  ): Promise<ExportResult | null> => {
    try {
      // Convert SVG to PNG using html-to-image
      const dataUrl = await toPng(svgElement as unknown as HTMLElement, {
        backgroundColor: 'transparent',
        cacheBust: true,
      });

      // Send to Rust backend for compositing
      const result = await invoke<ExportResult>('export_annotated', {
        originalPath,
        annotationPngBase64: dataUrl,
      });

      return result;
    } catch (error) {
      console.error('Export failed:', error);
      return null;
    }
  };

  return { exportAnnotations };
}
