import { loadTranslations, clearTranslations } from '@angular/localize';
import { bootstrapApplication } from '@angular/platform-browser';
import { LOCALE_ID } from '@angular/core';
import { App } from './app/app';
import { appConfig } from './app/app.config';

export type Locale = 'en' | 'hu';

async function loadTranslationsForLocale(locale: Locale): Promise<void> {
  clearTranslations();
  if (locale === 'en') return;
  try {
    const response = await fetch(`/assets/i18n/${locale}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const translations = (await response.json()) as Record<string, string>;
    loadTranslations(translations);
  } catch (err) {
    console.warn(`[i18n] Failed to load translations for "${locale}", falling back to English.`, err);
  }
}

/**
 * Save the chosen locale and reload the page.
 * The page stays at the same URL — auth state and current route are preserved.
 * On reload, startApp() reads the saved locale and bootstraps with translations.
 */
export function switchLocale(locale: Locale): void {
  localStorage.setItem('locale', locale);
  window.location.reload();
}

async function startApp(locale: Locale): Promise<void> {
  await loadTranslationsForLocale(locale);
  await bootstrapApplication(App, {
    providers: [
      { provide: LOCALE_ID, useValue: locale },
      ...appConfig.providers,
    ],
  });
}

const savedLocale = (localStorage.getItem('locale') ?? 'en') as Locale;
startApp(savedLocale).catch(console.error);
