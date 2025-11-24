// DEVELOPMENT ENVIRONMENT - Uses jasperpos-dev Firebase project
export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyABpbnPUjr16LnLU8WSJ1BmVvWy0tTmaI4",
    authDomain: "jasperpos-dev.firebaseapp.com",
    projectId: "jasperpos-dev",
    storageBucket: "jasperpos-dev.firebasestorage.app",
    messagingSenderId: "425012486350",
    appId: "1:425012486350:web:6a1289e238eb26fb36709f",
    measurementId: "G-5BLXC1688Z"
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
