interface KeyboardShortcutsHelpProps {
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    { keys: ['⌘', '⇧', '5'], description: 'Capture screenshot' },
    { keys: ['A'], description: 'Switch to Arrow tool' },
    { keys: ['R'], description: 'Switch to Rectangle tool' },
    { keys: ['T'], description: 'Switch to Text tool' },
    { keys: ['F'], description: 'Switch to Freehand tool' },
    { keys: ['⌘', 'Z'], description: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
    { keys: ['⌘', 'S'], description: 'Save screenshot' },
    { keys: ['Esc'], description: 'Cancel / Close' },
  ];

  return (
    <div className="keyboard-shortcuts-overlay" onClick={onClose}>
      <div className="keyboard-shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="shortcut-item">
              <div className="shortcut-keys">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    <kbd>{key}</kbd>
                    {i < shortcut.keys.length - 1 && <span className="key-separator">+</span>}
                  </span>
                ))}
              </div>
              <div className="shortcut-description">{shortcut.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
