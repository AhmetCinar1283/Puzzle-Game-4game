import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.polimelo.syncroncap',
  appName: 'Syncron',
  webDir: 'out',
  android: {
    minWebViewVersion: 60,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '1041986277726-9otkut2eqcl61rs3rokmgcqn184g42pu.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;