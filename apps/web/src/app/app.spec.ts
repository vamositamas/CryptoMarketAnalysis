import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the product shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('CryptoMarketAnalysis');
    expect(compiled.querySelector('nav')).toBeNull();
    expect(compiled.querySelector('.topbar-actions')?.textContent).toContain('Login');
    expect(compiled.querySelector('.topbar-actions')?.textContent).toContain('Register');
  });
});
