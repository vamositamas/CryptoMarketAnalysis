import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ChartLibraryComponent } from './chart-library.component';

describe('ChartLibraryComponent', () => {
  let fixture: ComponentFixture<ChartLibraryComponent>;
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    router = { navigate: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ChartLibraryComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartLibraryComponent);
    fixture.detectChanges();
  });

  it('renders chart categories and free chart cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Valuation Models');
    expect(compiled.textContent).toContain('Cycle Indicators');
    expect(compiled.textContent).toContain('Stock-to-Flow Model');
    expect(compiled.textContent).toContain('Bitcoin Rainbow Price Chart');
    expect(compiled.textContent).toContain('Pi Cycle Top Indicator');
    expect(compiled.querySelectorAll('.tier-badge')[0]?.textContent?.trim()).toBe('FREE');
  });

  it('filters charts by title case-insensitively', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'RAINBOW';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Bitcoin Rainbow Price Chart');
    expect(text).not.toContain('Stock-to-Flow Model');
    expect(text).not.toContain('Pi Cycle Top Indicator');
  });

  it('navigates to chart detail path from the View Chart button', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();

    expect(router.navigate).toHaveBeenCalledWith(['/charts', 'bitcoin-rainbow']);
  });
});
