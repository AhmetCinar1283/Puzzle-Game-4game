import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.polimelo.syncron.app',
  appName: 'Syncron',
  webDir: 'out',
  android: {
    minWebViewVersion: 60,
  },
};

export default config;