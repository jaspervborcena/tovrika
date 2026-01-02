import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tovrika.app',
  appName: 'app-tovrika',
  webDir: 'dist/pos-system/browser',
  server: {
    androidScheme: 'https'
  }
};

export default config;
