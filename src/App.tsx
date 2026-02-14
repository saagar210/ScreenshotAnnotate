import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { Toolbar } from './components/Toolbar';
import { useCapture } from './hooks/useCapture';
import { useAnnotations } from './hooks/useAnnotations';
import type { AppMode, AnnotationTool, CaptureResult } from './types';
import './App.css';

function App() {
  const [mode, setMode] = useState<AppMode>('idle');
  const [currentImage, setCurrentImage] = useState<CaptureResult | null>(null);
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('arrow');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [currentThickness, setCurrentThickness] = useState(3);

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

  const handleSave = () => {
    // For Phase 0, just log the annotations
    console.log('Saving annotations:', annotations);
    alert('Screenshot captured! (Export functionality coming in Phase 2)');
    handleCancel();
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
          <p>Or click the button below:</p>
          <button
            className="btn-primary capture-btn"
            onClick={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
          </button>
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
      </div>
    );
  }

  return null;
}

export default App;
