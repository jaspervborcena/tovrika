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
    tier: 'standard',
    name: 'Basic Plan',
    price: 599,
    billingCycle: 'monthly',
    currency: '₱',
    description: 'Perfect for small businesses',
    cta: 'Start 14-Day Trial',
    features: [
      '14-day free trial',
      '1 Store Location',
      'Any Laptop, Computer, or Android device',
      '4 Users (Owner + Store Manager + 2 Cashiers)',
      '50 Products Maximum',
      '10,000 Transactions',
      '3-Month Data History',
      'Cash + GCash',
      'Thermal Receipt Printing',
      'Expansion: +₱500 per additional store',
      '+50 Products & +10,000 Transactions per added store',
      '+4 Users (Owner + Manager + 2 Cashiers) per added store'
    ],
    limits: {
      stores: 1,
      users: '4 (Owner + Store Manager + 2 Cashiers)',
      devices: 'unlimited',
      transactions: 10000,
      products: 50,
      dataRetention: '3 months'
    }
  },
  {
    tier: 'premium',
    name: 'Standard Plan',
    price: 1099,
    billingCycle: 'monthly',
    currency: '₱',
    popular: true,
    badge: 'Most Popular',
    description: 'Built for growing teams',
    cta: 'Start 14-Day Trial',
    features: [
      '14-day free trial',
      '1 Store Location',
      'Any Laptop, Computer, or Android device',
      '10 Users (Owner + Store Managers + Cashiers)',
      '150 Products Maximum',
      '25,000 Transactions',
      '1-Year Data History',
      'Cash + GCash',
      'Thermal Receipt Printing',
      'Additional features available',
      'Priority email support'
    ],
    limits: {
      stores: 1,
      users: '10 (Owner + Store Managers + Cashiers)',
      devices: 'unlimited',
      transactions: 25000,
      products: 150,
      dataRetention: '1 year'
    }
  },
  {
    tier: 'enterprise',
    name: 'Premium Plan',
    price: 3999,
    billingCycle: 'monthly',
    currency: '₱',
    description: 'Designed for large businesses (Billed quarterly)',
    cta: 'Contact Us',
    features: [
      'Up to 10 Branches included',
      'Any Laptop, Computer, or Android device',
      '50 Users (Full Staffing for all branches)',
      '1,500 Products Maximum',
      '150,000 Transactions',
      '3+ Years Data History',
      'Cash, GCash, & Credit Card',
      'Dedicated Pipeline (Private & Secure)',
      'Domain Integration (yourbrand.com)',
      'New Requests & Custom Features (Prioritized)',
      'Thermal Receipt Printing',
      'Early access to Integrated Payment APIs',
      'Priority Support (Direct Line to Developer)',
      'Billed quarterly with annual options'
    ],
    limits: {
      stores: 10,
      users: '50 (Full Staffing for all branches)',
      devices: 'unlimited',
      transactions: 150000,
      products: 1500,
      dataRetention: '3+ years'
    }
  }
];

export const SUBSCRIPTION_FEATURES: SubscriptionPlanFeature[] = [
  {
    name: 'Trial Period',
    description: 'Free trial duration',
  freemium: '14 days',
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
  freemium: '14 days',
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
    tooltip: 'GCash, cards, etc.'
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
