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
  private readonly selectedChartId = signal(CHARTS[0].id);
  protected readonly searchQuery = this.query.asReadonly();
  protected readonly categories = CATEGORIES;
  protected readonly selectedChart = computed(
    () => this.filteredCharts().find((chart) => chart.id === this.selectedChartId()) ?? this.filteredCharts()[0],
  );
  protected readonly filteredCategories = computed(() =>
    this.categories
      .map((category) => ({
        category,
        charts: this.filteredCharts().filter((chart) => chart.category === category),
      }))
      .filter((group) => group.charts.length > 0),
  );
  protected readonly premiumNotice = signal('');
  private readonly filteredCharts = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();

    if (!normalizedQuery) {
      return CHARTS;
    }

    return CHARTS.filter(
      (chart) =>
        chart.title.toLowerCase().includes(normalizedQuery) ||
        chart.description.toLowerCase().includes(normalizedQuery),
    );
  });

  protected updateSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    const firstMatch = this.filteredCharts()[0];
    if (firstMatch) {
      this.selectedChartId.set(firstMatch.id);
    }
  }

  protected selectChart(chart: ChartLibraryItem): void {
    this.selectedChartId.set(chart.id);
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
