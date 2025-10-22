// Add these to your environment files
export const environment = {
  production: false, // or true for production
  firebase: {
    // your existing firebase config
  },
  
  // Google Cloud Logging Configuration
  cloudLogging: {
    projectId: 'jasperpos-1dfd5',
    logName: 'pos-application-logs',
    enabled: true, // Set to false to disable logging in development
    offlineStorageKey: 'pos_offline_logs',
    maxOfflineLogs: 1000 // Maximum number of logs to store offline
  }
};