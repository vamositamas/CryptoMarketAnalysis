import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

interface ChartLibraryItem {
  id: string;
  title: string;
  category: 'Valuation Models' | 'Cycle Indicators' | 'Moving Averages' | 'Macro Indicators';
  description: string;
  signal: string;
  thumbnailClass: string;
}

const CHARTS: ChartLibraryItem[] = [
  {
    id: 'stock-to-flow',
    title: 'Stock-to-Flow Model',
    category: 'Valuation Models',

    signal: 'Scarcity valuation',
    description:
      'Tracks Bitcoin scarcity using circulating supply and issuance flow, with a simplified model price for long-term valuation context.',
    thumbnailClass: 'stock-to-flow',
  },
  {
    id: 'bitcoin-rainbow',
    title: 'Bitcoin Rainbow Price Chart',
    category: 'Cycle Indicators',

    signal: 'Cycle valuation bands',
    description:
      'Shows price against logarithmic cycle bands to quickly spot cooler accumulation zones and overheated market periods.',
    thumbnailClass: 'bitcoin-rainbow',
  },
  {
    id: 'pi-cycle-top',
    title: 'Pi Cycle Top Indicator',
    category: 'Cycle Indicators',

    signal: 'Cycle top crossover',
    description:
      'Compares the 111-day moving average with twice the 350-day moving average to identify potential cycle-top signals.',
    thumbnailClass: 'pi-cycle-top',
  },
  {
    id: 'mvrv-z-score',
    title: 'MVRV Z-Score',
    category: 'Valuation Models',

    signal: 'Market value vs realized value',
    description:
      'Compares Bitcoin market cap to realized cap using a Z-Score to identify statistically extreme overvaluation and undervaluation periods.',
    thumbnailClass: 'mvrv-z-score',
  },
  {
    id: 'puell-multiple',
    title: 'Puell Multiple',
    category: 'Cycle Indicators',

    signal: 'Miner revenue cycle',
    description:
      'Measures daily miner revenue relative to its 365-day moving average to spot periods of miner stress (buy) and high profitability (sell).',
    thumbnailClass: 'puell-multiple',
  },
  {
    id: 'bitcoin-power-law',
    title: 'Bitcoin Power Law Chart',
    category: 'Valuation Models',

    signal: 'Long-term power law trend',
    description:
      'Models Bitcoin\'s price as a power function of time since genesis, with floor and ceiling bands that have historically contained price action across all market cycles.',
    thumbnailClass: 'bitcoin-power-law',
  },
  {
    id: 'bitcoin-cvdd',
    title: 'Bitcoin CVDD',
    category: 'Cycle Indicators',

    signal: 'Cycle bottom signal',
    description:
      'Cumulative Value Coin Days Destroyed tracks the accumulated value-time of coin movements relative to market age. Historically it has accurately forecast Bitcoin\'s major price lows.',
    thumbnailClass: 'bitcoin-cvdd',
  },
  {
    id: 'halving-spiral',
    title: 'Bitcoin Halving Spiral',
    category: 'Cycle Indicators',

    signal: 'Cycle position & momentum',
    description:
      'Plots Bitcoin price on a polar chart where each full revolution equals one halving cycle (~4 years). The logarithmic radial axis lets all four cycles be overlaid, revealing how each bull and bear phase compares to historical patterns.',
    thumbnailClass: 'halving-spiral',
  },
  {
    id: 'vdd-multiple',
    title: 'VDD Multiple',
    category: 'Cycle Indicators',

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

    signal: 'Cycle-over-cycle comparison',
    description:
      'Shows Bitcoin\'s full price history across all halving cycles on a logarithmic scale. Cycle backgrounds, vertical halving markers, and a progress indicator reveal where the current cycle stands relative to the same stage in past cycles.',
    thumbnailClass: 'halving-progress',
  },
  {
    id: '2yr-ma-multiplier',
    title: '2-Year MA Multiplier',
    category: 'Moving Averages',

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

    signal: 'Cycle top & bottom targets',
    description:
      '6-model price forecast: Top Cap, Delta Top, CVDD, Terminal Price, Balanced Price. ' +
      'Combines on-chain models to identify historically reliable price targets for Bitcoin cycle tops and bear market floors.',
    thumbnailClass: 'price-forecast-tools',
  },
  {
    id: 'mayer-multiple',
    title: 'Mayer Multiple',
    category: 'Moving Averages',

    signal: 'Overbought / oversold vs 200d MA',
    description:
      'Ratio of Bitcoin price to its 200-day moving average. Values above 2.4 historically signal overheating; values below 1.0 signal undervaluation and long-term accumulation opportunities.',
    thumbnailClass: 'mayer-multiple',
  },
  {
    id: '200-week-ma-heatmap',
    title: '200-Week MA Heatmap',
    category: 'Moving Averages',

    signal: 'Long-term cycle floor & ceiling',
    description:
      'Price coloured by the ratio to its 200-week moving average. The 200-week MA has historically acted as the ultimate bear-market floor; colours above it reveal the degree of bull-market extension.',
    thumbnailClass: '200-week-ma-heatmap',
  },
  {
    id: 'fear-greed-index',
    title: 'Fear & Greed Index',
    category: 'Cycle Indicators',

    signal: 'Market sentiment extremes',
    description:
      'Composite sentiment score (0–100) from volatility, volume, social media, and surveys. Extreme Fear has historically been a reliable long-term buy signal; Extreme Greed signals caution.',
    thumbnailClass: 'fear-greed-index',
  },
  {
    id: 'hash-ribbons',
    title: 'Hash Ribbons',
    category: 'Cycle Indicators',

    signal: 'Miner capitulation & recovery',
    description:
      'Compares the 30-day and 60-day moving averages of Bitcoin hash rate. When the 30d crosses back above the 60d after a period of miner capitulation, it has historically produced reliable long-term buy signals.',
    thumbnailClass: 'hash-ribbons',
  },
  {
    id: 'difficulty-ribbon',
    title: 'Difficulty Ribbon',
    category: 'Cycle Indicators',

    signal: 'Miner stress via difficulty compression',
    description:
      'Multiple moving averages (9–200 day) of mining difficulty layered as a ribbon. When short-term MAs fall below longer-term ones the ribbon compresses, signalling miner capitulation and historically cheap BTC.',
    thumbnailClass: 'difficulty-ribbon',
  },
  {
    id: 'nvt-ratio',
    title: 'NVT Ratio',
    category: 'Valuation Models',

    signal: "Bitcoin's P/E ratio",
    description:
      "Network Value to Transactions ratio: Bitcoin's market cap divided by daily on-chain transaction volume. High NVT signals the network is overvalued relative to usage; low NVT suggests undervaluation.",
    thumbnailClass: 'nvt-ratio',
  },
  {
    id: 'thermocap-multiple',
    title: 'Thermocap Multiple',
    category: 'Valuation Models',

    signal: 'Market cap vs cumulative miner spend',
    description:
      'Market cap divided by cumulative total miner revenue (Thermocap). Measures how expensive Bitcoin is relative to all security spend ever made. Historically high multiples coincide with cycle tops.',
    thumbnailClass: 'thermocap-multiple',
  },
  {
    id: 'excess-liquidity',
    title: 'Excess Liquidity Leading Indicator',
    category: 'Macro Indicators',
    signal: 'Macro liquidity vs. yield curve',
    description:
      'Overlays the 1-year change in the 3m/10y Treasury yield spread with an Excess Liquidity indicator (M2 growth minus GDP growth) shifted 6 months forward. ' +
      'When excess liquidity is positive and rising, it has historically led to easier financial conditions and risk-on environments.',
    thumbnailClass: 'excess-liquidity',
  },
  {
    id: 'spx-liquidity',
    title: 'S&P 500 vs Excess Liquidity',
    category: 'Macro Indicators',
    signal: 'Equities vs. macro liquidity',
    description:
      'Compares the S&P 500 year-over-year % change with the Excess Liquidity Leading Indicator (M2 growth minus GDP growth, shifted 6 months forward). ' +
      'When excess liquidity turns positive, it has historically preceded equity gains by approximately 6 months.',
    thumbnailClass: 'spx-liquidity',
  },
];

const CATEGORIES: ChartLibraryItem['category'][] = ['Valuation Models', 'Cycle Indicators', 'Moving Averages', 'Macro Indicators'];

@Component({
  selector: 'app-chart-library',
  standalone: true,
  templateUrl: './chart-library.component.html',
})
export class ChartLibraryComponent {
  private readonly router = inject(Router);
  private readonly query = signal('');
  protected readonly searchQuery = this.query.asReadonly();
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
    await this.router.navigate(['/charts', chart.id]);
  }
}
