#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const removableDirs = [
  'node_modules',
  'dist',
  '.vite',
  '.codex_audit',
  'coverage',
  'src-tauri/target',
];

for (const dir of removableDirs) {
  const fullPath = path.join(root, dir);
  fs.rmSync(fullPath, { recursive: true, force: true });
  console.log(`removed ${dir}`);
}

function removeDsStore(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git') {
        continue;
      }

      removeDsStore(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name === '.DS_Store') {
      fs.rmSync(fullPath, { force: true });
      console.log(`removed ${path.relative(root, fullPath)}`);
    }
  }
}

removeDsStore(root);
