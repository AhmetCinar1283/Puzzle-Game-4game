import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.knowandconquer.app',
  appName: 'Know & Conquer',
  webDir: 'out',
  server: {
    // Serves web assets over HTTPS scheme on Android (required for IndexedDB / Dexie)
    androidScheme: 'https',
  },
  android: {
    // Built APK will use these values
    minWebViewVersion: 60,
  },
};

export default config;
