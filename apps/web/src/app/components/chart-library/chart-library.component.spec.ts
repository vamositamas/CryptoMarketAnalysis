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

    expect(compiled.textContent).toContain('Értékelési modellek');
    expect(compiled.textContent).toContain('Ciklusindikátorok');
    expect(compiled.textContent).toContain('Stock-to-Flow Model');
    expect(compiled.textContent).toContain('Bitcoin szivárványárgrafikon');
    expect(compiled.textContent).toContain('Pi Cycle Top Indicator');
  });

  it('filters charts by title case-insensitively', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'SZIVÁRVÁNY';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Bitcoin szivárványárgrafikon');
    expect(text).not.toContain('Stock-to-Flow Model');
    expect(text).not.toContain('Pi Cycle Top Indicator');
  });

  it('navigates to chart detail path from a chart row click', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const sidebarItems = compiled.querySelectorAll(
      '.chart-card',
    ) as NodeListOf<HTMLButtonElement>;
    sidebarItems[1].click();

    expect(router.navigate).toHaveBeenCalledWith(['/charts', 'mvrv-z-score']);
  });
});
