import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

type ChartAccessTier = 'free' | 'premium';

interface ChartLibraryItem {
  id: string;
  title: string;
  category: 'Valuation Models' | 'Cycle Indicators' | 'Moving Averages';
  accessTier: ChartAccessTier;
  description: string;
  signal: string;
  thumbnailClass: string;
}

const CHARTS: ChartLibraryItem[] = [
  {
    id: 'stock-to-flow',
    title: 'Stock-to-Flow Model',
    category: 'Valuation Models',
    accessTier: 'free',
    signal: 'Scarcity valuation',
    description:
      'Tracks Bitcoin scarcity using circulating supply and issuance flow, with a simplified model price for long-term valuation context.',
    thumbnailClass: 'stock-to-flow',
  },
  {
    id: 'bitcoin-rainbow',
    title: 'Bitcoin Rainbow Price Chart',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Cycle valuation bands',
    description:
      'Shows price against logarithmic cycle bands to quickly spot cooler accumulation zones and overheated market periods.',
    thumbnailClass: 'bitcoin-rainbow',
  },
  {
    id: 'pi-cycle-top',
    title: 'Pi Cycle Top Indicator',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Cycle top crossover',
    description:
      'Compares the 111-day moving average with twice the 350-day moving average to identify potential cycle-top signals.',
    thumbnailClass: 'pi-cycle-top',
  },
  {
    id: 'mvrv-z-score',
    title: 'MVRV Z-Score',
    category: 'Valuation Models',
    accessTier: 'free',
    signal: 'Market value vs realized value',
    description:
      'Compares Bitcoin market cap to realized cap using a Z-Score to identify statistically extreme overvaluation and undervaluation periods.',
    thumbnailClass: 'mvrv-z-score',
  },
  {
    id: 'puell-multiple',
    title: 'Puell Multiple',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Miner revenue cycle',
    description:
      'Measures daily miner revenue relative to its 365-day moving average to spot periods of miner stress (buy) and high profitability (sell).',
    thumbnailClass: 'puell-multiple',
  },
  {
    id: 'bitcoin-power-law',
    title: 'Bitcoin Power Law Chart',
    category: 'Valuation Models',
    accessTier: 'free',
    signal: 'Long-term power law trend',
    description:
      'Models Bitcoin\'s price as a power function of time since genesis, with floor and ceiling bands that have historically contained price action across all market cycles.',
    thumbnailClass: 'bitcoin-power-law',
  },
  {
    id: 'bitcoin-cvdd',
    title: 'Bitcoin CVDD',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Cycle bottom signal',
    description:
      'Cumulative Value Coin Days Destroyed tracks the accumulated value-time of coin movements relative to market age. Historically it has accurately forecast Bitcoin\'s major price lows.',
    thumbnailClass: 'bitcoin-cvdd',
  },
  {
    id: 'halving-spiral',
    title: 'Bitcoin Halving Spiral',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Cycle position & momentum',
    description:
      'Plots Bitcoin price on a polar chart where each full revolution equals one halving cycle (~4 years). The logarithmic radial axis lets all four cycles be overlaid, revealing how each bull and bear phase compares to historical patterns.',
    thumbnailClass: 'halving-spiral',
  },
  {
    id: 'vdd-multiple',
    title: 'VDD Multiple',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Spending velocity vs. annual average',
    description:
      'Compares the 30-day moving average of Value Days Destroyed (CDD × price) to its 365-day average. ' +
      'Peaks above 2.9 mark cycle tops where long-term holders sell heavily; ' +
      'values below 0.75 signal bear-market accumulation phases.',
    thumbnailClass: 'vdd-multiple',
  },
  {
    id: 'halving-progress',
    title: 'Bitcoin Halving Progress',
    category: 'Cycle Indicators',
    accessTier: 'free',
    signal: 'Cycle-over-cycle comparison',
    description:
      'Shows Bitcoin\'s full price history across all halving cycles on a logarithmic scale. Cycle backgrounds, vertical halving markers, and a progress indicator reveal where the current cycle stands relative to the same stage in past cycles.',
    thumbnailClass: 'halving-progress',
  },
  {
    id: '2yr-ma-multiplier',
    title: '2-Year MA Multiplier',
    category: 'Moving Averages',
    accessTier: 'free',
    signal: 'Buy/sell zone via 2yr MA bands',
    description:
      'Bitcoin investor tool: buy below the 2-year moving average (green), sell above the 2yr MA × 5 (red). ' +
      'Intermediate multiplier bands (×2, ×3, ×4) show the degree of overheating. Computed daily from full price history.',
    thumbnailClass: '2yr-ma-multiplier',
  },
  {
    id: 'price-forecast-tools',
    title: 'Price Forecast Tools',
    category: 'Valuation Models',
    accessTier: 'free',
    signal: 'Cycle top & bottom targets',
    description:
      '6-model price forecast: Top Cap, Delta Top, CVDD, Terminal Price, Balanced Price. ' +
      'Combines on-chain models to identify historically reliable price targets for Bitcoin cycle tops and bear market floors.',
    thumbnailClass: 'price-forecast-tools',
  },
];

const CATEGORIES: ChartLibraryItem['category'][] = ['Valuation Models', 'Cycle Indicators', 'Moving Averages'];

@Component({
  selector: 'app-chart-library',
  standalone: true,
  templateUrl: './chart-library.component.html',
})
export class ChartLibraryComponent {
  private readonly router = inject(Router);
  private readonly query = signal('');
  protected readonly searchQuery = this.query.asReadonly();
  protected readonly premiumNotice = signal('');
  private readonly filteredCharts = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q
      ? CHARTS.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      : CHARTS;
  });
  protected readonly filteredCategories = computed(() =>
    CATEGORIES.map((category) => ({
      category,
      charts: this.filteredCharts().filter((c) => c.category === category),
    })).filter((group) => group.charts.length > 0),
  );

  protected updateSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async openChart(chart: ChartLibraryItem): Promise<void> {
    if (chart.accessTier === 'premium') {
      this.premiumNotice.set(
        $localize`:Premium chart unavailable message@@charts.premiumUnavailable:Premium chart access will be available from the donation flow.`,
      );
      return;
    }
    await this.router.navigate(['/charts', chart.id]);
  }

  protected tierLabel(accessTier: ChartAccessTier): string {
    return accessTier === 'premium' ? 'PREMIUM' : 'FREE';
  }
}
