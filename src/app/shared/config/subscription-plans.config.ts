/**
 * Realistic Subscription Plans Configuration
 * Based on actual POS system features
 */

export interface SubscriptionPlanFeature {
  name: string;
  description: string;
  freemium: boolean | string | number;
  standard: boolean | string | number;
  premium: boolean | string | number;
  enterprise: boolean | string | number;
  icon?: string;
  tooltip?: string;
}

export interface SubscriptionPlan {
  tier: 'freemium' | 'standard' | 'premium' | 'enterprise';
  name: string;
  price: number | null;
  billingCycle: 'monthly';
  currency: string;
  popular?: boolean;
  description: string;
  badge?: string;
  cta: string;
  features: string[];
  limits: {
    stores: number | 'unlimited';
    users: number | string;
    devices: number | 'unlimited';
    transactions: number | 'unlimited';
    products: number | 'unlimited';
    dataRetention: string;
  };
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: 'freemium',
    name: 'Freemium (Trial)',
    price: 0,
    billingCycle: 'monthly',
    currency: '₱',
    description: 'Start free for 30 days with basic POS access',
    cta: 'Start Free Trial',
    features: [
      '30-day free trial',
      '1 Store Location',
      '1 POS Device',
      '2 Users (Admin + Cashier)',
      '50 Products Maximum',
      '100 Transactions',
      'Basic POS (Cash only)',
      'Thermal Receipt Printing',
      'Offline Mode After Trial',
      '⚠️ Trial data deleted after 30 days'
    ],
    limits: {
      stores: 1,
      users: '2 (Admin + 1)',
      devices: 1,
      transactions: 100,
      products: 50,
      dataRetention: '30 days (deleted after)'
    }
  },
  {
    tier: 'standard',
    name: 'Standard',
    price: 599,
    billingCycle: 'monthly',
    currency: '₱',
    description: 'Perfect for small businesses',
    cta: 'Subscribe Now',
    features: [
      '7-day free trial',
      '2 Store Locations',
      '4 POS Devices per Store',
      '5 Users + 3 Custom Roles',
      '500 Products',
      '100,000 Transactions/Month',
      'Real-time Cloud Sync',
      '1-Month Data Retention',
      'Cash + GCash/Maya',
      'Thermal + Email Receipts',
      'Basic Inventory & Stock Alerts',
      'Daily/Weekly/Monthly Reports',
      'CSV Export',
      'Automated VAT Calculation',
      'BIR-Ready Reports',
      '24-Hour Offline Buffer',
      'Email Support (48h response)'
    ],
    limits: {
      stores: 2,
      users: 5,
      devices: 4,
      transactions: 100000,
      products: 500,
      dataRetention: '1 month'
    }
  },
  {
    tier: 'premium',
    name: 'Premium',
    price: 1499,
    billingCycle: 'monthly',
    currency: '₱',
    popular: true,
    badge: 'Most Popular',
    description: 'Built for growing teams',
    cta: 'Start Premium',
    features: [
      '7-day free trial',
      '5 Store Locations',
      '10 POS Devices per Store',
      '15 Users + Unlimited Custom Roles',
      'Unlimited Products',
      '20,000 Transactions/Month',
      'Real-time Cloud Sync',
      '6-Month Data Retention',
      'Cash + 5 Payment Methods',
      'Thermal + Email + SMS Receipts',
      'Advanced Inventory (Batch, Expiry)',
      'Custom Date Range Reports',
      'CSV/Excel/PDF Export',
      'Customer CRM (1,000 customers)',
      'Loyalty Points Program',
      'Automated BIR Compliance',
      'Custom Reports (5 reports)',
      '7-Day Offline Buffer',
      'Priority Support (24h) + Chat',
      'Two-Factor Authentication'
    ],
    limits: {
      stores: 5,
      users: 15,
      devices: 10,
      transactions: 20000,
      products: 'unlimited',
      dataRetention: '6 months'
    }
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: null,
    billingCycle: 'monthly',
    currency: '₱',
    description: 'Designed for large businesses',
    cta: 'Request Demo',
    features: [
      'Custom trial period',
      'Unlimited Stores',
      'Unlimited Devices',
      'Unlimited Users',
      'Unlimited Products',
      'Unlimited Transactions',
      'Real-time Cloud Sync',
      'Unlimited Data Retention',
      'All Payment Methods + Custom Gateway',
      'All Receipt Types + Custom Templates',
      'Multi-Warehouse Management',
      'Real-time Analytics Dashboard',
      'All Export Formats + Scheduled Reports',
      'Unlimited Customer CRM',
      'Advanced Loyalty Tiers',
      'Full BIR Automation + Multi-Entity',
      'Unlimited Custom Reports',
      'Unlimited Offline Mode',
      'Custom Domain (yourbrand.com)',
      'White-Label App',
      'Full REST API Access',
      'Custom Integrations',
      'Dedicated Account Manager',
      'Phone Support (24/7)',
      'Custom Training + Onboarding',
      '99.9% SLA Guarantee'
    ],
    limits: {
      stores: 'unlimited',
      users: 'unlimited',
      devices: 'unlimited',
      transactions: 'unlimited',
      products: 'unlimited',
      dataRetention: 'unlimited'
    }
  }
];

export const SUBSCRIPTION_FEATURES: SubscriptionPlanFeature[] = [
  {
    name: 'Trial Period',
    description: 'Free trial duration',
    freemium: '30 days',
    standard: '7 days',
    premium: '7 days',
    enterprise: 'Custom',
    icon: 'calendar',
    tooltip: 'Try before you subscribe'
  },
  {
    name: 'Stores',
    description: 'Number of store locations',
    freemium: 1,
    standard: 2,
    premium: 5,
    enterprise: 'Unlimited',
    icon: 'store',
    tooltip: 'Each location counts as one store'
  },
  {
    name: 'Devices per Store',
    description: 'POS terminals per location',
    freemium: 1,
    standard: 4,
    premium: 10,
    enterprise: 'Unlimited',
    icon: 'devices',
    tooltip: 'Each cashier needs their own device'
  },
  {
    name: 'Products',
    description: 'Product catalog size',
    freemium: 50,
    standard: 500,
    premium: 'Unlimited',
    enterprise: 'Unlimited',
    icon: 'inventory',
    tooltip: 'Unique SKUs in your inventory'
  },
  {
    name: 'Users/Cashiers',
    description: 'Staff member accounts',
    freemium: '2 (Admin + 1)',
    standard: 5,
    premium: 15,
    enterprise: 'Unlimited',
    icon: 'people',
    tooltip: 'Each user gets their own login'
  },
  {
    name: 'Transactions/Month',
    description: 'Monthly sales limit',
    freemium: 100,
    standard: 100000,
    premium: 20000,
    enterprise: 'Unlimited',
    icon: 'receipt',
    tooltip: 'Each sale counts as one transaction'
  },
  {
    name: 'Data Sync',
    description: 'Cloud synchronization',
    freemium: 'Local only',
    standard: 'Real-time',
    premium: 'Real-time',
    enterprise: 'Real-time',
    icon: 'cloud_sync',
    tooltip: 'Keep all devices in sync'
  },
  {
    name: 'Data Retention',
    description: 'Historical data storage',
    freemium: '30 days',
    standard: '1 month',
    premium: '6 months',
    enterprise: 'Unlimited',
    icon: 'storage',
    tooltip: 'How long sales data is kept'
  },
  {
    name: 'Payment Methods',
    description: 'Accepted payment types',
    freemium: 'Cash only',
    standard: 'Cash + 2 digital',
    premium: 'Cash + 5 methods',
    enterprise: 'All + custom',
    icon: 'payment',
    tooltip: 'GCash, Maya, cards, etc.'
  },
  {
    name: 'Receipts',
    description: 'Receipt delivery options',
    freemium: 'Thermal only',
    standard: 'Thermal + Email',
    premium: 'Thermal + Email + SMS',
    enterprise: 'All + custom',
    icon: 'print',
    tooltip: 'How customers receive receipts'
  },
  {
    name: 'Inventory',
    description: 'Stock management features',
    freemium: false,
    standard: 'Basic (count + alerts)',
    premium: 'Advanced (batch, expiry)',
    enterprise: 'Multi-warehouse',
    icon: 'inventory_2',
    tooltip: 'Track product stock levels'
  },
  {
    name: 'Reports',
    description: 'Sales reporting capabilities',
    freemium: 'Today only',
    standard: 'Daily/Weekly/Monthly',
    premium: 'Custom date range',
    enterprise: 'Real-time dashboard',
    icon: 'analytics',
    tooltip: 'View sales performance'
  },
  {
    name: 'Export Formats',
    description: 'Download report formats',
    freemium: false,
    standard: 'CSV',
    premium: 'CSV/Excel/PDF',
    enterprise: 'All + scheduled',
    icon: 'download',
    tooltip: 'Share with accountant'
  },
  {
    name: 'BIR Compliance',
    description: 'Tax and regulatory features',
    freemium: 'Manual',
    standard: 'Automated VAT',
    premium: 'Automated + tracking',
    enterprise: 'Full automation',
    icon: 'verified',
    tooltip: 'Philippine BIR requirements'
  },
  {
    name: 'Customer CRM',
    description: 'Customer database',
    freemium: false,
    standard: false,
    premium: '1,000 customers',
    enterprise: 'Unlimited',
    icon: 'contacts',
    tooltip: 'Store customer information'
  },
  {
    name: 'Loyalty Program',
    description: 'Reward repeat customers',
    freemium: false,
    standard: false,
    premium: 'Basic points',
    enterprise: 'Advanced tiers',
    icon: 'loyalty',
    tooltip: 'Build customer loyalty'
  },
  {
    name: 'Offline Buffer',
    description: 'Work without internet',
    freemium: 'Full (post-trial)',
    standard: '24 hours',
    premium: '7 days',
    enterprise: 'Unlimited',
    icon: 'offline_bolt',
    tooltip: 'Syncs when connection returns'
  },
  {
    name: 'Support',
    description: 'Customer support channels',
    freemium: 'Community/FAQs',
    standard: 'Email (48h)',
    premium: 'Chat + priority (24h)',
    enterprise: 'Phone + Dedicated AM',
    icon: 'support_agent',
    tooltip: 'Get help when you need it'
  },
  {
    name: 'API Access',
    description: 'Integrate with other systems',
    freemium: false,
    standard: false,
    premium: false,
    enterprise: 'Full REST API',
    icon: 'api',
    tooltip: 'Connect to ERP, accounting, etc.'
  },
  {
    name: 'Custom Domain',
    description: 'Use your own domain name',
    freemium: false,
    standard: false,
    premium: false,
    enterprise: 'yourbrand.com',
    icon: 'language',
    tooltip: 'Brand your POS system'
  }
];

export const PROMO_CODES = {
  LAUNCH50: { discount: 50, description: 'Launch Promo - 50% off first month' },
  FRIEND20: { discount: 20, description: 'Friend Referral - 20% off' },
  ANNUAL15: { discount: 15, description: 'Annual Plan - 15% discount' },
  WELCOME10: { discount: 10, description: 'Welcome Discount - 10% off' }
};

export function getPlanByTier(tier: 'freemium' | 'standard' | 'premium' | 'enterprise'): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.tier === tier);
}

export function calculateFinalAmount(
  basePrice: number,
  discountPercent: number,
  durationMonths: number = 1
): number {
  const totalPrice = basePrice * durationMonths;
  const discountAmount = (totalPrice * discountPercent) / 100;
  return totalPrice - discountAmount;
}

export function validatePromoCode(code: string): { valid: boolean; discount: number; description: string } {
  const promo = PROMO_CODES[code.toUpperCase() as keyof typeof PROMO_CODES];
  if (promo) {
    return { valid: true, discount: promo.discount, description: promo.description };
  }
  return { valid: false, discount: 0, description: 'Invalid promo code' };
}

export function calculateExpiryDate(durationMonths: number, startDate: Date = new Date()): Date {
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
  return expiryDate;
}
