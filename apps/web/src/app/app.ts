import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

type Language = 'en' | 'hu';

const copy = {
  en: {
    appName: 'CryptoMarketAnalysis',
    dashboard: 'Dashboard',
    charts: 'Charts',
    onboarding: 'Onboarding',
    login: 'Login',
    register: 'Register',
    heroTitle: 'Bitcoin market intelligence for cycle-aware decisions',
    heroText:
      'Track on-chain valuation, cycle signals, and model context in one focused workspace.',
    cta: 'Review dashboard',
    secondaryCta: 'Create account',
    marketState: 'Market state',
    risk: 'Cycle risk',
    activeModels: 'Active models',
    signalQuality: 'Signal quality',
    valuation: 'Valuation',
    momentum: 'Momentum',
    cycle: 'Cycle',
    model: 'Model',
    mvrv: 'MVRV Z-Score',
    rainbow: 'Bitcoin Rainbow',
    piCycle: 'Pi Cycle Top',
    stockFlow: 'Stock-to-Flow',
    realizedPrice: 'Realized Price',
    nextActions: 'Next actions',
    actionOne: 'Connect verified data feeds',
    actionTwo: 'Complete onboarding preferences',
    actionThree: 'Enable alert rules for high-risk chart zones',
  },
  hu: {
    appName: 'CryptoMarketAnalysis',
    dashboard: 'Irányítópult',
    charts: 'Grafikonok',
    onboarding: 'Onboarding',
    login: 'Belépés',
    register: 'Regisztráció',
    heroTitle: 'Bitcoin piaci elemzés ciklustudatos döntésekhez',
    heroText:
      'On-chain értékelés, ciklusjelek és modellkörnyezet egy fókuszált munkafelületen.',
    cta: 'Irányítópult',
    secondaryCta: 'Fiók létrehozása',
    marketState: 'Piaci állapot',
    risk: 'Cikluskockázat',
    activeModels: 'Aktív modellek',
    signalQuality: 'Jelminőség',
    valuation: 'Értékelés',
    momentum: 'Momentum',
    cycle: 'Ciklus',
    model: 'Modell',
    mvrv: 'MVRV Z-Score',
    rainbow: 'Bitcoin Rainbow',
    piCycle: 'Pi Cycle Top',
    stockFlow: 'Stock-to-Flow',
    realizedPrice: 'Realized Price',
    nextActions: 'Következő lépések',
    actionOne: 'Ellenőrzött adatforrások bekötése',
    actionTwo: 'Onboarding beállítások kitöltése',
    actionThree: 'Riasztási szabályok bekapcsolása kockázatos zónákra',
  },
} satisfies Record<Language, Record<string, string>>;

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly language = signal<Language>('en');
  protected readonly chartModels = [
    { key: 'mvrv', status: 'Valuation stretch', value: '1.84' },
    { key: 'rainbow', status: 'Accumulation band', value: 'Green' },
    { key: 'piCycle', status: 'No top cross', value: 'Clear' },
    { key: 'stockFlow', status: 'Model variance', value: '+12%' },
    { key: 'realizedPrice', status: 'Above cost basis', value: '2.6x' },
  ] as const;

  protected t(key: keyof (typeof copy)['en']): string {
    return copy[this.language()][key];
  }

  protected setLanguage(language: Language): void {
    this.language.set(language);
  }
}
