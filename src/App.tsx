import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AnnotationCanvas, type AnnotationCanvasRef } from './components/AnnotationCanvas';
import { Toolbar } from './components/Toolbar';
import { HistoryGallery } from './components/HistoryGallery';
import { useCapture } from './hooks/useCapture';
import { useAnnotations } from './hooks/useAnnotations';
import { useExport } from './hooks/useExport';
import { useHistory } from './hooks/useHistory';
import type { AppMode, AnnotationTool, CaptureResult } from './types';
import './App.css';

function App() {
  const [mode, setMode] = useState<AppMode>('idle');
  const [currentImage, setCurrentImage] = useState<CaptureResult | null>(null);
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('arrow');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [currentThickness, setCurrentThickness] = useState(3);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<AnnotationCanvasRef>(null);

  const { captureScreenshot, isCapturing, error } = useCapture();
  const {
    annotations,
    addAnnotation,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
  } = useAnnotations();
  const { exportAnnotations } = useExport();
  const { saveToHistory } = useHistory();

  // Listen for global hotkey trigger
  useEffect(() => {
    const unlisten = listen('trigger-capture', async () => {
      handleCapture();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleCapture = async () => {
    const result = await captureScreenshot();
    if (result) {
      setCurrentImage(result);
      setMode('annotating');
      clear(); // Clear any previous annotations
    }
  };

  const handleSave = async () => {
    if (!currentImage || !canvasRef.current) {
      return;
    }

    setSaving(true);

    try {
      const svgElement = canvasRef.current.getSvgElement();
      if (!svgElement) {
        alert('Failed to get canvas element');
        setSaving(false);
        return;
      }

      // Export annotations to PNG
      const exportResult = await exportAnnotations(svgElement, currentImage.tempPath);
      if (!exportResult) {
        alert('Failed to export annotations');
        setSaving(false);
        return;
      }

      // Save to history
      const annotationsJson = JSON.stringify(annotations);
      const screenshotId = await saveToHistory(
        currentImage.tempPath,
        exportResult.annotatedPath,
        exportResult.thumbnailPath,
        annotationsJson,
      );

      if (screenshotId) {
        alert('Screenshot saved to history!');
        handleCancel();
      } else {
        alert('Failed to save to history');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMode('idle');
    setCurrentImage(null);
    clear();
  };

  // Keyboard shortcuts for tool switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when in annotating mode
      if (mode !== 'annotating') return;

      // Don't capture when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          setCurrentTool('arrow');
          break;
        case 'r':
          setCurrentTool('rectangle');
          break;
        case 't':
          setCurrentTool('text');
          break;
        case 'f':
          setCurrentTool('freehand');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  if (mode === 'idle') {
    return (
      <div className="app-container">
        <div className="idle-screen">
          <h1>Screenshot Annotate</h1>
          <p>Press <kbd>⌘ Cmd</kbd> + <kbd>⇧ Shift</kbd> + <kbd>5</kbd> to capture a screenshot</p>
          <p>Or click the buttons below:</p>
          <div className="idle-buttons">
            <button
              className="btn-primary capture-btn"
              onClick={handleCapture}
              disabled={isCapturing}
            >
              {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setMode('history')}
            >
              View History
            </button>
          </div>
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              {error.includes('PERMISSION') && (
                <p>
                  Please grant Screen Recording permission in System Settings → Privacy & Security → Screen Recording
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'history') {
    return (
      <div className="app-container">
        <HistoryGallery onClose={() => setMode('idle')} />
      </div>
    );
  }

  if (mode === 'annotating' && currentImage) {
    return (
      <div className="app-container">
        <Toolbar
          currentTool={currentTool}
          currentColor={currentColor}
          currentThickness={currentThickness}
          onToolChange={setCurrentTool}
          onColorChange={setCurrentColor}
          onThicknessChange={setCurrentThickness}
          onUndo={undo}
          onRedo={redo}
          onSave={handleSave}
          onCancel={handleCancel}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <AnnotationCanvas
          ref={canvasRef}
          imagePath={currentImage.tempPath}
          imageWidth={currentImage.width}
          imageHeight={currentImage.height}
          annotations={annotations}
          currentTool={currentTool}
          currentColor={currentColor}
          currentThickness={currentThickness}
          onAddAnnotation={addAnnotation}
          onUndo={undo}
          onRedo={redo}
          onSave={handleSave}
          onCancel={handleCancel}
        />
        {saving && (
          <div className="saving-overlay">
            <div className="saving-spinner">Saving...</div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default App;
