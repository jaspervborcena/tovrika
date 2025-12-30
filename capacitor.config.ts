import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.pos',
  appName: 'POS System',
  webDir: 'dist/pos-system/browser',
  
  server: {
    // Use HTTPS scheme for better compatibility
    androidScheme: 'https',
    
    // Allow cleartext HTTP for local network printers
    cleartext: true,
    
    // Allow navigation to external URLs (for payment gateways, etc.)
    allowNavigation: [
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'https://*.google.com'
    ]
  },
  
  android: {
    // Allow mixed content for local printer communication
    allowMixedContent: true,
    
    // Capture input for better form handling
    captureInput: true,
    
    // Enable web contents debugging (disable in production)
    webContentsDebuggingEnabled: true,
    
    // Background color while app loads
    backgroundColor: '#ffffff',
    
    // Handle keyboard behavior
    loggingBehavior: 'debug',
    
    // Build configuration
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK'
    }
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999',
      splashFullScreen: true,
      splashImmersive: true
    },
    
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff'
    },
    
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    
    App: {
      // Handle back button
      overrideBackButton: false
    }
  }
};

export default config;
