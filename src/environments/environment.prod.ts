// PRODUCTION ENVIRONMENT - Uses jasperpos-1dfd5 Firebase project
export const environment = {
  production: true,  version: '1.0.0',  firebase: {
    apiKey: "AIzaSyDNIYovvzNKVj40h99kxOHu5yfEUzx7OYA",
    authDomain: "jasperpos-1dfd5.firebaseapp.com",
    projectId: "jasperpos-1dfd5",
    storageBucket: "jasperpos-1dfd5.firebasestorage.app",
    messagingSenderId: "251258556341",
    appId: "1:251258556341:web:28cdcafbdb4ad89675d3fc",
    measurementId: "G-MG8T2RZ051"
  },
  api: {
    // Disabled in frontend; production builds should avoid calling Cloud Functions from the UI directly.
    baseUrl: "",
    ordersApi: "",
    // directOrdersApi intentionally disabled for Firestore-only Sales Summary
    directOrdersApi: "",
  },
  inventory: {
    // reconciliationMode: 'legacy' uses client-side FIFO; 'recon' defers to Cloud Function with tracking
    reconciliationMode: 'recon' as 'legacy' | 'recon'
  }
};
