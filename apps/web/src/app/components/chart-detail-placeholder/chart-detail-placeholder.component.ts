import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

const CHART_TITLES: Record<string, string> = {
  'bitcoin-rainbow': 'Bitcoin Rainbow Price Chart',
  'pi-cycle-top': 'Pi Cycle Top Indicator',
  'stock-to-flow': 'Stock-to-Flow Model',
};

@Component({
  selector: 'app-chart-detail-placeholder',
  imports: [RouterLink],
  template: `
    <section class="content-section chart-detail-placeholder">
      <p class="eyebrow" i18n="Chart detail eyebrow@@chartDetail.eyebrow">Chart</p>
      <h2>{{ chartTitle() }}</h2>
      <p i18n="Chart detail placeholder text@@chartDetail.placeholder">
        Interactive chart rendering starts in the next chart visualization story.
      </p>
      <a class="ghost-link" routerLink="/charts" i18n="Back to charts link@@chartDetail.back">
        Back to charts
      </a>
    </section>
  `,
})
export class ChartDetailPlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly chartTitle = computed(() => {
    const chartId = this.route.snapshot.paramMap.get('chartId') ?? '';

    return CHART_TITLES[chartId] ?? 'Bitcoin chart';
  });
}
