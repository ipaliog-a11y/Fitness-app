import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Short build stamp: date + last 4 of epoch for support / about screen. */
function buildStamp(): string {
  if (process.env.RUNLOG_BUILD) return process.env.RUNLOG_BUILD;
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const tail = String(d.getTime()).slice(-4);
  return `${y}${m}${day}.${tail}`;
}

export default defineConfig({
  // Pages serves the app from a subpath, so nothing may be rooted at '/'.
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(buildStamp()),
  },
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsDir: 'assets',
  },
});
