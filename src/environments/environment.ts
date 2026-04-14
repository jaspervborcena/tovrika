// DEVELOPMENT ENVIRONMENT - Uses jasperpos-dev Firebase project
export const environment = {
  production: false,
  version: '1.0.1',
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
    // Disabled API endpoints for frontend; use Firestore-first flows instead.
    baseUrl: "",
    ordersApi: "",
    // directOrdersApi intentionally disabled for Firestore-only Sales Summary to avoid accidental external calls
    directOrdersApi: "",
  },
  inventory: {
    // reconciliationMode: 'legacy' uses client-side FIFO; 'recon' defers to Cloud Function with tracking
    reconciliationMode: 'recon' as 'legacy' | 'recon'
  },
  paypal: {
    // Sandbox client ID – safe to expose in frontend; secret stays in functions/.env
    clientId: 'ASj0btqJ9ctHcaXO19btNq5AiAPcvMJ-V-xqq9atKiuiJ2uGQ0JoAHlCXWwM_m5_Zdmn9CQkYxQkiQGu',
    sandbox: true,
    // Proxied via proxy.conf.json → asia-east1-jasperpos-dev.cloudfunctions.net/paypal
    apiUrl: '/paypal'
  }
};
