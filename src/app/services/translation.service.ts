import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  flag: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly STORAGE_KEY = 'selected-language';
  
  // Available languages
  public readonly availableLanguages: Language[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh-cn', name: '中文', flag: '🇨🇳' }
  ];

  // Current language signal
  public currentLanguage = signal<Language>(this.availableLanguages[0]);
  
  // Language change subject
  private languageChange$ = new BehaviorSubject<string>('en');

  constructor(private translateService: TranslateService) {
    // Initialize translations synchronously
    this.initializeTranslationsSync();
    // Load translation files asynchronously
    this.loadTranslationFiles();
  }

  /**
   * Initialize translation service synchronously
   */
  private initializeTranslationsSync(): void {
    // Set default language
    this.translateService.setDefaultLang('en');
    
    // Add available languages
    this.translateService.addLangs(['en', 'zh-cn']);
    
    // Set up basic translations first
    this.translateService.setTranslation('en', {
      'navigation': { 'home': 'Home' },
      'pos': { 'total': 'Total', 'amount': 'Amount' }
    });
    this.translateService.setTranslation('zh-cn', {
      'navigation': { 'home': '首页' },
      'pos': { 'total': '总计', 'amount': '金额' }
    });
    
    // Load saved language or use default
    const savedLanguage = this.getSavedLanguage();
    this.setLanguage(savedLanguage);
  }

  /**
   * Load translation files manually
   */
  private async loadTranslationFiles(): Promise<void> {
    try {
      // Load English translations
      const enResponse = await fetch('./assets/i18n/en.json');
      if (enResponse.ok) {
        const enTranslations = await enResponse.json();
        this.translateService.setTranslation('en', enTranslations, true); // true = merge with existing
      }
      
      // Load Chinese translations  
      const zhResponse = await fetch('./assets/i18n/zh-cn.json');
      if (zhResponse.ok) {
        const zhTranslations = await zhResponse.json();
        this.translateService.setTranslation('zh-cn', zhTranslations, true); // true = merge with existing
      }
      
      // Refresh current language to apply new translations
      const currentLang = this.getCurrentLanguage();
      this.translateService.use(currentLang);
      
    } catch (error) {
      console.error('❌ Error loading translation files:', error);
      console.log('🔄 Using fallback translations');
    }
  }

  /**
   * Get saved language from localStorage
   */
  private getSavedLanguage(): string {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && this.availableLanguages.some(lang => lang.code === saved)) {
        return saved;
      }
    } catch (error) {
      console.warn('Could not access localStorage for language preference');
    }
    return 'en'; // Default to English
  }

  /**
   * Set current language
   */
  public setLanguage(languageCode: string): void {
    const language = this.availableLanguages.find(lang => lang.code === languageCode);
    if (language) {
      this.translateService.use(languageCode);
      this.currentLanguage.set(language);
      this.languageChange$.next(languageCode);
      this.saveLanguagePreference(languageCode);
    } else {
      console.error('❌ Language not found:', languageCode);
    }
  }

  /**
   * Save language preference to localStorage
   */
  private saveLanguagePreference(languageCode: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, languageCode);
    } catch (error) {
      console.warn('Could not save language preference to localStorage');
    }
  }

  /**
   * Get current language code
   */
  public getCurrentLanguage(): string {
    return this.currentLanguage().code;
  }

  /**
   * Get language change observable
   */
  public getLanguageChange(): Observable<string> {
    return this.languageChange$.asObservable();
  }

  /**
   * Translate a key
   */
  public translate(key: string, params?: any): Observable<string> {
    return this.translateService.get(key, params);
  }

  /**
   * Get instant translation (synchronous)
   */
  public instant(key: string, params?: any): string {
    return this.translateService.instant(key, params);
  }

  /**
   * Check if translations are loaded
   */
  public isTranslationsLoaded(): boolean {
    return this.translateService.currentLang !== undefined;
  }

  /**
   * Reload translations
   */
  public reloadTranslations(): void {
    this.translateService.reloadLang(this.getCurrentLanguage());
  }
}