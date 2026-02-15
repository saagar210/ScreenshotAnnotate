# Screenshot Annotate

A macOS desktop screenshot annotation tool built with Tauri 2 + React 19 that collapses the 3-minute manual annotation workflow into ~20 seconds.

## Features

### ✅ Phase 0 + 1 (COMPLETE)

**Screenshot Capture:**
- Global hotkey `⌘⇧5` (Cmd+Shift+5) triggers native macOS screenshot capture
- Interactive region selection with native crosshair
- Automatic temp file management

**Interactive Annotation:**
- 4 annotation tools: Arrow (with arrowhead), Rectangle, Text, Freehand
- Undo/Redo stack (50 steps)
- Color picker (4 presets + custom hex)
- Thickness control (1-8px)
- Keyboard shortcuts: `A`/`R`/`T`/`F` for tools, `⌘Z`/`⇧⌘Z` for undo/redo

**Export + History:**
- Save annotated screenshots as PNG
- Local file-based storage (500MB budget with LRU eviction)
- Searchable thumbnail gallery
- Storage usage tracking
- Delete with confirmation

## Installation

### Prerequisites

- macOS 13+ (Ventura or later)
- Node.js 18+
- Rust 1.70+ (install via [rustup](https://rustup.rs/))

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Housekeeping

Use this command to remove generated local artifacts and keep the repo lean:

```bash
npm run clean
```

### First Run Permissions

On first launch, macOS will prompt you to grant **Screen Recording** permission:

1. System Settings → Privacy & Security → Screen Recording
2. Enable permission for "Screenshot Annotate"
3. Restart the app

## Usage

1. **Capture**: Press `⌘⇧5` (or click "Capture Screenshot")
2. **Select region**: Drag to select the area (native macOS crosshair)
3. **Annotate**: Draw arrows, rectangles, text, or freehand
4. **Save**: Click "Save" button or press `⌘S`
5. **View History**: Click "View History" button on idle screen

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Capture screenshot | `⌘⇧5` |
| Switch to Arrow tool | `A` |
| Switch to Rectangle tool | `R` |
| Switch to Text tool | `T` |
| Switch to Freehand tool | `F` |
| Undo | `⌘Z` |
| Redo | `⌘⇧Z` |
| Save | `⌘S` |
| Cancel | `Esc` |

## Development Roadmap

### ✅ Phase 0: Screenshot Capture + Annotation (COMPLETE)
- macOS screenshot capture via `screencapture` CLI
- Interactive SVG annotation canvas
- 4 annotation tools (arrow, rectangle, text, freehand)
- Undo/redo stack management
- Keyboard shortcuts

### ✅ Phase 1: Export + History (COMPLETE)
- Export annotated screenshots as PNG (html-to-image + Rust compositing)
- Local file-based history (500MB budget)
- Thumbnail gallery with search
- Storage usage tracking
- LRU eviction

### 📋 Phase 2: PII Detection + Redaction (NEXT)
- Tesseract.js OCR (WASM-based)
- Auto-detect email, phone, IP, credit card
- Manual redaction tool
- Blur/pixelate/blackbox styles

### 📋 Phase 3: Jira/Zendesk Upload
- API client for Jira Cloud + Zendesk
- OAuth token management (macOS Keychain)
- Ticket auto-detection from clipboard
- Upload confirmation + URL copy

### 📋 Phase 4: Templates + Polish
- 3 built-in templates (Error Highlight, Click Here, Step by Step)
- Dark/light mode
- Settings panel (hotkey config, retention, API credentials)
- History cleanup (auto-delete after N days)

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, SVG rendering, html-to-image
- **Backend**: Rust, Tauri 2
- **Screenshot**: macOS `screencapture` CLI
- **Storage**: File-based (~/Library/Application Support/)
- **Future**: tesseract.js (OCR), macOS Keychain (credentials)

## Storage Location

Screenshots are saved to:
```
~/Library/Application Support/com.screenshot-annotate/history/
```

Each screenshot is stored in a self-contained directory with:
- `original.png` - unmodified capture
- `annotated.png` - final export with annotations
- `thumbnail.png` - 200px-wide preview
- `meta.json` - metadata
- `annotations.json` - annotation data

## Performance

All targets met on M4 Pro:
- Hotkey → crosshair: ~350ms ✅
- Annotation rendering: <16ms ✅
- Export + save: ~400ms ✅
- App startup: ~1.5s ✅

## Project Structure

```
screenshot-annotate/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── lib.rs       # Tauri app setup
│   │   ├── capture.rs   # Screenshot capture
│   │   ├── export.rs    # PNG compositing
│   │   └── history.rs   # File-based storage
│   └── Cargo.toml
├── src/                 # React frontend
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── App.tsx
└── README.md
```

## Contributing

This is a personal-use tool for IT support engineers. Feature requests and bug reports welcome via GitHub Issues.

## License

MIT

---

**Current Status**: Phase 1 complete ✅  
**Next**: Phase 2 (PII Detection + Redaction) - ETA 4 days  
**Total LOC**: ~2,200 (Phase 0 + 1)
