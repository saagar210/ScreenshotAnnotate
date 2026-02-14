import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { AnnotationCanvas, type AnnotationCanvasRef } from './components/AnnotationCanvas';
import { Toolbar } from './components/Toolbar';
import { HistoryGallery } from './components/HistoryGallery';
import { RedactionPreview } from './components/RedactionPreview';
import { UploadWizard } from './components/UploadWizard';
import { SettingsPanel } from './components/SettingsPanel';
import { useCapture } from './hooks/useCapture';
import { useAnnotations } from './hooks/useAnnotations';
import { useExport } from './hooks/useExport';
import { useHistory } from './hooks/useHistory';
import { useOCR } from './hooks/useOCR';
import { applyTemplate, type Template } from './lib/templates';
import type { AppMode, AnnotationTool, CaptureResult, RedactAnnotation } from './types';
import type { PiiRegion } from './hooks/useOCR';
import './App.css';

function App() {
  const [mode, setMode] = useState<AppMode>('idle');
  const [currentImage, setCurrentImage] = useState<CaptureResult | null>(null);
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('arrow');
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [currentThickness, setCurrentThickness] = useState(3);
  const [saving, setSaving] = useState(false);
  const [showRedactionPreview, setShowRedactionPreview] = useState(false);
  const [detectedPiiRegions, setDetectedPiiRegions] = useState<PiiRegion[]>([]);
  const [manualRedactions, setManualRedactions] = useState<RedactAnnotation[]>([]);
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);

  const canvasRef = useRef<AnnotationCanvasRef>(null);

  const { captureScreenshot, isCapturing, error } = useCapture();
  const {
    annotations,
    addAnnotation,
    undo,
    redo,
    clear,
    setAnnotations,
    canUndo,
    canRedo,
  } = useAnnotations();
  const { exportAnnotations } = useExport();
  const { saveToHistory } = useHistory();
  const { detectPii, isProcessing: isOcrProcessing } = useOCR();

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
        setSavedFilePath(exportResult.annotatedPath);
        alert('Screenshot saved! Upload to a ticket?');
        setShowUploadWizard(true);
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
    setShowRedactionPreview(false);
    setDetectedPiiRegions([]);
    setManualRedactions([]);
  };

  const handleCheckPii = async () => {
    if (!currentImage) return;

    // Convert file path to data URL for OCR
    const imageUrl = convertFileSrc(currentImage.tempPath);

    // Load image as data URL
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Failed to create canvas context');
      return;
    }

    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    // Run OCR
    const result = await detectPii(dataUrl);
    if (result) {
      if (result.timedOut) {
        alert('OCR timed out. You can still add manual redactions.');
      }
      setDetectedPiiRegions(result.regions);
      setShowRedactionPreview(true);
    } else {
      alert('OCR failed. You can still add manual redactions.');
      setShowRedactionPreview(true);
    }
  };

  const handleApplyRedactions = (redactions: RedactAnnotation[]) => {
    // Add all redaction annotations
    redactions.forEach(redaction => addAnnotation(redaction));
    setShowRedactionPreview(false);
    setDetectedPiiRegions([]);
    setManualRedactions([]);
  };

  const handleCancelRedactions = () => {
    setShowRedactionPreview(false);
    setDetectedPiiRegions([]);
    setManualRedactions([]);
  };

  const handleAddManualRedaction = () => {
    // Switch to redact tool and close preview
    setCurrentTool('redact');
    setShowRedactionPreview(false);
  };

  const handleUploadSuccess = (ticketUrl: string) => {
    console.log('Upload successful:', ticketUrl);
    setShowUploadWizard(false);
    handleCancel(); // Return to idle mode
  };

  const handleApplyTemplate = (template: Template) => {
    if (!currentImage) return;

    // Apply template and get annotations
    const templateAnnotations = applyTemplate(template, currentImage.width, currentImage.height);

    // Replace all annotations with template annotations (single undo operation)
    setAnnotations(templateAnnotations);
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
            <button
              className="btn-secondary"
              onClick={() => setShowSettings(true)}
            >
              Settings
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
        {showSettings && (
          <>
            <div className="settings-panel-overlay" onClick={() => setShowSettings(false)} />
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </>
        )}
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
          onCheckPii={handleCheckPii}
          onApplyTemplate={handleApplyTemplate}
          canUndo={canUndo}
          canRedo={canRedo}
          isOcrProcessing={isOcrProcessing}
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
        {showRedactionPreview && (
          <div className="redaction-preview-overlay">
            <RedactionPreview
              imageWidth={currentImage.width}
              imageHeight={currentImage.height}
              detectedRegions={detectedPiiRegions}
              manualRedactions={manualRedactions}
              onApply={handleApplyRedactions}
              onCancel={handleCancelRedactions}
              onAddManual={handleAddManualRedaction}
            />
          </div>
        )}
        {saving && (
          <div className="saving-overlay">
            <div className="saving-spinner">Saving...</div>
          </div>
        )}
        {showUploadWizard && savedFilePath && (
          <>
            <div className="upload-wizard-overlay" onClick={() => setShowUploadWizard(false)} />
            <UploadWizard
              filePath={savedFilePath}
              onClose={() => setShowUploadWizard(false)}
              onSuccess={handleUploadSuccess}
            />
          </>
        )}
        {showSettings && (
          <>
            <div className="settings-panel-overlay" onClick={() => setShowSettings(false)} />
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </>
        )}
      </div>
    );
  }

  return null;
}

export default App;
