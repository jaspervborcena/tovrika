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
  api: {
    // During local development we route Cloud Function calls through the Angular dev proxy
    // so the browser sees same-origin requests (avoids CORS preflight failures).
    baseUrl: "/api/functions",
    ordersApi: "/api/orders", // Uses proxy in development
    // directOrdersApi intentionally disabled for Firestore-only Sales Summary to avoid accidental external calls
    directOrdersApi: "",
    // productsApi removed - now using Firestore real-time updates
  },
  inventory: {
    // reconciliationMode: 'legacy' uses client-side FIFO; 'recon' defers to Cloud Function with tracking
    reconciliationMode: 'recon' as 'legacy' | 'recon'
  }
};
