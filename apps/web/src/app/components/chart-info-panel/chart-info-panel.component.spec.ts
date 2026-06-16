import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartInfoPanelComponent } from './chart-info-panel.component';

describe('ChartInfoPanelComponent', () => {
  let fixture: ComponentFixture<ChartInfoPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartInfoPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartInfoPanelComponent);
    fixture.componentRef.setInput('title', 'Bitcoin Rainbow Price Chart');
    fixture.componentRef.setInput('about', 'Uses logarithmic growth curves.');
    fixture.componentRef.setInput('interpretation', 'Bitcoin is in an accumulation zone.');
    fixture.componentRef.setInput('currentFields', [
      { label: 'Current Price', value: '$67,234' },
      { label: 'Current Position', value: 'Band 5 - Accumulate' },
    ]);
    fixture.componentRef.setInput('dataSources', ['Bitcoin Price: CoinGecko API']);
    fixture.componentRef.setInput('lastUpdated', 'June 9, 2026 at 12:05 AM UTC');
    fixture.detectChanges();
  });

  it('renders the required chart information sections', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('About This Indicator');
    expect(text).toContain('Current Value & Interpretation');
    expect(text).toContain('Data Sources');
    expect(text).toContain('Last Updated');
    expect(text).toContain('Band 5 - Accumulate');
  });
});
