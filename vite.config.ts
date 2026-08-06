import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Pages serves the app from a subpath, so nothing may be rooted at '/'.
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsDir: 'assets',
  },
});
