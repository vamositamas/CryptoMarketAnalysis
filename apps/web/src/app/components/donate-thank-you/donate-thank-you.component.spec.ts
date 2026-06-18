import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { DonateThankYouComponent } from './donate-thank-you.component';

const mockDonation = {
  id: 'donation-uuid',
  amount: 10,
  currency: 'USD',
  status: 'completed' as const,
  userUpgraded: true,
  transactionId: 'TXN-ABC123',
  completedAt: '2026-06-18T08:05:00.000Z',
  createdAt: '2026-06-18T08:00:00.000Z',
};

function makeRoute(donationId?: string) {
  return {
    snapshot: { queryParamMap: { get: (key: string) => (key === 'donation_id' ? (donationId ?? null) : null) } },
  };
}

describe('DonateThankYouComponent', () => {
  let fixture: ComponentFixture<DonateThankYouComponent>;
  let api: { getDonationDetails: jest.Mock };

  function setUp(donationId?: string): void {
    api = { getDonationDetails: jest.fn().mockResolvedValue(mockDonation) };
    TestBed.configureTestingModule({
      imports: [DonateThankYouComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiClient, useValue: api },
        { provide: ActivatedRoute, useValue: makeRoute(donationId) },
      ],
    });
    fixture = TestBed.createComponent(DonateThankYouComponent);
    fixture.detectChanges();
  }

  it('shows Thank You heading', async () => {
    setUp('donation-uuid');
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Thank You for Your Support');
  });

  it('loads and shows donation amount and transaction ID', async () => {
    setUp('donation-uuid');
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('$10.00 USD');
    expect(text).toContain('TXN-ABC123');
  });

  it('shows premium upgrade benefits when userUpgraded is true', async () => {
    setUp('donation-uuid');
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unlimited alerts');
  });

  it('shows generic message when no donation_id in URL', () => {
    setUp(undefined);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Thank You for Your Support');
    expect(api.getDonationDetails).not.toHaveBeenCalled();
  });

  it('shows action buttons', async () => {
    setUp('donation-uuid');
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Create Unlimited Alerts');
    expect(text).toContain('Return to Dashboard');
  });
});
