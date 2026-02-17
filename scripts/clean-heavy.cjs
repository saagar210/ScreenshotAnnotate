#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const removableDirs = [
  'dist',
  '.vite',
  'node_modules/.vite',
  'src-tauri/target',
];

for (const dir of removableDirs) {
  const fullPath = path.join(root, dir);
  fs.rmSync(fullPath, { recursive: true, force: true });
  console.log(`removed ${dir}`);
}
