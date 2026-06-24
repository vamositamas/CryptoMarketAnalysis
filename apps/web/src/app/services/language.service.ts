import { Injectable, LOCALE_ID, inject, signal } from '@angular/core';

export type Locale = 'en' | 'hu';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly localeId = inject(LOCALE_ID);

  readonly current = signal<Locale>(this.normalize(this.localeId));
  readonly isSwitching = signal(false);

  async switchTo(locale: Locale): Promise<void> {
    if (locale === this.current() || this.isSwitching()) return;
    this.isSwitching.set(true);
    // Dynamic import avoids circular dependency with main.ts
    const { switchLocale } = await import('../../main');
    await switchLocale(locale);
    // isSwitching stays true — the app re-bootstraps so this instance is destroyed
  }

  private normalize(locale: string): Locale {
    return locale.toLowerCase().startsWith('hu') ? 'hu' : 'en';
  }
}
