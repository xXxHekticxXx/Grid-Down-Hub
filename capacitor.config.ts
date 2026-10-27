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
  plugins: {},
};

export default config;
