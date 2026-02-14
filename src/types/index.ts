// === Annotation Types ===

export type AnnotationTool = 'arrow' | 'rectangle' | 'text' | 'freehand' | 'redact';

export interface Point {
  x: number; // pixels relative to image natural dimensions
  y: number;
}

export interface BaseAnnotation {
  id: string;         // crypto.randomUUID()
  type: AnnotationTool;
  color: string;      // hex: '#FF0000'
  thickness: number;  // stroke width in px (1-8)
  createdAt: number;  // Date.now()
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  start: Point;
  end: Point;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rectangle';
  origin: Point;     // top-left corner
  width: number;
  height: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  position: Point;
  text: string;
  fontSize: number;  // px (14-48)
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand';
  points: Point[];   // captured from pointer events
}

export interface RedactAnnotation extends BaseAnnotation {
  type: 'redact';
  origin: Point;
  width: number;
  height: number;
  style: 'blur' | 'pixelate' | 'blackbox';
  reason: 'email' | 'phone' | 'ip' | 'credit_card' | 'manual';
}

export type Annotation = ArrowAnnotation | RectAnnotation | TextAnnotation
                | FreehandAnnotation | RedactAnnotation;

// === Capture Types ===

export interface CaptureResult {
  tempPath: string;
  width: number;
  height: number;
}

// === Export Types ===

export interface ExportResult {
  annotatedPath: string;
  thumbnailPath: string;
}

// === History Types ===

export interface ScreenshotMeta {
  id: string;
  originalPath: string;
  annotatedPath: string | null;
  thumbnailPath: string;
  createdAt: string;
  ticketId: string | null;
  uploadedUrl: string | null;
  sizeBytes: number;
  annotationCount: number;
}

export interface StorageUsage {
  usedBytes: number;
  budgetBytes: number;
  itemCount: number;
}

// === App State ===

export type AppMode = 'idle' | 'annotating' | 'history';

export interface AppState {
  mode: AppMode;
  currentImage: CaptureResult | null;
  currentTool: AnnotationTool;
  currentColor: string;
  currentThickness: number;
}
