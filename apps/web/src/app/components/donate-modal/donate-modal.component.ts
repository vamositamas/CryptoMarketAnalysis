import { Component, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiClientError, AuthApiClient } from '@crypto-market-analysis/data-access/api-client';

const PRESET_AMOUNTS = [5, 10, 25] as const;

@Component({
  selector: 'app-donate-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="donate-modal-title">
      <div class="modal-panel donate-modal-panel">
        <button class="modal-close" type="button" aria-label="Close" (click)="closed.emit()">✕</button>

        <h2 id="donate-modal-title">Support CryptoMarketAnalysis</h2>
        <p class="donate-sub">Help keep professional Bitcoin analysis free for everyone.</p>

        <ul class="donate-benefits">
          <li>Unlimited price alerts (free tier is capped at 5)</li>
          <li>Access to future premium charts</li>
          <li>Priority support</li>
          <li>Recognition as a platform supporter</li>
        </ul>

        <div class="donate-amounts">
          @for (preset of presets; track preset) {
            <button
              type="button"
              class="donate-amount-btn"
              [class.selected]="selectedPreset() === preset"
              (click)="selectPreset(preset)"
            >
              \${{ preset }}
            </button>
          }
          <button
            type="button"
            class="donate-amount-btn"
            [class.selected]="selectedPreset() === null"
            (click)="selectCustom()"
          >
            Custom
          </button>
        </div>

        @if (selectedPreset() === null) {
          <form [formGroup]="customForm" class="donate-custom-row">
            <label class="donate-custom-label">
              Amount ($)
              <input
                type="number"
                formControlName="customAmount"
                min="1"
                max="9999"
                step="1"
                placeholder="Enter amount"
                class="donate-custom-input"
              />
            </label>
          </form>
        }

        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }

        <div class="donate-actions">
          <button
            type="button"
            class="primary-button"
            [disabled]="isProcessing() || !isAmountValid()"
            (click)="donate()"
          >
            {{ isProcessing() ? 'Processing...' : 'Donate via PayPal' }}
          </button>
          <button type="button" class="ghost-link" (click)="closed.emit()">
            Continue as Free User
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DonateModalComponent {
  @Output() closed = new EventEmitter<void>();

  private readonly api = inject(AuthApiClient);
  private readonly fb = inject(FormBuilder);

  protected readonly presets = PRESET_AMOUNTS;
  protected readonly selectedPreset = signal<number | null>(10);
  protected readonly isProcessing = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);

  protected readonly customForm = this.fb.nonNullable.group({
    customAmount: [10, [Validators.required, Validators.min(1), Validators.max(9999)]],
  });

  protected readonly isAmountValid = computed(() => {
    if (this.selectedPreset() !== null) return true;
    return this.customForm.valid;
  });

  protected readonly effectiveAmount = computed(() => {
    if (this.selectedPreset() !== null) return this.selectedPreset()!;
    return this.customForm.getRawValue().customAmount;
  });

  protected selectPreset(amount: number): void {
    this.selectedPreset.set(amount);
    this.message.set('');
  }

  protected selectCustom(): void {
    this.selectedPreset.set(null);
    this.message.set('');
  }

  protected async donate(): Promise<void> {
    if (this.isProcessing() || !this.isAmountValid()) return;

    this.isProcessing.set(true);
    this.message.set('');

    try {
      const result = await this.api.initiateDonation({ amount: this.effectiveAmount() });
      window.location.assign(result.approvalUrl);
    } catch (error) {
      this.isProcessing.set(false);
      this.message.set(
        error instanceof ApiClientError ? error.message : 'Could not start donation. Please try again.',
      );
    }
  }
}
