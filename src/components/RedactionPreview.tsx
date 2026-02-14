import { useState } from 'react';
import type { PiiRegion } from '../hooks/useOCR';
import type { RedactAnnotation } from '../types';

interface RedactionPreviewProps {
  imageWidth: number;
  imageHeight: number;
  detectedRegions: PiiRegion[];
  manualRedactions: RedactAnnotation[];
  onApply: (redactions: RedactAnnotation[]) => void;
  onCancel: () => void;
  onAddManual: () => void;
}

export function RedactionPreview({
  imageWidth: _imageWidth,
  imageHeight: _imageHeight,
  detectedRegions,
  manualRedactions,
  onApply,
  onCancel,
  onAddManual,
}: RedactionPreviewProps) {
  const [selectedRegions, setSelectedRegions] = useState<Set<number>>(
    new Set(detectedRegions.map((_, i) => i)),
  );
  const [redactionStyle, setRedactionStyle] = useState<'blur' | 'pixelate' | 'blackbox'>('blur');

  const handleToggle = (index: number) => {
    const newSelected = new Set(selectedRegions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRegions(newSelected);
  };

  const handleApply = () => {
    // Convert selected detected regions to RedactAnnotations
    const autoRedactions: RedactAnnotation[] = detectedRegions
      .filter((_, i) => selectedRegions.has(i))
      .map((region) => ({
        id: crypto.randomUUID(),
        type: 'redact' as const,
        origin: { x: region.x, y: region.y },
        width: region.width,
        height: region.height,
        style: redactionStyle,
        reason: region.type,
        color: '#FF0000',
        thickness: 0,
        createdAt: Date.now(),
      }));

    // Combine with manual redactions
    const allRedactions = [...autoRedactions, ...manualRedactions];
    onApply(allRedactions);
  };

  const getPiiTypeLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'phone':
        return 'Phone';
      case 'ip':
        return 'IP Address';
      case 'credit_card':
        return 'Credit Card';
      default:
        return 'PII';
    }
  };

  const getPiiTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return '#2979FF';
      case 'phone':
        return '#00C853';
      case 'ip':
        return '#FF6F00';
      case 'credit_card':
        return '#D32F2F';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <div className="redaction-preview">
      <div className="redaction-header">
        <h3>PII Detected</h3>
        <p>
          Found {detectedRegions.length} potential PII region{detectedRegions.length !== 1 ? 's' : ''}
          {manualRedactions.length > 0 && ` + ${manualRedactions.length} manual`}
        </p>
      </div>

      {detectedRegions.length === 0 && manualRedactions.length === 0 && (
        <div className="redaction-empty">
          <p>No PII detected automatically.</p>
          <p>You can still add manual redactions below.</p>
        </div>
      )}

      {detectedRegions.length > 0 && (
        <>
          <div className="redaction-list">
            <h4>Auto-Detected PII:</h4>
            {detectedRegions.map((region, index) => (
              <label key={index} className="redaction-item">
                <input
                  type="checkbox"
                  checked={selectedRegions.has(index)}
                  onChange={() => handleToggle(index)}
                />
                <span
                  className="redaction-badge"
                  style={{ backgroundColor: getPiiTypeColor(region.type) }}
                >
                  {getPiiTypeLabel(region.type)}
                </span>
                <span className="redaction-text">{region.matchedText}</span>
                <span className="redaction-confidence">
                  {Math.round(region.confidence * 100)}% confident
                </span>
              </label>
            ))}
          </div>

          <div className="redaction-style">
            <h4>Redaction Style:</h4>
            <div className="style-options">
              <label>
                <input
                  type="radio"
                  name="redactionStyle"
                  value="blur"
                  checked={redactionStyle === 'blur'}
                  onChange={() => setRedactionStyle('blur')}
                />
                Blur
              </label>
              <label>
                <input
                  type="radio"
                  name="redactionStyle"
                  value="pixelate"
                  checked={redactionStyle === 'pixelate'}
                  onChange={() => setRedactionStyle('pixelate')}
                />
                Pixelate
              </label>
              <label>
                <input
                  type="radio"
                  name="redactionStyle"
                  value="blackbox"
                  checked={redactionStyle === 'blackbox'}
                  onChange={() => setRedactionStyle('blackbox')}
                />
                Black Box
              </label>
            </div>
          </div>
        </>
      )}

      {manualRedactions.length > 0 && (
        <div className="redaction-manual">
          <h4>Manual Redactions:</h4>
          <p>{manualRedactions.length} region{manualRedactions.length !== 1 ? 's' : ''} marked</p>
        </div>
      )}

      <div className="redaction-actions">
        <button className="btn-secondary" onClick={onAddManual}>
          Add Manual Redaction
        </button>
        <div className="redaction-actions-right">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={selectedRegions.size === 0 && manualRedactions.length === 0}
          >
            Apply Redactions
          </button>
        </div>
      </div>
    </div>
  );
}
