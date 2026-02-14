import type { Annotation } from '../types';

/**
 * Template with relative coordinates (0.0-1.0)
 * These are multiplied by image dimensions to get pixel coordinates
 */
export interface TemplateAnnotation {
  type: 'arrow' | 'rectangle' | 'text';
  color: string;
  thickness: number;
  // All position values are 0.0-1.0 (percentage of image dimensions)
  relativeStartX?: number; // For arrow
  relativeStartY?: number;
  relativeEndX?: number;
  relativeEndY?: number;
  relativeX?: number; // For rectangle/text origin
  relativeY?: number;
  relativeWidth?: number; // For rectangle
  relativeHeight?: number;
  text?: string; // For text annotations
  relativeFontSize?: number; // As fraction of image height (e.g., 0.03 = 3% of height)
}

export interface Template {
  id: string;
  name: string;
  description: string;
  annotations: TemplateAnnotation[];
}

/**
 * Built-in templates
 */
export const TEMPLATES: Template[] = [
  {
    id: 'error-highlight',
    name: 'Error Highlight',
    description: 'Red arrow and rectangle to highlight an error',
    annotations: [
      // Arrow pointing to center from top-left
      {
        type: 'arrow',
        color: '#FF0000',
        thickness: 4,
        relativeStartX: 0.2,
        relativeStartY: 0.2,
        relativeEndX: 0.5,
        relativeEndY: 0.5,
      },
      // Rectangle around center region (60% width, 40% height)
      {
        type: 'rectangle',
        color: '#FF0000',
        thickness: 3,
        relativeX: 0.2,
        relativeY: 0.3,
        relativeWidth: 0.6,
        relativeHeight: 0.4,
      },
    ],
  },
  {
    id: 'click-here',
    name: 'Click Here',
    description: 'Green circle and arrow with "Click here" text',
    annotations: [
      // Small rectangle (circle-ish) in top-left quadrant
      {
        type: 'rectangle',
        color: '#00C853',
        thickness: 3,
        relativeX: 0.25,
        relativeY: 0.25,
        relativeWidth: 0.15,
        relativeHeight: 0.1,
      },
      // Arrow pointing to the circle from outside
      {
        type: 'arrow',
        color: '#00C853',
        thickness: 4,
        relativeStartX: 0.15,
        relativeStartY: 0.15,
        relativeEndX: 0.25,
        relativeEndY: 0.25,
      },
      // "Click here" text label
      {
        type: 'text',
        color: '#00C853',
        thickness: 2,
        relativeX: 0.1,
        relativeY: 0.12,
        text: 'Click here',
        relativeFontSize: 0.03, // 3% of image height
      },
    ],
  },
  {
    id: 'step-by-step',
    name: 'Step by Step',
    description: 'Three numbered steps for sequential instructions',
    annotations: [
      // Step 1 at 25% height
      {
        type: 'text',
        color: '#FF0000',
        thickness: 2,
        relativeX: 0.1,
        relativeY: 0.25,
        text: '1',
        relativeFontSize: 0.05, // 5% of image height
      },
      {
        type: 'rectangle',
        color: '#FF0000',
        thickness: 3,
        relativeX: 0.08,
        relativeY: 0.22,
        relativeWidth: 0.06,
        relativeHeight: 0.08,
      },
      // Step 2 at 50% height
      {
        type: 'text',
        color: '#FF0000',
        thickness: 2,
        relativeX: 0.1,
        relativeY: 0.5,
        text: '2',
        relativeFontSize: 0.05,
      },
      {
        type: 'rectangle',
        color: '#FF0000',
        thickness: 3,
        relativeX: 0.08,
        relativeY: 0.47,
        relativeWidth: 0.06,
        relativeHeight: 0.08,
      },
      // Step 3 at 75% height
      {
        type: 'text',
        color: '#FF0000',
        thickness: 2,
        relativeX: 0.1,
        relativeY: 0.75,
        text: '3',
        relativeFontSize: 0.05,
      },
      {
        type: 'rectangle',
        color: '#FF0000',
        thickness: 3,
        relativeX: 0.08,
        relativeY: 0.72,
        relativeWidth: 0.06,
        relativeHeight: 0.08,
      },
    ],
  },
];

/**
 * Apply a template to an image with given dimensions
 * Converts relative coordinates to pixel coordinates
 */
export function applyTemplate(
  template: Template,
  imageWidth: number,
  imageHeight: number,
): Annotation[] {
  return template.annotations.map((templateAnnotation) => {
    const baseAnnotation = {
      id: crypto.randomUUID(),
      color: templateAnnotation.color,
      thickness: templateAnnotation.thickness,
      createdAt: Date.now(),
    };

    switch (templateAnnotation.type) {
      case 'arrow':
        return {
          ...baseAnnotation,
          type: 'arrow' as const,
          start: {
            x: (templateAnnotation.relativeStartX ?? 0) * imageWidth,
            y: (templateAnnotation.relativeStartY ?? 0) * imageHeight,
          },
          end: {
            x: (templateAnnotation.relativeEndX ?? 0) * imageWidth,
            y: (templateAnnotation.relativeEndY ?? 0) * imageHeight,
          },
        };

      case 'rectangle':
        return {
          ...baseAnnotation,
          type: 'rectangle' as const,
          origin: {
            x: (templateAnnotation.relativeX ?? 0) * imageWidth,
            y: (templateAnnotation.relativeY ?? 0) * imageHeight,
          },
          width: (templateAnnotation.relativeWidth ?? 0) * imageWidth,
          height: (templateAnnotation.relativeHeight ?? 0) * imageHeight,
        };

      case 'text':
        return {
          ...baseAnnotation,
          type: 'text' as const,
          position: {
            x: (templateAnnotation.relativeX ?? 0) * imageWidth,
            y: (templateAnnotation.relativeY ?? 0) * imageHeight,
          },
          text: templateAnnotation.text ?? '',
          fontSize: (templateAnnotation.relativeFontSize ?? 0.02) * imageHeight,
        };

      default:
        throw new Error(`Unknown template annotation type: ${templateAnnotation.type}`);
    }
  });
}
