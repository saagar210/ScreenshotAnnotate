import type { AnnotationTool } from '../types';

interface ToolbarProps {
  currentTool: AnnotationTool;
  currentColor: string;
  currentThickness: number;
  onToolChange: (tool: AnnotationTool) => void;
  onColorChange: (color: string) => void;
  onThicknessChange: (thickness: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onCancel: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const COLOR_PRESETS = [
  { name: 'Red', value: '#FF0000' },
  { name: 'Yellow', value: '#FFD700' },
  { name: 'Green', value: '#00C853' },
  { name: 'Blue', value: '#2979FF' },
];

export function Toolbar({
  currentTool,
  currentColor,
  currentThickness,
  onToolChange,
  onColorChange,
  onThicknessChange,
  onUndo,
  onRedo,
  onSave,
  onCancel,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>Tools</h3>
        <div className="tool-buttons">
          <button
            className={currentTool === 'arrow' ? 'active' : ''}
            onClick={() => onToolChange('arrow')}
            title="Arrow (A)"
          >
            ↗ Arrow
          </button>
          <button
            className={currentTool === 'rectangle' ? 'active' : ''}
            onClick={() => onToolChange('rectangle')}
            title="Rectangle (R)"
          >
            ▭ Rectangle
          </button>
          <button
            className={currentTool === 'text' ? 'active' : ''}
            onClick={() => onToolChange('text')}
            title="Text (T)"
          >
            T Text
          </button>
          <button
            className={currentTool === 'freehand' ? 'active' : ''}
            onClick={() => onToolChange('freehand')}
            title="Freehand (F)"
          >
            ✎ Freehand
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Color</h3>
        <div className="color-presets">
          {COLOR_PRESETS.map(preset => (
            <button
              key={preset.value}
              className={`color-btn ${currentColor === preset.value ? 'active' : ''}`}
              style={{ backgroundColor: preset.value }}
              onClick={() => onColorChange(preset.value)}
              title={preset.name}
              aria-label={preset.name}
            />
          ))}
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            title="Custom color"
          />
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Thickness</h3>
        <input
          type="range"
          min="1"
          max="8"
          value={currentThickness}
          onChange={(e) => onThicknessChange(Number(e.target.value))}
        />
        <span>{currentThickness}px</span>
      </div>

      <div className="toolbar-section toolbar-actions">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Cmd+Z)">
          ↶ Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)">
          ↷ Redo
        </button>
      </div>

      <div className="toolbar-section toolbar-actions">
        <button className="btn-primary" onClick={onSave} title="Save (Cmd+S)">
          Save
        </button>
        <button className="btn-secondary" onClick={onCancel} title="Cancel (Esc)">
          Cancel
        </button>
      </div>
    </div>
  );
}
