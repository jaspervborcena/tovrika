// DEVELOPMENT ENVIRONMENT - Uses jasperpos-dev Firebase project

// Dynamic environment detection for web
let isProd = false;
let paypalConfig = {
  clientId: 'ASj0btqJ9ctHcaXO19btNq5AiAPcvMJ-V-xqq9atKiuiJ2uGQ0JoAHlCXWwM_m5_Zdmn9CQkYxQkiQGu',
  sandbox: true,
  apiUrl: '/paypal'
};

if (typeof window !== 'undefined' && window.location && window.location.hostname) {
  const host = window.location.hostname;
  if (host === 'app.pos.tovrika.com') {
    isProd = true;
    paypalConfig = {
      clientId: '', // Set your live client ID here or load dynamically
      sandbox: false,
      apiUrl: 'https://asia-east1-jasperpos-1dfd5.cloudfunctions.net'
    };
  }
}

export const environment = {
  production: isProd,
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
    baseUrl: "",
    ordersApi: "",
    directOrdersApi: "",
  },
  inventory: {
    reconciliationMode: 'recon' as 'legacy' | 'recon'
  },
  paypal: paypalConfig
};
