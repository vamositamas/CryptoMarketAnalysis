import { Component, computed, output, signal } from '@angular/core';

interface OnboardingSlide {
  readonly headline: string;
  readonly subheading: string;
  readonly body: string;
  readonly visualLabel: string;
  readonly metrics: readonly string[];
}

const SWIPE_THRESHOLD_PX = 48;

@Component({
  selector: 'app-onboarding-carousel',
  templateUrl: './onboarding-carousel.component.html',
  styleUrl: './onboarding-carousel.component.scss',
})
export class OnboardingCarouselComponent {
  readonly skipped = output<void>();
  readonly completed = output<void>();

  protected readonly slides: readonly OnboardingSlide[] = [
    {
      headline: $localize`:Onboarding slide 1 headline@@onboardingCarousel.slide1.headline:Welcome to BitWLab`,
      subheading: $localize`:Onboarding slide 1 subheading@@onboardingCarousel.slide1.subheading:Professional Bitcoin analysis tools, free forever`,
      body: $localize`:Onboarding slide 1 body@@onboardingCarousel.slide1.body:Follow cycle signals, valuation models, and on-chain context from a focused workspace built for long-term market decisions.`,
      visualLabel: $localize`:Onboarding slide 1 visual@@onboardingCarousel.slide1.visual:Cycle signal`,
      metrics: [
        $localize`:Onboarding slide 1 metric 1@@onboardingCarousel.slide1.metric1:Market state`,
        $localize`:Onboarding slide 1 metric 2@@onboardingCarousel.slide1.metric2:Cycle risk`,
        $localize`:Onboarding slide 1 metric 3@@onboardingCarousel.slide1.metric3:Model context`,
      ],
    },
    {
      headline: $localize`:Onboarding slide 2 headline@@onboardingCarousel.slide2.headline:Personalize your dashboard`,
      subheading: $localize`:Onboarding slide 2 subheading@@onboardingCarousel.slide2.subheading:Keep the indicators you care about closest`,
      body: $localize`:Onboarding slide 2 body@@onboardingCarousel.slide2.body:Start with curated KPI widgets, then shape your workspace around valuation, momentum, alerts, and research workflows.`,
      visualLabel: $localize`:Onboarding slide 2 visual@@onboardingCarousel.slide2.visual:Dashboard widgets`,
      metrics: [
        $localize`:Onboarding slide 2 metric 1@@onboardingCarousel.slide2.metric1:MVRV Z-Score`,
        $localize`:Onboarding slide 2 metric 2@@onboardingCarousel.slide2.metric2:Rainbow band`,
        $localize`:Onboarding slide 2 metric 3@@onboardingCarousel.slide2.metric3:Pi Cycle`,
      ],
    },
    {
      headline: $localize`:Onboarding slide 3 headline@@onboardingCarousel.slide3.headline:Explore charts and alerts`,
      subheading: $localize`:Onboarding slide 3 subheading@@onboardingCarousel.slide3.subheading:Turn Bitcoin models into daily operating signals`,
      body: $localize`:Onboarding slide 3 body@@onboardingCarousel.slide3.body:Open historical charts, compare timeframes, and prepare alerts so important threshold changes do not slip past you.`,
      visualLabel: $localize`:Onboarding slide 3 visual@@onboardingCarousel.slide3.visual:Charts and alerts`,
      metrics: [
        $localize`:Onboarding slide 3 metric 1@@onboardingCarousel.slide3.metric1:Chart library`,
        $localize`:Onboarding slide 3 metric 2@@onboardingCarousel.slide3.metric2:Timeframes`,
        $localize`:Onboarding slide 3 metric 3@@onboardingCarousel.slide3.metric3:Alerts`,
      ],
    },
  ];
  protected readonly currentIndex = signal(0);
  protected readonly currentSlide = computed(() => this.slides[this.currentIndex()]);
  protected readonly isFirstSlide = computed(() => this.currentIndex() === 0);
  protected readonly isLastSlide = computed(
    () => this.currentIndex() === this.slides.length - 1,
  );
  private touchStartX: number | null = null;

  protected goToSlide(index: number): void {
    if (index < 0 || index >= this.slides.length || index === this.currentIndex()) {
      return;
    }

    this.currentIndex.set(index);
  }

  protected previous(): void {
    this.goToSlide(this.currentIndex() - 1);
  }

  protected next(): void {
    this.goToSlide(this.currentIndex() + 1);
  }

  protected complete(): void {
    this.completed.emit();
  }

  protected skip(): void {
    this.skipped.emit();
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  }

  protected onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) {
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? this.touchStartX;
    const distance = touchEndX - this.touchStartX;
    this.touchStartX = null;

    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) {
      return;
    }

    if (distance < 0) {
      this.next();
    } else {
      this.previous();
    }
  }
}
