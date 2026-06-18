import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { CreateAlertModalComponent } from './create-alert-modal.component';

describe('CreateAlertModalComponent', () => {
  let fixture: ComponentFixture<CreateAlertModalComponent>;
  let api: { createAlert: jest.Mock };
  let routerNavigate: jest.Mock;

  const metrics = [
    { value: 'rainbow_band', label: 'Rainbow Band' },
    { value: 'btc_price', label: 'BTC Price USD' },
  ];

  function setUp(): void {
    TestBed.configureTestingModule({
      imports: [CreateAlertModalComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiClient, useValue: api },
      ],
    });

    fixture = TestBed.createComponent(CreateAlertModalComponent);
    fixture.componentInstance.chartId = 'bitcoin-rainbow';
    fixture.componentInstance.metrics = metrics;
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = { createAlert: jest.fn().mockResolvedValue({ id: 'alert-uuid', status: 'active' }) };
  });

  it('renders the form with alert name, metric, condition and threshold inputs', () => {
    setUp();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[formControlName="alertName"]')).not.toBeNull();
    expect(compiled.querySelector('select[formControlName="metricName"]')).not.toBeNull();
    expect(compiled.querySelector('select[formControlName="condition"]')).not.toBeNull();
    expect(compiled.querySelector('input[formControlName="thresholdValue"]')).not.toBeNull();
  });

  it('pre-selects the first metric from the metrics input', () => {
    setUp();

    const select = fixture.nativeElement.querySelector(
      'select[formControlName="metricName"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe('rainbow_band');
  });

  it('pre-populates the condition dropdown with all 5 conditions', () => {
    setUp();

    const options = fixture.nativeElement.querySelectorAll(
      'select[formControlName="condition"] option',
    ) as NodeListOf<HTMLOptionElement>;
    expect(options).toHaveLength(5);
  });

  it('shows an email notification checkbox that is checked and disabled', () => {
    setUp();

    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
  });

  it('calls createAlert with the correct payload on submit', async () => {
    setUp();

    const instance = fixture.componentInstance;
    instance.form.setValue({
      alertName: 'Rainbow alert',
      metricName: 'rainbow_band',
      condition: 'crosses_above',
      thresholdValue: 7.5,
    });
    fixture.detectChanges();

    await instance['submit']();

    expect(api.createAlert).toHaveBeenCalledWith({
      chartId: 'bitcoin-rainbow',
      metricName: 'rainbow_band',
      condition: 'crosses_above',
      thresholdValue: 7.5,
      alertName: 'Rainbow alert',
    });
  });

  it('shows an error message when the API call fails and keeps the modal open', async () => {
    api.createAlert.mockRejectedValue(
      Object.assign(new Error('Free users can create maximum 5 alerts.'), { statusCode: 403 }),
    );
    setUp();

    const instance = fixture.componentInstance;
    instance.form.setValue({
      alertName: 'Test',
      metricName: 'rainbow_band',
      condition: 'greater_than',
      thresholdValue: 1,
    });

    await instance['submit']();
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.form-message') as HTMLElement;
    expect(errorEl).not.toBeNull();
  });

  it('emits closed when the Cancel button is clicked', () => {
    setUp();
    const closedSpy = jest.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const cancelBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b: Element) => (b as HTMLButtonElement).textContent?.trim() === 'Cancel') as HTMLButtonElement;
    cancelBtn.click();

    expect(closedSpy).toHaveBeenCalled();
  });
});
