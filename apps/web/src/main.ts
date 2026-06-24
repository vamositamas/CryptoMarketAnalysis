import { loadTranslations } from '@angular/localize';
import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef, LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { App } from './app/app';
import { appConfig } from './app/app.config';

type Locale = 'en' | 'hu';

let activeApp: ApplicationRef | null = null;

async function loadTranslationsForLocale(locale: Locale): Promise<void> {
  if (locale === 'en') return; // English is the source language — no translation file needed
  try {
    const response = await fetch(`/assets/i18n/${locale}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const translations = (await response.json()) as Record<string, string>;
    loadTranslations(translations);
  } catch (err) {
    console.warn(`[i18n] Failed to load translations for "${locale}", falling back to English.`, err);
  }
}

async function startApp(locale: Locale, navigateTo?: string): Promise<void> {
  await loadTranslationsForLocale(locale);
  activeApp = await bootstrapApplication(App, {
    providers: [
      { provide: LOCALE_ID, useValue: locale },
      ...appConfig.providers,
    ],
  });
  if (navigateTo && navigateTo !== '/') {
    activeApp.injector.get(Router).navigateByUrl(navigateTo);
  }
}

/** Called by LanguageService — destroys current app and re-bootstraps with new locale. */
export async function switchLocale(locale: Locale): Promise<void> {
  const currentPath = activeApp?.injector.get(Router)?.url ?? '/';
  localStorage.setItem('locale', locale);
  activeApp?.destroy();
  activeApp = null;
  await startApp(locale, currentPath);
}

// Bootstrap on page load using the saved or default locale
const savedLocale = (localStorage.getItem('locale') ?? 'en') as Locale;
startApp(savedLocale).catch(console.error);
