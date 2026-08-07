import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the Vite web build (`dist/`) as a native Android shell.
 *
 * Core run logic stays in `src/core/`; sensors still use the Web APIs in
 * `src/platform/` inside the system WebView. See docs/ANDROID.md for BLE limits,
 * permissions, and JDK requirements.
 */
const config: CapacitorConfig = {
  appId: 'app.runlog.local',
  appName: 'RunLog',
  webDir: 'dist',
  server: {
    // Bundled assets only — no remote URL in production builds.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0a0d12',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0d12',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0d12',
    },
  },
};

export default config;
