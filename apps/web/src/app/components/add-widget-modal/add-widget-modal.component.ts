import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import {
  ApiClientError,
  AuthApiClient,
  type DashboardWidget,
} from '@crypto-market-analysis/data-access/api-client';

type WidgetLibraryCategory = 'Price Metrics' | 'On-chain Metrics' | 'Supply Metrics' | 'Cycle Indicators';
type ModalView = 'library' | 'custom';

interface WidgetLibraryItem {
  type: string;
  icon: string;
  name: string;
  description: string;
  category: WidgetLibraryCategory;
  decimals: number;
}

const WIDGET_LIBRARY: WidgetLibraryItem[] = [
  {
    type: 'realized_price',
    icon: 'RP',
    name: 'Realizált ár',
    description: 'Average cost basis of all bitcoins, based on the price each coin last moved on-chain.',
    category: 'Price Metrics',
    decimals: 2,
  },
  {
    type: 'ma_200_day',
    icon: '200',
    name: '200-day Moving Average',
    description: 'Long-term trend-following average of the Bitcoin price over the last 200 days.',
    category: 'Price Metrics',
    decimals: 2,
  },
  {
    type: 'hash_rate',
    icon: 'HR',
    name: 'Hash rate',
    description: 'Estimated computing power currently securing the Bitcoin network.',
    category: 'On-chain Metrics',
    decimals: 0,
  },
  {
    type: 'mining_difficulty',
    icon: 'DIFF',
    name: 'Mining Difficulty',
    description: 'Relative measure of how difficult it currently is to mine a new Bitcoin block.',
    category: 'On-chain Metrics',
    decimals: 0,
  },
  {
    type: 'total_supply',
    icon: 'MAX',
    name: 'Total Supply',
    description: 'The fixed 21,000,000 BTC maximum supply Bitcoin can ever reach.',
    category: 'Supply Metrics',
    decimals: 0,
  },
  {
    type: 'circulating_supply',
    icon: 'CIRC',
    name: 'Circulating Supply',
    description: 'The number of bitcoins already mined and in circulation today.',
    category: 'Supply Metrics',
    decimals: 0,
  },
  {
    type: 'market_cap',
    icon: 'CAP',
    name: 'Piaci kapitalizáció',
    description: 'Current Bitcoin price multiplied by the circulating supply.',
    category: 'Supply Metrics',
    decimals: 0,
  },
  {
    type: 'halving_progress',
    icon: 'HAL',
    name: 'Halving Progress',
    description: 'Tracks the current Bitcoin halving cycle progress from the April 2024 halving to the estimated April 2028 halving, with a days-remaining countdown.',
    category: 'Cycle Indicators',
    decimals: 1,
  },
];

const CATEGORIES: WidgetLibraryCategory[] = ['Price Metrics', 'On-chain Metrics', 'Supply Metrics', 'Cycle Indicators'];

export const FORMULA_VARIABLES = [
  { name: '{{btc_price}}', description: 'Bitcoin price (USD)' },
  { name: '{{btc_price_24h_change}}', description: '24h price change (%)' },
  { name: '{{market_cap}}', description: 'Market capitalisation (USD)' },
  { name: '{{circulating_supply}}', description: 'Circulating supply (BTC)' },
  { name: '{{stock_to_flow}}', description: 'Stock-to-Flow ratio' },
  { name: '{{mvrv_zscore}}', description: 'MVRV Z-Score' },
  { name: '{{fear_greed_index}}', description: 'Fear & Greed Index (0–100)' },
];

@Component({
  selector: 'app-add-widget-modal',
  templateUrl: './add-widget-modal.component.html',
})
export class AddWidgetModalComponent {
  private readonly auth = inject(AuthApiClient);
  @Input({ required: true }) existingWidgetTypes: string[] = [];
  @Output() readonly widgetAdded = new EventEmitter<DashboardWidget>();
  @Output() readonly closed = new EventEmitter<void>();

  protected readonly view = signal<ModalView>('library');
  protected readonly query = signal('');
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly customName = signal('');
  protected readonly customFormula = signal('');
  protected readonly customDescription = signal('');

  protected readonly formulaVariables = FORMULA_VARIABLES;

  protected readonly filteredGroups = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const items = normalizedQuery
      ? WIDGET_LIBRARY.filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedQuery) ||
            item.description.toLowerCase().includes(normalizedQuery),
        )
      : WIDGET_LIBRARY;

    return CATEGORIES.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  });

  protected switchView(view: ModalView): void {
    this.view.set(view);
    this.errorMessage.set('');
  }

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected isAdded(widgetType: string): boolean {
    return this.existingWidgetTypes.includes(widgetType);
  }

  protected async addWidget(item: WidgetLibraryItem): Promise<void> {
    if (this.isAdded(item.type) || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    try {
      const widget = await this.auth.createDashboardWidget({
        widgetType: item.type,
        widgetConfig: { title: item.name, decimals: item.decimals },
      });
      this.widgetAdded.emit(widget);
      this.closed.emit();
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Add widget failure@@dashboard.addWidgetFailed:The widget could not be added. Please try again.`,
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  protected setCustomName(value: string): void {
    this.customName.set(value);
  }

  protected setCustomFormula(value: string): void {
    this.customFormula.set(value);
  }

  protected setCustomDescription(value: string): void {
    this.customDescription.set(value);
  }

  protected isCustomFormValid(): boolean {
    return this.customName().trim().length > 0 && this.customFormula().trim().length > 0;
  }

  protected async saveCustomWidget(): Promise<void> {
    if (!this.isCustomFormValid() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    const name = this.customName().trim();
    const formula = this.customFormula().trim();
    const description = this.customDescription().trim();

    try {
      const widget = await this.auth.createDashboardWidget({
        widgetType: 'custom',
        widgetConfig: {
          title: name,
          formula,
          ...(description ? { description } : {}),
        },
      });
      this.widgetAdded.emit(widget);
      this.closed.emit();
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Custom widget failure@@dashboard.customWidgetFailed:The widget could not be saved. Please try again.`,
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  protected close(): void {
    this.closed.emit();
  }
}
