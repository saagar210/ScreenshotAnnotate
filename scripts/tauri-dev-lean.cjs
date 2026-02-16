#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-annotate-lean-'));
const cargoTarget = path.join(tempRoot, 'cargo-target');
const viteCache = path.join(tempRoot, 'vite-cache');

fs.mkdirSync(cargoTarget, { recursive: true });
fs.mkdirSync(viteCache, { recursive: true });

const leanEnv = {
  ...process.env,
  CARGO_TARGET_DIR: cargoTarget,
  VITE_CACHE_DIR: viteCache,
};

let cleaned = false;
let child;

function cleanup() {
  if (cleaned) {
    return;
  }

  cleaned = true;
  try {
    fs.rmSync(tempRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    console.log(`lean cleanup complete: ${tempRoot}`);
  } catch (error) {
    console.warn(`lean cleanup warning: could not fully remove ${tempRoot}`);
    console.warn(`reason: ${error.code || error.message}`);
  }
}

function forwardSignal(signal) {
  if (child && !child.killed) {
    child.kill(signal);
  }
}

console.log('lean dev temp paths:');
console.log(`  CARGO_TARGET_DIR=${cargoTarget}`);
console.log(`  VITE_CACHE_DIR=${viteCache}`);

const forwardedArgs = process.argv.slice(2);
const tauriArgs = ['run', 'tauri', 'dev', ...(forwardedArgs.length > 0 ? ['--', ...forwardedArgs] : [])];

child = spawn('npm', tauriArgs, {
  stdio: 'inherit',
  env: leanEnv,
});

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  cleanup();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
