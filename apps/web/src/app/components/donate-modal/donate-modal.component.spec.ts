import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { DonateModalComponent } from './donate-modal.component';

describe('DonateModalComponent', () => {
  let fixture: ComponentFixture<DonateModalComponent>;
  let api: { initiateDonation: jest.Mock };

  beforeEach(() => {
    api = {
      initiateDonation: jest.fn().mockResolvedValue({
        donationId: 'donation-uuid',
        approvalUrl: 'https://paypal.com/checkout',
      }),
    };

    TestBed.configureTestingModule({
      imports: [DonateModalComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiClient, useValue: api },
      ],
    });

    fixture = TestBed.createComponent(DonateModalComponent);
    fixture.detectChanges();
  });

  it('renders heading and benefits list', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Support CryptoMarketAnalysis');
    expect(text).toContain('Unlimited price alerts');
  });

  it('shows preset amount buttons', () => {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.donate-amount-btn'),
    );
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels).toContain('$5');
    expect(labels).toContain('$10');
    expect(labels).toContain('$25');
    expect(labels).toContain('Custom');
  });

  it('selects a preset amount when button is clicked', () => {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.donate-amount-btn'),
    );
    const fiveBtn = buttons.find((b) => b.textContent?.includes('$5'))!;
    fiveBtn.click();
    fixture.detectChanges();
    expect(fiveBtn.classList).toContain('selected');
  });

  it('shows custom input when Custom button is clicked', () => {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.donate-amount-btn'),
    );
    const customBtn = buttons.find((b) => b.textContent?.includes('Custom'))!;
    customBtn.click();
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[type="number"]');
    expect(input).not.toBeNull();
  });

  it('calls initiateDonation with selected amount on Donate click', async () => {
    const donateBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes('Donate via PayPal'))!;

    donateBtn.click();
    await fixture.whenStable();

    expect(api.initiateDonation).toHaveBeenCalledWith({ amount: 10 });
  });

  it('emits closed event when Close button is clicked', () => {
    const closedSpy = jest.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const closeBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.modal-close')!;
    closeBtn.click();
    fixture.detectChanges();

    expect(closedSpy).toHaveBeenCalled();
  });
});
