import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

type ChartAccessTier = 'free' | 'premium';

interface ChartLibraryItem {
  id: string;
  title: string;
  category: 'Valuation Models' | 'Cycle Indicators';
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
];

const CATEGORIES: ChartLibraryItem['category'][] = ['Valuation Models', 'Cycle Indicators'];

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
