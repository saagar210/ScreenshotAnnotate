import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type {
  Annotation,
  AnnotationTool,
  Point,
  ArrowAnnotation,
  RectAnnotation,
  TextAnnotation,
  FreehandAnnotation,
} from '../types';

interface AnnotationCanvasProps {
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  currentTool: AnnotationTool;
  currentColor: string;
  currentThickness: number;
  onAddAnnotation: (annotation: Annotation) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export interface AnnotationCanvasRef {
  getSvgElement: () => SVGSVGElement | null;
}

export const AnnotationCanvas = forwardRef<AnnotationCanvasRef, AnnotationCanvasProps>(
  function AnnotationCanvas(
    {
      imagePath,
      imageWidth,
      imageHeight,
      annotations,
      currentTool,
      currentColor,
      currentThickness,
      onAddAnnotation,
      onUndo,
      onRedo,
      onSave,
      onCancel,
    },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement>(null);

    // Expose SVG element to parent via ref
    useImperativeHandle(ref, () => ({
      getSvgElement: () => svgRef.current,
    }));
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Partial<Annotation> | null>(null);
  const [textInput, setTextInput] = useState<{ position: Point; visible: boolean }>({
    position: { x: 0, y: 0 },
    visible: false,
  });
  const [textValue, setTextValue] = useState('');

  const imageUrl = convertFileSrc(imagePath);

  // Get SVG point from mouse event
  const getSvgPoint = useCallback((event: React.PointerEvent<SVGSVGElement>): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // Convert screen coordinates to SVG coordinates
    const scaleX = imageWidth / rect.width;
    const scaleY = imageHeight / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }, [imageWidth, imageHeight]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (currentTool === 'text') {
      // Text tool: show input at click position
      const point = getSvgPoint(event);
      setTextInput({ position: point, visible: true });
      setTextValue('');
      return;
    }

    setIsDrawing(true);
    const point = getSvgPoint(event);

    switch (currentTool) {
      case 'arrow':
        setCurrentDraft({
          type: 'arrow',
          start: point,
          end: point,
          color: currentColor,
          thickness: currentThickness,
        });
        break;
      case 'rectangle':
        setCurrentDraft({
          type: 'rectangle',
          origin: point,
          width: 0,
          height: 0,
          color: currentColor,
          thickness: currentThickness,
        });
        break;
      case 'freehand':
        setCurrentDraft({
          type: 'freehand',
          points: [point],
          color: currentColor,
          thickness: currentThickness,
        });
        break;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !currentDraft) return;

    const point = getSvgPoint(event);

    switch (currentDraft.type) {
      case 'arrow':
        setCurrentDraft({ ...currentDraft, end: point });
        break;
      case 'rectangle': {
        const origin = (currentDraft as Partial<RectAnnotation>).origin!;
        setCurrentDraft({
          ...currentDraft,
          width: point.x - origin.x,
          height: point.y - origin.y,
        });
        break;
      }
      case 'freehand': {
        const points = (currentDraft as Partial<FreehandAnnotation>).points || [];
        // Throttle: only add point every 5ms (roughly)
        const lastPoint = points[points.length - 1];
        const distance = Math.sqrt(
          Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
        );
        if (distance > 2) { // Only add point if moved at least 2px
          setCurrentDraft({ ...currentDraft, points: [...points, point] });
        }
        break;
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentDraft) return;

    setIsDrawing(false);

    // Finalize annotation
    const annotation: Annotation = {
      ...currentDraft,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    } as Annotation;

    onAddAnnotation(annotation);
    setCurrentDraft(null);
  };

  const handleTextSubmit = () => {
    if (!textValue.trim()) {
      setTextInput({ ...textInput, visible: false });
      return;
    }

    const annotation: TextAnnotation = {
      id: crypto.randomUUID(),
      type: 'text',
      position: textInput.position,
      text: textValue,
      fontSize: 24,
      color: currentColor,
      thickness: currentThickness,
      createdAt: Date.now(),
    };

    onAddAnnotation(annotation);
    setTextInput({ ...textInput, visible: false });
    setTextValue('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in text input
      if (textInput.visible && e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') {
          handleTextSubmit();
        } else if (e.key === 'Escape') {
          setTextInput({ ...textInput, visible: false });
          setTextValue('');
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isDrawing) {
          setIsDrawing(false);
          setCurrentDraft(null);
        } else {
          onCancel();
        }
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, textInput, onUndo, onRedo, onSave, onCancel]);

  return (
    <div className="annotation-canvas-container">
      <div className="canvas-wrapper">
        <img
          src={imageUrl}
          alt="Screenshot"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Render finalized annotations */}
          {annotations.map(annotation => (
            <AnnotationRenderer key={annotation.id} annotation={annotation} />
          ))}

          {/* Render current draft */}
          {currentDraft && (
            <AnnotationRenderer annotation={currentDraft as Annotation} isDraft />
          )}
        </svg>

        {/* Text input overlay */}
        {textInput.visible && (
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={handleTextSubmit}
            autoFocus
            style={{
              position: 'absolute',
              left: `${(textInput.position.x / imageWidth) * 100}%`,
              top: `${(textInput.position.y / imageHeight) * 100}%`,
              fontSize: '16px',
              padding: '4px 8px',
              border: `2px solid ${currentColor}`,
              borderRadius: '4px',
              backgroundColor: 'white',
              zIndex: 1000,
            }}
          />
        )}
      </div>
    </div>
  );
});

function AnnotationRenderer({
  annotation,
  isDraft = false,
}: {
  annotation: Annotation;
  isDraft?: boolean;
}) {
  const opacity = isDraft ? 0.6 : 1;

  switch (annotation.type) {
    case 'arrow': {
      const arrow = annotation as ArrowAnnotation;
      const angle = Math.atan2(arrow.end.y - arrow.start.y, arrow.end.x - arrow.start.x);
      const arrowHeadSize = 12;

      // Calculate arrowhead points (equilateral triangle)
      const arrowHead = [
        arrow.end,
        {
          x: arrow.end.x - arrowHeadSize * Math.cos(angle - Math.PI / 6),
          y: arrow.end.y - arrowHeadSize * Math.sin(angle - Math.PI / 6),
        },
        {
          x: arrow.end.x - arrowHeadSize * Math.cos(angle + Math.PI / 6),
          y: arrow.end.y - arrowHeadSize * Math.sin(angle + Math.PI / 6),
        },
      ];

      return (
        <g opacity={opacity}>
          <line
            x1={arrow.start.x}
            y1={arrow.start.y}
            x2={arrow.end.x}
            y2={arrow.end.y}
            stroke={arrow.color}
            strokeWidth={arrow.thickness}
            strokeLinecap="round"
          />
          <polygon
            points={arrowHead.map(p => `${p.x},${p.y}`).join(' ')}
            fill={arrow.color}
          />
        </g>
      );
    }

    case 'rectangle': {
      const rect = annotation as RectAnnotation;
      return (
        <rect
          x={rect.origin.x}
          y={rect.origin.y}
          width={rect.width}
          height={rect.height}
          stroke={rect.color}
          strokeWidth={rect.thickness}
          fill="none"
          opacity={opacity}
        />
      );
    }

    case 'text': {
      const text = annotation as TextAnnotation;
      return (
        <text
          x={text.position.x}
          y={text.position.y}
          fontSize={text.fontSize}
          fill={text.color}
          stroke="white"
          strokeWidth={1}
          paintOrder="stroke"
          opacity={opacity}
          style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 'bold' }}
        >
          {text.text}
        </text>
      );
    }

    case 'freehand': {
      const freehand = annotation as FreehandAnnotation;
      if (freehand.points.length < 2) return null;

      const pathData = `M ${freehand.points.map(p => `${p.x},${p.y}`).join(' L ')}`;

      return (
        <path
          d={pathData}
          stroke={freehand.color}
          strokeWidth={freehand.thickness}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      );
    }

    default:
      return null;
  }
}
