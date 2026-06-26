import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { AddWidgetModalComponent } from './add-widget-modal.component';

describe('AddWidgetModalComponent', () => {
  let fixture: ComponentFixture<AddWidgetModalComponent>;
  let auth: { createDashboardWidget: jest.Mock };

  function setUp(existingWidgetTypes: string[] = []): void {
    auth = { createDashboardWidget: jest.fn() };

    TestBed.configureTestingModule({
      imports: [AddWidgetModalComponent],
      providers: [{ provide: AuthApiClient, useValue: auth }],
    });

    fixture = TestBed.createComponent(AddWidgetModalComponent);
    fixture.componentRef.setInput('existingWidgetTypes', existingWidgetTypes);
    fixture.detectChanges();
  }

  it('renders all widget categories with their widgets', () => {
    setUp();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Price Metrics');
    expect(compiled.textContent).toContain('On-chain Metrics');
    expect(compiled.textContent).toContain('Supply Metrics');
    expect(compiled.textContent).toContain('Cycle Indicators');
    expect(compiled.textContent).toContain('Signals & Forecasts');
    expect(compiled.textContent).toContain('Realized Price');
    expect(compiled.textContent).toContain('Hash rate');
    expect(compiled.textContent).toContain('Market Cap');
    expect(compiled.textContent).toContain('Market Signal Score');
    expect(compiled.textContent).toContain('Bull Case Target');
  });

  it('filters widgets by name or description case-insensitively in real time', () => {
    setUp();
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'HASH';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Hash rate');
    expect(compiled.textContent).not.toContain('Realized Price');
    expect(compiled.textContent).not.toContain('Market Cap');
  });

  it('marks widgets the user already has as Added and disables their button', () => {
    setUp(['hash_rate']);
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(compiled.querySelectorAll('button.secondary-button')) as HTMLButtonElement[];
    const hashRateButton = buttons.find((button) => button.textContent?.includes('Added'));

    expect(hashRateButton).toBeTruthy();
    expect(hashRateButton?.disabled).toBe(true);
  });

  it('adds a widget, emits widgetAdded and closed, on a successful Add click', async () => {
    setUp();
    auth.createDashboardWidget.mockResolvedValue({
      id: 'widget-2',
      type: 'hash_rate',
      title: 'Hash Rate',
      value: 931513615.58,
      formattedValue: '931,513,616',
      trend: 'flat',
      trendPercent: null,
      lastUpdated: '2026-06-10T00:00:00.000Z',
    });
    const addedSpy = jest.fn();
    const closedSpy = jest.fn();
    fixture.componentInstance.widgetAdded.subscribe(addedSpy);
    fixture.componentInstance.closed.subscribe(closedSpy);

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(compiled.querySelectorAll('button.secondary-button')) as HTMLButtonElement[];
    const hashRateButton = buttons.find((button) => button.textContent?.includes('Add'));
    hashRateButton?.click();
    await fixture.whenStable();

    expect(auth.createDashboardWidget).toHaveBeenCalledWith({
      widgetType: 'realized_price',
      widgetConfig: { title: 'Realized Price', decimals: 2 },
    });
    expect(addedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'widget-2' }));
    expect(closedSpy).toHaveBeenCalled();
  });

  it('shows an error message and does not close when adding fails', async () => {
    setUp();
    auth.createDashboardWidget.mockRejectedValue(new Error('network down'));
    const closedSpy = jest.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(compiled.querySelectorAll('button.secondary-button')) as HTMLButtonElement[];
    buttons[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(closedSpy).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The widget could not be added. Please try again.',
    );
  });

  it('emits closed when the close button is clicked', () => {
    setUp();
    const closedSpy = jest.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    const closeButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button.icon-button',
    ) as HTMLButtonElement;
    closeButton.click();

    expect(closedSpy).toHaveBeenCalled();
  });

  describe('Custom Formula tab', () => {
    function switchToCustomTab(): void {
      const tabs = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]'),
      ) as HTMLButtonElement[];
      const customTab = tabs.find((t) => t.textContent?.includes('Custom Formula'));
      customTab?.click();
      fixture.detectChanges();
    }

    it('shows the custom formula form when the Custom Formula tab is selected', () => {
      setUp();
      switchToCustomTab();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('Widget name');
      expect(compiled.textContent).toContain('Formula');
      expect(compiled.textContent).toContain('Available variables');
      expect(compiled.textContent).toContain('{{btc_price}}');
    });

    function fillInput(selector: string, value: string): void {
      const input = (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('saves a custom widget on form submit and emits widgetAdded and closed', async () => {
      setUp();
      switchToCustomTab();

      auth.createDashboardWidget.mockResolvedValue({
        id: 'widget-99',
        type: 'custom',
        title: 'S2F x 1000',
        value: 56200,
        formattedValue: '56,200',
        trend: 'flat',
        trendPercent: null,
        lastUpdated: null,
      });
      const addedSpy = jest.fn();
      const closedSpy = jest.fn();
      fixture.componentInstance.widgetAdded.subscribe(addedSpy);
      fixture.componentInstance.closed.subscribe(closedSpy);

      fillInput('input[name="customName"]', 'S2F x 1000');
      fillInput('input[name="customFormula"]', '{{stock_to_flow}} * 1000');

      const saveButton = (fixture.nativeElement as HTMLElement).querySelector(
        '.widget-custom-form > button',
      ) as HTMLButtonElement;
      saveButton.click();
      await fixture.whenStable();

      expect(auth.createDashboardWidget).toHaveBeenCalledWith({
        widgetType: 'custom',
        widgetConfig: { title: 'S2F x 1000', formula: '{{stock_to_flow}} * 1000' },
      });
      expect(addedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'widget-99' }));
      expect(closedSpy).toHaveBeenCalled();
    });

    it('disables the Save Widget button until name and formula are filled in', () => {
      setUp();
      switchToCustomTab();

      const saveButton = (fixture.nativeElement as HTMLElement).querySelector(
        '.widget-custom-form > button',
      ) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);

      fillInput('input[name="customName"]', 'My Widget');
      expect(saveButton.disabled).toBe(true);

      fillInput('input[name="customFormula"]', '{{btc_price}} * 2');
      expect(saveButton.disabled).toBe(false);
    });

    it('shows an error message from the server when saving a custom widget fails', async () => {
      setUp();
      switchToCustomTab();

      const { ApiClientError } = await import('@crypto-market-analysis/data-access/api-client');
      auth.createDashboardWidget.mockRejectedValue(
        new ApiClientError('Unknown variable: {{bad}}', 400),
      );

      fillInput('input[name="customName"]', 'Bad');
      fillInput('input[name="customFormula"]', '{{bad}} * 2');

      const saveButton = (fixture.nativeElement as HTMLElement).querySelector(
        '.widget-custom-form > button',
      ) as HTMLButtonElement;
      saveButton.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Unknown variable: {{bad}}',
      );
    });
  });
});
