import { Injectable, LOCALE_ID, inject, signal } from '@angular/core';
import type { Locale } from '../../main';

export type { Locale };

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly localeId = inject(LOCALE_ID);

  readonly current = signal<Locale>(this.normalize(this.localeId));

  switchTo(locale: Locale): void {
    if (locale === this.current()) return;
    // Dynamic import avoids circular dependency with main.ts.
    // switchLocale saves locale to localStorage then reloads the page,
    // so the app re-bootstraps at the same URL with the new translations.
    void import('../../main').then(({ switchLocale }) => switchLocale(locale));
  }

  private normalize(locale: string): Locale {
    return locale.toLowerCase().startsWith('hu') ? 'hu' : 'en';
  }
}
