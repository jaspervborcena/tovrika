export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyDNIYovvzNKVj40h99kxOHu5yfEUzx7OYA",
    authDomain: "jasperpos-1dfd5.firebaseapp.com",
    projectId: "jasperpos-1dfd5",
    storageBucket: "jasperpos-1dfd5.firebasestorage.app",
    messagingSenderId: "251258556341",
    appId: "1:251258556341:web:28cdcafbdb4ad89675d3fc",
    measurementId: "G-MG8T2RZ051"
  },
  // Endpoint for UI to POST structured logs to Cloud Functions (HTTP). Replace with your Python function URL.
  // Example pattern: https://REGION-PROJECT_ID.cloudfunctions.net/app-logs
  cloudLoggingEndpoint: 'https://app-logs-7bpeqovfmq-de.a.run.app',
  // Optional API Key header for logging endpoint (sent as X-API-Key)
  cloudLoggingApiKey: '',
  api: {
    baseUrl: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net",
    ordersApi: "https://get-orders-by-date-bq-7bpeqovfmq-de.a.run.app", // BigQuery-backed endpoint
    directOrdersApi: "https://get-orders-by-date-bq-7bpeqovfmq-de.a.run.app"
  },
  inventory: {
    reconciliationMode: 'legacy' as 'legacy' | 'recon' // Default to legacy in prod until rollout
  },
  cloudLogging: {
    projectId: 'jasperpos-1dfd5',
    logName: 'pos-application-logs',
    enabled: true, // Always enabled in production
    offlineStorageKey: 'pos_offline_logs',
    maxOfflineLogs: 500 // Smaller limit for production
  }
};
