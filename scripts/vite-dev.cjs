#!/usr/bin/env node
const { spawn } = require('child_process');

const args = process.argv.slice(2);

const child = spawn('npm', ['exec', 'vite', '--', ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
