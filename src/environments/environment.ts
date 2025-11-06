export const environment = {
  production: false,
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
  cloudLoggingEndpoint: '',
  // Optional API Key header for logging endpoint (sent as X-API-Key)
  cloudLoggingApiKey: '',
  api: {
    baseUrl: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net",
    ordersApi: "/api", // Uses proxy in development
    directOrdersApi: "https://get-orders-by-date-bq-7bpeqovfmq-de.a.run.app", // Updated to BQ endpoint
    productsApi: "https://get-products-bq-7bpeqovfmq-de.a.run.app" // BigQuery products endpoint (Cloud Run)
  },
  inventory: {
    // reconciliationMode: 'legacy' uses client-side FIFO; 'recon' defers to Cloud Function with tracking
    reconciliationMode: 'recon' as 'legacy' | 'recon'
  },
  cloudLogging: {
    projectId: 'jasperpos-1dfd5',
    logName: 'pos-application-logs',
    enabled: true, // Set to false to disable logging in development
    consoleSink: false, // Disable console sink in development to avoid noisy logs
    offlineStorageKey: 'pos_offline_logs',
    maxOfflineLogs: 1000
  }
};
