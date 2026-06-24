import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import {
  ApiClientError,
  AuthApiClient,
  type DonationDetailsResponse,
} from '@crypto-market-analysis/data-access/api-client';

@Component({
  selector: 'app-donate-thank-you',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="content-section auth-section">
      <div class="thank-you-card">
        <div class="thank-you-icon" aria-hidden="true">🎉</div>
        <h2>Thank You for Your Support!</h2>

        @if (isLoading()) {
          <p>Loading donation details...</p>
        } @else if (donation()) {
          <p class="thank-you-sub">
            Your donation of
            <strong>\${{ donation()!.amount.toFixed(2) }} {{ donation()!.currency }}</strong>
            has been received.
          </p>

          <table class="thank-you-table">
            <tr>
              <td>Amount</td>
              <td><strong>\${{ donation()!.amount.toFixed(2) }} {{ donation()!.currency }}</strong></td>
            </tr>
            @if (donation()!.transactionId) {
              <tr>
                <td>Transaction ID</td>
                <td>{{ donation()!.transactionId }}</td>
              </tr>
            }
            @if (donation()!.completedAt) {
              <tr>
                <td>Date</td>
                <td>{{ formatDate(donation()!.completedAt!) }}</td>
              </tr>
            }
          </table>

          @if (donation()!.userUpgraded) {
            <div class="thank-you-upgrade">
              <h3>Premium benefits unlocked:</h3>
              <ul>
                <li>✓ Unlimited alerts (previously limited to 5)</li>
                <li>✓ Access to future premium charts</li>
                <li>✓ Priority support</li>
                <li>✓ Supporter badge (coming soon)</li>
              </ul>
              <p class="thank-you-relogin">
                Please <a routerLink="/login">log in again</a> to activate your Premium account.
              </p>
            </div>
          }
        } @else {
          <p class="thank-you-sub">
            Thank you for supporting BitWLab. Your donation helps keep professional
            Bitcoin analysis free for everyone.
          </p>

          @if (needsRelogin()) {
            <p class="thank-you-relogin">
              Your account has been upgraded to Premium. Please
              <a routerLink="/login">log in again</a> to access your new benefits.
            </p>
          }
        }

        @if (message()) {
          <p class="form-message">{{ message() }}</p>
        }

        <div class="thank-you-actions">
          <a class="primary-link" routerLink="/alerts">Create Unlimited Alerts</a>
          <a class="secondary-button" routerLink="/charts">Explore Charts</a>
          <a class="ghost-link" routerLink="/dashboard">Return to Dashboard</a>
        </div>
      </div>
    </section>
  `,
})
export class DonateThankYouComponent implements OnInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);

  protected readonly donation = signal<DonationDetailsResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly needsRelogin = signal(false);

  ngOnInit(): void {
    const donationId = this.route.snapshot.queryParamMap.get('donation_id');
    if (donationId) {
      void this.loadDonation(donationId);
    }
  }

  protected formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-US', {
      dateStyle: 'long',
      timeZone: 'UTC',
    });
  }

  private async loadDonation(donationId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const details = await this.api.getDonationDetails(donationId);
      this.donation.set(details);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        this.needsRelogin.set(true);
      } else {
        this.message.set('Could not load donation details.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
