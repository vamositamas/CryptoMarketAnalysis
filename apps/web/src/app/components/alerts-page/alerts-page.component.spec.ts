import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { AlertsPageComponent } from './alerts-page.component';

const mockAlert = {
  id: 'alert-uuid',
  chartId: 'bitcoin-rainbow',
  chartTitle: 'Bitcoin Rainbow Price Chart',
  metricName: 'rainbow_band',
  condition: 'crosses_above' as const,
  thresholdValue: 7.5,
  alertName: 'Rainbow alert',
  status: 'active' as const,
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  lastEvaluatedAt: null,
  triggeredAt: null,
};

describe('AlertsPageComponent', () => {
  let fixture: ComponentFixture<AlertsPageComponent>;
  let api: {
    getAlerts: jest.Mock;
    deleteAlert: jest.Mock;
    resetAlert: jest.Mock;
  };

  function setUp(): void {
    TestBed.configureTestingModule({
      imports: [AlertsPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiClient, useValue: api },
      ],
    });

    fixture = TestBed.createComponent(AlertsPageComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = {
      getAlerts: jest.fn().mockResolvedValue({
        alerts: [],
        alertLimit: { used: 0, max: 5, unlimited: false },
      }),
      deleteAlert: jest.fn().mockResolvedValue(undefined),
      resetAlert: jest.fn().mockResolvedValue({ ...mockAlert, status: 'active', triggeredAt: null }),
    };
  });

  it('shows a loading state before the API responds', () => {
    setUp();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading');
  });

  it('shows empty state when there are no alerts', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no alerts yet');
  });

  it('shows the free-user alert count label', async () => {
    api.getAlerts.mockResolvedValue({
      alerts: [mockAlert],
      alertLimit: { used: 1, max: 5, unlimited: false },
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 of 5 alerts used');
  });

  it('shows an unlimited count label for premium users', async () => {
    api.getAlerts.mockResolvedValue({
      alerts: [mockAlert],
      alertLimit: { used: 3, max: null, unlimited: true },
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 alerts');
  });

  it('renders the alert table with name, chart link, condition summary, status, and created', async () => {
    api.getAlerts.mockResolvedValue({
      alerts: [mockAlert],
      alertLimit: { used: 1, max: 5, unlimited: false },
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Rainbow alert');
    expect(compiled.textContent).toContain('Bitcoin Rainbow Price Chart');
    expect(compiled.textContent).toContain('Rainbow Band crosses above 7.5');
    expect(compiled.querySelector('.alert-status-active')).not.toBeNull();
    expect(compiled.textContent).toContain('days ago');
  });

  it('shows inline confirm buttons when Delete is clicked', async () => {
    api.getAlerts.mockResolvedValue({
      alerts: [mockAlert],
      alertLimit: { used: 1, max: 5, unlimited: false },
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const deleteBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Delete') as HTMLButtonElement;
    deleteBtn.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Delete?');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Confirm');
  });

  it('removes the alert from the table after confirmed delete', async () => {
    api.getAlerts.mockResolvedValue({
      alerts: [mockAlert],
      alertLimit: { used: 1, max: 5, unlimited: false },
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['requestDelete']('alert-uuid');
    fixture.detectChanges();

    await fixture.componentInstance['confirmDelete']('alert-uuid');
    fixture.detectChanges();

    expect(api.deleteAlert).toHaveBeenCalledWith('alert-uuid');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Rainbow alert');
  });

  it('updates alert status to Active after reset', async () => {
    const triggered = { ...mockAlert, status: 'triggered' as const, triggeredAt: new Date().toISOString() };
    api.getAlerts.mockResolvedValue({
      alerts: [triggered],
      alertLimit: { used: 1, max: 5, unlimited: false },
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['resetAlert'](triggered);
    fixture.detectChanges();

    expect(api.resetAlert).toHaveBeenCalledWith('alert-uuid');
    expect((fixture.nativeElement as HTMLElement).querySelector('.alert-status-active')).not.toBeNull();
  });
});
