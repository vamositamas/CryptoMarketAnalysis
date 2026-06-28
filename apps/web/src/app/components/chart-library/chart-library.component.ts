import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

interface ChartLibraryItem {
  id: string;
  title: string;
  category: 'valuation' | 'cycle' | 'movingAverage' | 'macro';
  description: string;
  signal: string;
  thumbnailClass: string;
}

const CHARTS: ChartLibraryItem[] = [
  {
    id: 'stock-to-flow',
    title: $localize`:Chart stock-to-flow title@@charts.library.stock-to-flow.title:Stock-to-Flow Model`,
    category: 'valuation',

    signal: $localize`:Chart stock-to-flow signal@@charts.library.stock-to-flow.signal:Scarcity valuation`,
    description:
      $localize`:Chart stock-to-flow description@@charts.library.stock-to-flow.description:Tracks Bitcoin scarcity using circulating supply and issuance flow, with a simplified model price for long-term valuation context.`,
    thumbnailClass: 'stock-to-flow',
  },
  {
    id: 'bitcoin-rainbow',
    title: $localize`:Chart bitcoin-rainbow title@@charts.library.bitcoin-rainbow.title:Bitcoin Rainbow Price Chart`,
    category: 'cycle',

    signal: $localize`:Chart bitcoin-rainbow signal@@charts.library.bitcoin-rainbow.signal:Cycle valuation bands`,
    description:
      $localize`:Chart bitcoin-rainbow description@@charts.library.bitcoin-rainbow.description:Compares price against logarithmic cycle bands so cooler accumulation zones and overheated market periods are easy to scan.`,
    thumbnailClass: 'bitcoin-rainbow',
  },
  {
    id: 'pi-cycle-top',
    title: $localize`:Chart pi-cycle-top title@@charts.library.pi-cycle-top.title:Pi Cycle Top Indicator`,
    category: 'cycle',

    signal: $localize`:Chart pi-cycle-top signal@@charts.library.pi-cycle-top.signal:Cycle top crossover`,
    description:
      $localize`:Chart pi-cycle-top description@@charts.library.pi-cycle-top.description:Compares the 111-day moving average with twice the 350-day moving average to identify potential cycle-top signals.`,
    thumbnailClass: 'pi-cycle-top',
  },
  {
    id: 'mvrv-z-score',
    title: $localize`:Chart mvrv-z-score title@@charts.library.mvrv-z-score.title:MVRV Z-Score`,
    category: 'valuation',

    signal: $localize`:Chart mvrv-z-score signal@@charts.library.mvrv-z-score.signal:Market value vs realized value`,
    description:
      $localize`:Chart mvrv-z-score description@@charts.library.mvrv-z-score.description:Compares Bitcoin market cap to realized cap using a Z-Score to identify statistically extreme overvaluation and undervaluation periods.`,
    thumbnailClass: 'mvrv-z-score',
  },
  {
    id: 'nupl',
    title: $localize`:Chart NUPL title@@charts.library.nupl.title:Bitcoin NUPL`,
    category: 'cycle',

    signal: $localize`:Chart NUPL signal@@charts.library.nupl.signal:Unrealized profit/loss cycle phases`,
    description:
      $localize`:Chart NUPL description@@charts.library.nupl.description:Maps aggregate unrealized Bitcoin profit and loss into sentiment bands from Capitulation through Euphoria / Greed.`,
    thumbnailClass: 'nupl',
  },
  {
    id: 'realized-price',
    title: $localize`:Chart realized-price title@@charts.library.realized-price.title:Realized Price`,
    category: 'valuation',

    signal: $localize`:Chart realized-price signal@@charts.library.realized-price.signal:Aggregate on-chain cost basis`,
    description:
      $localize`:Chart realized-price description@@charts.library.realized-price.description:Shows BTC market price against the average price where coins last moved on-chain. Price below realized price has historically marked broad holder losses and cycle stress.`,
    thumbnailClass: 'realized-price',
  },
  {
    id: 'sopr-ratio',
    title: $localize`:Chart sopr-ratio title@@charts.library.sopr-ratio.title:SOPR Ratio (LTH/STH)`,
    category: 'cycle',

    signal: $localize`:Chart sopr-ratio signal@@charts.library.sopr-ratio.signal:Holder profit-taking comparison`,
    description:
      $localize`:Chart sopr-ratio description@@charts.library.sopr-ratio.description:Divides long-term holder SOPR by short-term holder SOPR to compare profit-taking behavior between experienced holders and newer market participants.`,
    thumbnailClass: 'sopr-ratio',
  },
  {
    id: 'puell-multiple',
    title: $localize`:Chart puell-multiple title@@charts.library.puell-multiple.title:Puell Multiple`,
    category: 'cycle',

    signal: $localize`:Chart puell-multiple signal@@charts.library.puell-multiple.signal:Miner revenue cycle`,
    description:
      $localize`:Chart puell-multiple description@@charts.library.puell-multiple.description:Measures daily miner revenue against its 365-day moving average to identify miner stress buy zones and high-profit sell zones.`,
    thumbnailClass: 'puell-multiple',
  },
  {
    id: 'bitcoin-power-law',
    title: $localize`:Chart bitcoin-power-law title@@charts.library.bitcoin-power-law.title:Bitcoin Power Law Chart`,
    category: 'valuation',

    signal: $localize`:Chart bitcoin-power-law signal@@charts.library.bitcoin-power-law.signal:Long-term power law trend`,
    description:
      $localize`:Chart bitcoin-power-law description@@charts.library.bitcoin-power-law.description:Models Bitcoin price as a power function of time since genesis, with floor and ceiling bands that have historically contained price action across market cycles.`,
    thumbnailClass: 'bitcoin-power-law',
  },
  {
    id: 'bitcoin-cvdd',
    title: $localize`:Chart bitcoin-cvdd title@@charts.library.bitcoin-cvdd.title:Bitcoin CVDD`,
    category: 'cycle',

    signal: $localize`:Chart bitcoin-cvdd signal@@charts.library.bitcoin-cvdd.signal:Cycle bottom signal`,
    description:
      $localize`:Chart bitcoin-cvdd description@@charts.library.bitcoin-cvdd.description:Cumulative Value Coin Days Destroyed tracks the accumulated value-time of coin movements relative to market age. It has historically marked major Bitcoin price bottoms.`,
    thumbnailClass: 'bitcoin-cvdd',
  },
  {
    id: 'halving-spiral',
    title: $localize`:Chart halving-spiral title@@charts.library.halving-spiral.title:Bitcoin Halving Spiral`,
    category: 'cycle',

    signal: $localize`:Chart halving-spiral signal@@charts.library.halving-spiral.signal:Cycle position and momentum`,
    description:
      $localize`:Chart halving-spiral description@@charts.library.halving-spiral.description:Plots Bitcoin price on a polar chart where one full rotation equals one halving cycle. The logarithmic radius overlays cycles so bull and bear phases can be compared.`,
    thumbnailClass: 'halving-spiral',
  },
  {
    id: 'vdd-multiple',
    title: $localize`:Chart vdd-multiple title@@charts.library.vdd-multiple.title:VDD Multiple`,
    category: 'cycle',

    signal: $localize`:Chart vdd-multiple signal@@charts.library.vdd-multiple.signal:Spending velocity vs yearly average`,
    description:
      $localize`:Chart vdd-multiple description@@charts.library.vdd-multiple.description:Compares the 30-day moving average of Value Days Destroyed (CDD × price) with its 365-day average. Peaks above 2.9 can signal cycle tops as long-term holders sell heavily; values below 0.75 suggest bear-market accumulation phases.`,
    thumbnailClass: 'vdd-multiple',
  },
  {
    id: 'halving-progress',
    title: $localize`:Chart halving-progress title@@charts.library.halving-progress.title:Bitcoin Halving Progress`,
    category: 'cycle',

    signal: $localize`:Chart halving-progress signal@@charts.library.halving-progress.signal:Cycle comparison`,
    description:
      $localize`:Chart halving-progress description@@charts.library.halving-progress.description:Shows Bitcoin price history across all halving cycles on a logarithmic scale. Cycle backgrounds, halving markers, and progress indicators show where the current cycle sits versus prior cycles.`,
    thumbnailClass: 'halving-progress',
  },
  {
    id: 'compare-bull-markets',
    title: $localize`:Chart compare-bull-markets title@@charts.library.compare-bull-markets.title:Compare Bull Markets`,
    category: 'cycle',
    signal: $localize`:Chart compare-bull-markets signal@@charts.library.compare-bull-markets.signal:Breakout-era comparison`,
    description:
      $localize`:Chart compare-bull-markets description@@charts.library.compare-bull-markets.description:Aligns Bitcoin bull-market breakouts by days since price cleared the prior all-time high, scaling earlier eras to the current reward era for like-for-like cycle comparison.`,
    thumbnailClass: 'compare-bull-markets',
  },
  {
    id: '2yr-ma-multiplier',
    title: $localize`:Chart 2yr-ma-multiplier title@@charts.library.2yr-ma-multiplier.title:2-Year MA Multiplier`,
    category: 'movingAverage',

    signal: $localize`:Chart 2yr-ma-multiplier signal@@charts.library.2yr-ma-multiplier.signal:Buy/sell zones with 2-year MA bands`,
    description:
      $localize`:Chart 2yr-ma-multiplier description@@charts.library.2yr-ma-multiplier.description:A Bitcoin investor tool: buy below the 2-year moving average and sell above the 2-year MA ×5. Intermediate multiplier bands show the degree of market overheating.`,
    thumbnailClass: '2yr-ma-multiplier',
  },
  {
    id: 'price-forecast-tools',
    title: $localize`:Chart price-forecast-tools title@@charts.library.price-forecast-tools.title:Price Forecast Tools`,
    category: 'valuation',

    signal: $localize`:Chart price-forecast-tools signal@@charts.library.price-forecast-tools.signal:Cycle top and bottom targets`,
    description:
      $localize`:Chart price-forecast-tools description@@charts.library.price-forecast-tools.description:A price forecast chart using BTC price, Top Cap, Delta Top, and CVDD to identify historically reliable Bitcoin cycle-top and bear-market-floor targets.`,
    thumbnailClass: 'price-forecast-tools',
  },
  {
    id: 'mayer-multiple',
    title: $localize`:Chart mayer-multiple title@@charts.library.mayer-multiple.title:Mayer Multiple`,
    category: 'movingAverage',

    signal: $localize`:Chart mayer-multiple signal@@charts.library.mayer-multiple.signal:Overbought / oversold vs 200-day MA`,
    description:
      $localize`:Chart mayer-multiple description@@charts.library.mayer-multiple.description:Bitcoin price divided by its 200-day moving average. Values above 2.4 have historically signaled overheated markets, while values below 1.0 have signaled undervaluation and long-term accumulation.`,
    thumbnailClass: 'mayer-multiple',
  },
  {
    id: '200-week-ma-heatmap',
    title: $localize`:Chart 200-week-ma-heatmap title@@charts.library.200-week-ma-heatmap.title:200-Week MA Heatmap`,
    category: 'movingAverage',

    signal: $localize`:Chart 200-week-ma-heatmap signal@@charts.library.200-week-ma-heatmap.signal:Long-term cycle floor and upper range`,
    description:
      $localize`:Chart 200-week-ma-heatmap description@@charts.library.200-week-ma-heatmap.description:Colors price by its ratio to the 200-week moving average. The 200-week MA has historically acted as a final bear-market support, while colors above it show bull-market extension.`,
    thumbnailClass: '200-week-ma-heatmap',
  },
  {
    id: 'fear-greed-index',
    title: $localize`:Chart fear-greed-index title@@charts.library.fear-greed-index.title:Fear & Greed Index`,
    category: 'cycle',

    signal: $localize`:Chart fear-greed-index signal@@charts.library.fear-greed-index.signal:Market sentiment extremes`,
    description:
      $localize`:Chart fear-greed-index description@@charts.library.fear-greed-index.description:Composite sentiment score from volatility, volume, social media, and surveys. Extreme fear has historically been a reliable long-term buy signal; extreme greed suggests caution.`,
    thumbnailClass: 'fear-greed-index',
  },
  {
    id: 'hash-ribbons',
    title: $localize`:Chart hash-ribbons title@@charts.library.hash-ribbons.title:Hash Ribbons`,
    category: 'cycle',

    signal: $localize`:Chart hash-ribbons signal@@charts.library.hash-ribbons.signal:Miner capitulation and recovery`,
    description:
      $localize`:Chart hash-ribbons description@@charts.library.hash-ribbons.description:Compares the 30-day and 60-day moving averages of Bitcoin hash rate. A recovery crossover after miner capitulation has historically produced strong long-term buy signals.`,
    thumbnailClass: 'hash-ribbons',
  },
  {
    id: 'difficulty-ribbon',
    title: $localize`:Chart difficulty-ribbon title@@charts.library.difficulty-ribbon.title:Difficulty Ribbon`,
    category: 'cycle',

    signal: $localize`:Chart difficulty-ribbon signal@@charts.library.difficulty-ribbon.signal:Miner stress through difficulty compression`,
    description:
      $localize`:Chart difficulty-ribbon description@@charts.library.difficulty-ribbon.description:Layers multiple moving averages of mining difficulty. When short-term averages fall below longer-term averages, the ribbon compresses, signaling miner capitulation and historically cheap BTC.`,
    thumbnailClass: 'difficulty-ribbon',
  },
  {
    id: 'nvt-ratio',
    title: $localize`:Chart nvt-ratio title@@charts.library.nvt-ratio.title:NVT Ratio`,
    category: 'valuation',

    signal: $localize`:Chart nvt-ratio signal@@charts.library.nvt-ratio.signal:Bitcoin's P/E ratio`,
    description:
      $localize`:Chart nvt-ratio description@@charts.library.nvt-ratio.description:Network Value to Transactions ratio: Bitcoin market cap divided by daily on-chain transaction volume. High NVT can signal overvaluation relative to usage; low NVT can suggest undervaluation.`,
    thumbnailClass: 'nvt-ratio',
  },
  {
    id: 'thermocap-multiple',
    title: $localize`:Chart thermocap-multiple title@@charts.library.thermocap-multiple.title:Thermocap Multiple`,
    category: 'valuation',

    signal: $localize`:Chart thermocap-multiple signal@@charts.library.thermocap-multiple.signal:Market cap vs cumulative miner spend`,
    description:
      $localize`:Chart thermocap-multiple description@@charts.library.thermocap-multiple.description:Market cap divided by cumulative total miner revenue. It measures how expensive Bitcoin is relative to all security spend ever made; historically high multiples often coincided with cycle tops.`,
    thumbnailClass: 'thermocap-multiple',
  },
  {
    id: 'excess-liquidity',
    title: $localize`:Chart excess-liquidity title@@charts.library.excess-liquidity.title:Excess Liquidity Lead Indicator`,
    category: 'macro',
    signal: $localize`:Chart excess-liquidity signal@@charts.library.excess-liquidity.signal:Macro liquidity vs yield curve`,
    description:
      $localize`:Chart excess-liquidity description@@charts.library.excess-liquidity.description:Compares the 1-year change in the US 3-month/10-year yield spread with a 6-month-forward excess liquidity indicator. Positive and rising liquidity has historically preceded easier financial conditions and stronger risk appetite.`,
    thumbnailClass: 'excess-liquidity',
  },
  {
    id: 'spx-liquidity',
    title: $localize`:Chart spx-liquidity title@@charts.library.spx-liquidity.title:S&P 500 vs Excess Liquidity`,
    category: 'macro',
    signal: $localize`:Chart spx-liquidity signal@@charts.library.spx-liquidity.signal:Equities vs macro liquidity`,
    description:
      $localize`:Chart spx-liquidity description@@charts.library.spx-liquidity.description:Compares the S&P 500 year-over-year change with the excess liquidity lead indicator. Positive turns in excess liquidity have historically led equity market advances by roughly 6 months.`,
    thumbnailClass: 'spx-liquidity',
  },
  {
    id: 'global-m2-bitcoin',
    title: $localize`:Chart global-m2-bitcoin title@@charts.library.global-m2-bitcoin.title:Global M2 vs BTC YoY`,
    category: 'macro',
    signal: $localize`:Chart global-m2-bitcoin signal@@charts.library.global-m2-bitcoin.signal:Liquidity cycle correlation`,
    description:
      $localize`:Chart global-m2-bitcoin description@@charts.library.global-m2-bitcoin.description:Compares global broad-money year-over-year growth with Bitcoin year-over-year returns to highlight how liquidity expansions and contractions align with major BTC cycles.`,
    thumbnailClass: 'global-m2-bitcoin',
  },
  {
    id: 'dxy-bitcoin',
    title: $localize`:Chart dxy-bitcoin title@@charts.library.dxy-bitcoin.title:DXY vs Bitcoin`,
    category: 'macro',
    signal: $localize`:Chart dxy-bitcoin signal@@charts.library.dxy-bitcoin.signal:Dollar strength inverse signal`,
    description:
      $localize`:Chart dxy-bitcoin description@@charts.library.dxy-bitcoin.description:Compares the year-over-year change in the US dollar index with Bitcoin price to highlight the historically inverse relationship between dollar strength and BTC cycle conditions.`,
    thumbnailClass: 'global-m2-bitcoin',
  },
  {
    id: 'midterm-cycles',
    title: $localize`:Chart midterm-cycles title@@charts.library.midterm-cycles.title:Midterm Cycles`,
    category: 'macro',
    signal: $localize`:Chart midterm-cycles signal@@charts.library.midterm-cycles.signal:BTC & SPX RSI vs election cycles`,
    description:
      $localize`:Chart midterm-cycles description@@charts.library.midterm-cycles.description:Overlays Bitcoin and S&P 500 12-month RSI against the Chicago Fed National Activity Index (CFNAI), aligned to US midterm election cycles. Historically, equity and economic conditions around midterms have preceded significant Bitcoin moves.`,
    thumbnailClass: 'midterm-cycles',
  },
];

const CATEGORY_LABELS: Record<ChartLibraryItem['category'], string> = {
  valuation: $localize`:Chart category valuation@@charts.category.valuation:Valuation Models`,
  cycle: $localize`:Chart category cycle@@charts.category.cycle:Cycle Indicators`,
  movingAverage: $localize`:Chart category moving average@@charts.category.movingAverage:Moving Averages`,
  macro: $localize`:Chart category macro@@charts.category.macro:Macro Indicators`,
};

const CATEGORIES: ChartLibraryItem['category'][] = ['valuation', 'cycle', 'movingAverage', 'macro'];

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
      category: CATEGORY_LABELS[category],
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
