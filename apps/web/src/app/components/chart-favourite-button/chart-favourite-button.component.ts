import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';

@Component({
  selector: 'app-chart-favourite-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="secondary-button chart-favourite-btn"
      [class.is-favourite]="isFavourite()"
      [disabled]="isLoading()"
      (click)="toggle()"
      [title]="isFavourite() ? removeFromFavouritesLabel : addToFavouritesLabel"
      [attr.aria-pressed]="isFavourite()"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        [attr.fill]="isFavourite() ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      {{ isFavourite() ? savedLabel : saveLabel }}
    </button>
  `,
})
export class ChartFavouriteButtonComponent implements OnInit {
  @Input({ required: true }) chartId!: string;

  private readonly api = inject(AuthApiClient);
  protected readonly isFavourite = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly saveLabel = $localize`:Save button@@common.save:Save`;
  protected readonly savedLabel = $localize`:Saved state@@chart.saved:Saved`;
  protected readonly addToFavouritesLabel = $localize`:Add to favourites@@chart.addToFavourites:Add to favourites`;
  protected readonly removeFromFavouritesLabel = $localize`:Remove from favourites@@chart.removeFromFavourites:Remove from favourites`;

  async ngOnInit(): Promise<void> {
    try {
      const response = await this.api.getFavouriteCharts();
      this.isFavourite.set(response.favouriteCharts.some((f) => f.chartId === this.chartId));
    } catch {
      // stay false on error
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async toggle(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    try {
      const response = await this.api.toggleFavouriteChart(this.chartId);
      this.isFavourite.set(response.isFavourite);
    } catch {
      // ignore — button stays in current state
    } finally {
      this.isLoading.set(false);
    }
  }
}
