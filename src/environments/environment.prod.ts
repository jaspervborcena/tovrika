// PRODUCTION ENVIRONMENT - Uses jasperpos-1dfd5 Firebase project
export const environment = {
  production: true,  version: '1.0.3',  firebase: {
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
    ordersApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_orders_bq",
    // directOrdersApi intentionally disabled for Firestore-only Sales Summary
    directOrdersApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_orders_bq",
    salesSummaryApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_summary_bq",
    salesRevenueApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_revenue_bq",
    salesAdjustmentsApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_adjustments_bq",
    salesCustomersApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_customers_bq",
    salesStatusBreakdownApi: "https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/get_sales_status_breakdown_bq",
  },
  inventory: {
    // reconciliationMode: 'legacy' uses client-side FIFO; 'recon' defers to Cloud Function with tracking
    reconciliationMode: 'recon' as 'legacy' | 'recon'
  },
  paypal: {
    // Production must use the real live PayPal client ID here.
    // If this value is empty, the app will fail to load the PayPal SDK until the backend
    // endpoint is deployed and the live config is available.
    clientId: '',
    sandbox: false,
    apiUrl: 'https://asia-east1-jasperpos-1dfd5.cloudfunctions.net'
  },
  maya: {
    apiUrl: 'https://asia-east1-jasperpos-1dfd5.cloudfunctions.net'
  }
};
