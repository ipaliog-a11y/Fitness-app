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

// Registered after load so fetching the worker never competes with the first
// paint. Failure is silent by design: without it the app is merely online-only.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Built from the configured base, so the app works from a Pages subpath as
    // happily as from a domain root.
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
