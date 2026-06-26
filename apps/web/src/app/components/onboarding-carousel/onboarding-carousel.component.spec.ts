import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OnboardingCarouselComponent } from './onboarding-carousel.component';
import { LegalDialogService } from '../../services/legal-dialog.service';

describe('OnboardingCarouselComponent', () => {
  let fixture: ComponentFixture<OnboardingCarouselComponent>;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingCarouselComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingCarouselComponent);
    nativeElement = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('renders the first onboarding slide', () => {
    expect(nativeElement.querySelector('h2')?.textContent).toContain(
      'Welcome to BitWLab',
    );
    expect(nativeElement.textContent).toContain('Professional Bitcoin analysis tools');
  });

  it('advances and returns between slides', () => {
    clickNext();
    fixture.detectChanges();

    expect(nativeElement.querySelector('h2')?.textContent).toContain(
      'Personalize your dashboard',
    );

    nativeElement.querySelector<HTMLButtonElement>('.previous-button')?.click();
    fixture.detectChanges();

    expect(nativeElement.querySelector('h2')?.textContent).toContain(
      'Welcome to BitWLab',
    );
  });

  it('moves to a slide from the dot indicators', () => {
    nativeElement.querySelectorAll<HTMLButtonElement>('.slide-indicators button')[2]?.click();
    fixture.detectChanges();

    expect(nativeElement.querySelector('h2')?.textContent).toContain(
      'Explore charts and alerts',
    );
  });

  it('emits skipped before the required acceptance slide', () => {
    const skipped = jest.fn();
    fixture.componentInstance.skipped.subscribe(skipped);

    nativeElement.querySelector<HTMLButtonElement>('.skip-button')?.click();

    expect(skipped).toHaveBeenCalledTimes(1);
  });

  it('requires terms, privacy, and disclaimer acceptance before completion', () => {
    const skipped = jest.fn();
    const completed = jest.fn();
    fixture.componentInstance.skipped.subscribe(skipped);
    fixture.componentInstance.completed.subscribe(completed);

    clickNext();
    clickNext();

    const skipButton = nativeElement.querySelector<HTMLButtonElement>('.skip-button');
    expect(skipButton?.disabled).toBe(true);

    clickNext();
    expect(completed).not.toHaveBeenCalled();

    const checkboxes = nativeElement.querySelectorAll<HTMLInputElement>('.acceptance-item input');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    clickNext();
    expect(completed).not.toHaveBeenCalled();

    checkboxes[2].click();
    fixture.detectChanges();

    clickNext();

    expect(skipped).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('opens legal documents in the shared dialog without accepting the checkbox', () => {
    const legal = TestBed.inject(LegalDialogService);

    clickNext();
    clickNext();

    const firstCheckbox = nativeElement.querySelector<HTMLInputElement>('.acceptance-item input');
    const termsButton = nativeElement.querySelector<HTMLButtonElement>('.acceptance-link');

    termsButton?.click();
    fixture.detectChanges();

    expect(legal.activeDoc()).toBe('terms-of-use');
    expect(firstCheckbox?.checked).toBe(false);
  });

  function clickNext(): void {
    nativeElement.querySelector<HTMLButtonElement>('.next-button')?.click();
    fixture.detectChanges();
  }
});
