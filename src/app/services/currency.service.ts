import { Injectable } from '@angular/core';
import { Currency, CurrencySymbol, CurrencyConfig, CURRENCY_CONFIGS } from '../interfaces/currency.interface';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private _currentCurrency = Currency.PHP; // Default to Philippine Peso

  get currentCurrency(): Currency {
    return this._currentCurrency;
  }

  get currentCurrencySymbol(): CurrencySymbol {
    return CURRENCY_CONFIGS[this._currentCurrency].symbol;
  }

  get currentCurrencyConfig(): CurrencyConfig {
    return CURRENCY_CONFIGS[this._currentCurrency];
  }

  setCurrency(currency: Currency): void {
    this._currentCurrency = currency;
  }

  formatAmount(amount: number, currency?: Currency): string {
    const currencyToUse = currency || this._currentCurrency;
    const config = CURRENCY_CONFIGS[currencyToUse];
    
    // Format with proper decimal places
    const formattedAmount = amount.toFixed(2);
    
    return `${config.symbol}${formattedAmount}`;
  }

  formatAmountWithCode(amount: number, currency?: Currency): string {
    const currencyToUse = currency || this._currentCurrency;
    const config = CURRENCY_CONFIGS[currencyToUse];
    
    const formattedAmount = amount.toFixed(2);
    
    return `${config.symbol}${formattedAmount} ${config.code}`;
  }

  parseAmount(amountString: string): number {
    // Remove currency symbols and parse
    const cleanAmount = amountString.replace(/[₱$€£¥,]/g, '').trim();
    return parseFloat(cleanAmount) || 0;
  }

  getAllCurrencies(): CurrencyConfig[] {
    return Object.values(CURRENCY_CONFIGS);
  }

  getCurrencyByCode(code: Currency): CurrencyConfig {
    return CURRENCY_CONFIGS[code];
  }
}
