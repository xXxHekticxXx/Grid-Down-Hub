import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xxxhekticxxx.griddownhub',
  appName: 'Grid-Down Hub',
  webDir: 'dist',
  android: {
    // Map packs are fetched from the GitHub Pages site over HTTPS only.
    allowMixedContent: false,
    backgroundColor: '#161A17',
  },
  plugins: {
    // Android 15+ draws apps edge to edge. Keep the WebView's safe-area values correct so the top bar
    // (Back, Add, Edit) sits below the phone's status bar instead of under it.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
    // In-app updates from the Grid-Down Hub site only (src/lib/updater.ts). Nothing is sent anywhere:
    // no automatic checks against the plugin maker's servers and no usage statistics.
    CapacitorUpdater: { autoUpdate: false, statsUrl: '', resetWhenUpdate: true, appReadyTimeout: 15000 },
  },
};

export default config;
