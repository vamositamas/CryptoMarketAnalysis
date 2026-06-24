import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OnboardingCarouselComponent } from './onboarding-carousel.component';

describe('OnboardingCarouselComponent', () => {
  let fixture: ComponentFixture<OnboardingCarouselComponent>;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingCarouselComponent],
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

  it('emits skipped and completed events', () => {
    const skipped = jest.fn();
    const completed = jest.fn();
    fixture.componentInstance.skipped.subscribe(skipped);
    fixture.componentInstance.completed.subscribe(completed);

    nativeElement.querySelector<HTMLButtonElement>('.skip-button')?.click();
    clickNext();
    clickNext();
    clickNext();

    expect(skipped).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  function clickNext(): void {
    nativeElement.querySelector<HTMLButtonElement>('.next-button')?.click();
  }
});
