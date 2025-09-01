export enum Currency {
  USD = 'USD',
  PHP = 'PHP',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY'
}

export enum CurrencySymbol {
  USD = '$',
  PHP = '₱',
  EUR = '€',
  GBP = '£',
  JPY = '¥'
}

export interface CurrencyConfig {
  code: Currency;
  symbol: CurrencySymbol;
  name: string;
  locale?: string;
}

export const CURRENCY_CONFIGS: Record<Currency, CurrencyConfig> = {
  [Currency.USD]: {
    code: Currency.USD,
    symbol: CurrencySymbol.USD,
    name: 'US Dollar',
    locale: 'en-US'
  },
  [Currency.PHP]: {
    code: Currency.PHP,
    symbol: CurrencySymbol.PHP,
    name: 'Philippine Peso',
    locale: 'en-PH'
  },
  [Currency.EUR]: {
    code: Currency.EUR,
    symbol: CurrencySymbol.EUR,
    name: 'Euro',
    locale: 'en-EU'
  },
  [Currency.GBP]: {
    code: Currency.GBP,
    symbol: CurrencySymbol.GBP,
    name: 'British Pound',
    locale: 'en-GB'
  },
  [Currency.JPY]: {
    code: Currency.JPY,
    symbol: CurrencySymbol.JPY,
    name: 'Japanese Yen',
    locale: 'ja-JP'
  }
};
