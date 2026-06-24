import { loadTranslations, clearTranslations } from '@angular/localize';
import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef, LOCALE_ID } from '@angular/core';
import { App } from './app/app';
import { appConfig } from './app/app.config';

export type Locale = 'en' | 'hu';

let activeApp: ApplicationRef | null = null;

async function loadTranslationsForLocale(locale: Locale): Promise<void> {
  // Always clear stale translations before loading new ones
  clearTranslations();
  if (locale === 'en') return; // English is the source — no file needed
  try {
    const response = await fetch(`/assets/i18n/${locale}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const translations = (await response.json()) as Record<string, string>;
    loadTranslations(translations);
  } catch (err) {
    console.warn(`[i18n] Failed to load translations for "${locale}", falling back to English.`, err);
  }
}

async function startApp(locale: Locale): Promise<void> {
  await loadTranslationsForLocale(locale);

  // Replace <app-root> with a fresh element so Angular can re-bootstrap cleanly.
  // After appRef.destroy() the element still carries internal Ivy binding markers
  // that cause a silent failure on the second bootstrapApplication call.
  const oldRoot = document.querySelector('app-root');
  if (oldRoot) {
    const freshRoot = document.createElement('app-root');
    oldRoot.replaceWith(freshRoot);
  }

  activeApp = await bootstrapApplication(App, {
    providers: [
      { provide: LOCALE_ID, useValue: locale },
      ...appConfig.providers,
    ],
  });
  // No manual navigation needed — Angular Router reads window.location.pathname
  // and performs its own initial navigation to the correct route.
}

/** Called by LanguageService — destroys current app and re-bootstraps with new locale. */
export async function switchLocale(locale: Locale): Promise<void> {
  localStorage.setItem('locale', locale);
  activeApp?.destroy();
  activeApp = null;
  // One microtask delay lets Angular fully flush its destroy cycle before we replace the DOM
  await Promise.resolve();
  await startApp(locale);
}

// Bootstrap on page load using the saved or default locale
const savedLocale = (localStorage.getItem('locale') ?? 'en') as Locale;
startApp(savedLocale).catch(console.error);
