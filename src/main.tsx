import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, loadProfile } from './core/settings';
import './styles.css';

// Apply the saved theme before React paints so the first frame matches.
applyTheme(loadProfile().theme);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Native shell already owns install / offline packaging — skip the PWA worker.
const isNative = Capacitor.isNativePlatform();

if (isNative) {
  // Status bar chrome follows the dark shell (themes can override later).
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Dark }))
    .catch(() => {});
}

// Registered after load so fetching the worker never competes with the first
// paint. Failure is silent by design: without it the app is merely online-only.
if (!isNative && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Built from the configured base, so the app works from a Pages subpath as
    // happily as from a domain root.
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
