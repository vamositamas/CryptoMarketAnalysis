import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface FaqItem {
  id: string;
  categoryId: string;
  category: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-user-guide-page',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .ug-page {
      position: relative;
      max-width: 860px;
      margin: 0 auto;
      padding: 36px 24px 72px;
    }

    .ug-close {
      position: absolute;
      top: 24px;
      right: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      padding: 0;
      border: 1.5px solid #d7ded8;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.72);
      color: #65736f;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }

    .ug-close:hover,
    .ug-close:focus-visible {
      color: #145c4b;
      border-color: #145c4b;
      background: #ffffff;
      box-shadow: 0 2px 10px rgba(20, 92, 75, 0.10);
      outline: none;
    }

    .ug-close svg {
      width: 18px;
      height: 18px;
    }

    /* ── Header ── */
    .ug-header {
      text-align: center;
      margin-bottom: 52px;
    }

    .ug-header h2 {
      font-size: clamp(1.9rem, 4vw, 2.6rem);
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #111827;
      margin: 4px 0 12px;
    }

    .ug-header .ug-subtitle {
      color: #65736f;
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 auto 28px;
      max-width: 460px;
    }

    /* ── Search ── */
    .ug-search {
      position: relative;
      max-width: 540px;
      margin: 0 auto;
    }

    .ug-search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #8a948f;
      pointer-events: none;
    }

    .ug-search-input {
      width: 100%;
      padding: 14px 16px 14px 46px;
      border: 1.5px solid #d7ded8;
      border-radius: 14px;
      background: #ffffff;
      font-size: 1rem;
      font-family: inherit;
      color: #17202a;
      outline: none;
      box-shadow: 0 2px 10px rgba(20, 92, 75, 0.07);
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }

    .ug-search-input:focus {
      border-color: #145c4b;
      box-shadow: 0 0 0 3px rgba(20, 92, 75, 0.12);
    }

    .ug-search-input::placeholder {
      color: #aab8b2;
    }

    .ug-result-count {
      margin: 12px 0 0;
      font-size: 0.8rem;
      color: #9aa8a2;
      text-align: center;
    }

    /* ── Category section ── */
    .ug-section {
      margin-bottom: 56px;
    }

    .ug-section-title {
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 0 0 28px;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.11em;
      color: #9aa8a2;
    }

    .ug-section-title::before,
    .ug-section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, #e5ebe7);
    }

    .ug-section-title::after {
      background: linear-gradient(to left, transparent, #e5ebe7);
    }

    /* ── Thread of Q&A pairs ── */
    .ug-thread {
      display: grid;
      gap: 32px;
    }

    /* ── Single exchange (one Q + one A) ── */
    .ug-exchange {
      display: grid;
      gap: 12px;
    }

    /* ── Shared bubble styles ── */
    .ug-bubble {
      display: grid;
      gap: 5px;
      padding: 16px 20px;
      line-height: 1.7;
      position: relative;
    }

    .ug-bubble p {
      margin: 0;
      font-size: 0.94rem;
    }

    .ug-speaker {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.66rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.09em;
    }

    .ug-speaker-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── Q bubble — user, right-aligned ── */
    .ug-bubble--q {
      justify-self: end;
      max-width: 78%;
      background: #fffbef;
      border: 1.5px solid #e8cc6a;
      border-radius: 18px 18px 4px 18px;
      box-shadow: 0 2px 8px rgba(232, 180, 40, 0.10);
    }

    .ug-bubble--q .ug-speaker {
      color: #9a6800;
      justify-content: flex-end;
      flex-direction: row-reverse;
    }

    .ug-bubble--q .ug-speaker-dot {
      background: #f7b731;
    }

    .ug-bubble--q p {
      color: #3b2a00;
      font-weight: 600;
      text-align: right;
    }

    /* ── A bubble — BitWLab, left-aligned ── */
    .ug-bubble--a {
      justify-self: start;
      max-width: 84%;
      background: #ffffff;
      border: 1.5px solid #d4e8da;
      border-left: 3px solid #145c4b;
      border-radius: 4px 18px 18px 18px;
      box-shadow: 0 2px 12px rgba(20, 92, 75, 0.07);
    }

    .ug-bubble--a .ug-speaker {
      color: #145c4b;
    }

    .ug-bubble--a .ug-speaker-dot {
      background: #145c4b;
    }

    .ug-bubble--a p {
      color: #2d3a35;
    }

    /* ── No results ── */
    .ug-no-results {
      text-align: center;
      padding: 70px 24px;
      color: #8a948f;
    }

    .ug-no-results svg {
      display: block;
      margin: 0 auto 16px;
      opacity: 0.35;
    }

    .ug-no-results p {
      font-size: 1rem;
      margin: 0;
    }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .ug-page { padding: 24px 16px 56px; }
      .ug-close {
        top: 14px;
        right: 14px;
      }
      .ug-bubble--q, .ug-bubble--a { max-width: 94%; }
      .ug-bubble { padding: 13px 16px; }
    }
  `],
  template: `
    <div class="ug-page">
      <button
        type="button"
        class="ug-close"
        (click)="closeGuide()"
        aria-label="Close user guide"
        i18n-aria-label="Close user guide@@faq.close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"></path>
        </svg>
      </button>

      <!-- Header + search -->
      <header class="ug-header">
        <p class="eyebrow" i18n="User guide eyebrow@@faq.eyebrow">User Guide</p>
        <h2 i18n="User guide title@@faq.title">How can we help?</h2>
        <p class="ug-subtitle" i18n="User guide subtitle@@faq.subtitle">
          Search questions and answers about every feature of the platform.
        </p>

        <div class="ug-search" role="search">
          <svg class="ug-search-icon" aria-hidden="true" width="17" height="17"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            class="ug-search-input"
            type="search"
            [(ngModel)]="searchQuery"
            [placeholder]="searchPlaceholder"
            i18n-aria-label="User guide search aria@@faq.search.aria"
            aria-label="Search user guide"
          />
        </div>

        @if (searchQuery()) {
          <p class="ug-result-count" aria-live="polite">
            {{ filteredFaqs().length }}&nbsp;{{ filteredFaqs().length === 1 ? answerLabel : answersLabel }}
          </p>
        }
      </header>

      <!-- FAQ sections -->
      @if (groupedFaqs().length > 0) {
        @for (group of groupedFaqs(); track group.categoryId) {
          <section class="ug-section" [attr.aria-labelledby]="'cat-' + group.categoryId">
            <h3 class="ug-section-title" [id]="'cat-' + group.categoryId">{{ group.category }}</h3>

            <div class="ug-thread" role="list">
              @for (item of group.items; track item.id) {
                <div class="ug-exchange" role="listitem">

                  <!-- Question bubble (user / right) -->
                  <div class="ug-bubble ug-bubble--q">
                    <span class="ug-speaker" aria-hidden="true">
                      <span class="ug-speaker-dot"></span>
                      {{ youLabel }}
                    </span>
                    <p>{{ item.question }}</p>
                  </div>

                  <!-- Answer bubble (BitWLab / left) -->
                  <div class="ug-bubble ug-bubble--a">
                    <span class="ug-speaker" aria-hidden="true">
                      <span class="ug-speaker-dot"></span>
                      BitWLab
                    </span>
                    <p>{{ item.answer }}</p>
                  </div>

                </div>
              }
            </div>
          </section>
        }
      } @else {
        <div class="ug-no-results" role="status" aria-live="polite">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M8 11h6M11 8v6" opacity="0.4"/>
          </svg>
          <p i18n="User guide no results@@faq.noResults">No answers found for your search.</p>
        </div>
      }

    </div>
  `,
})
export class UserGuidePageComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly searchQuery = signal('');

  protected readonly searchPlaceholder = $localize`:User guide search placeholder@@faq.search.placeholder:Search the guide…`;
  protected readonly youLabel = $localize`:User guide question speaker@@faq.speaker.you:You`;
  protected readonly answerLabel = $localize`:User guide single result label@@faq.count.answer:answer`;
  protected readonly answersLabel = $localize`:User guide plural results label@@faq.count.answers:answers`;

  protected readonly faqs: FaqItem[] = [
    // ── Getting started ──────────────────────────────────────────────────────
    {
      id: 'what-is',
      categoryId: 'getting-started',
      category: $localize`:FAQ category getting started@@faq.cat.gettingStarted:Getting started`,
      question: $localize`:FAQ Q what is platform@@faq.q.whatIs:What is BitWLab?`,
      answer: $localize`:FAQ A what is platform@@faq.a.whatIs:BitWLab is a free Bitcoin on-chain analytics platform. It brings together over 20 valuation models, cycle indicators, and macro context charts in one focused workspace — no subscriptions or paid data feeds required.`,
    },
    {
      id: 'is-free',
      categoryId: 'getting-started',
      category: $localize`:FAQ category getting started@@faq.cat.gettingStarted:Getting started`,
      question: $localize`:FAQ Q is it free@@faq.q.isFree:Is BitWLab free to use?`,
      answer: $localize`:FAQ A is it free@@faq.a.isFree:Yes, completely. All charts, models, alerts, and tools are free with no premium tiers or paywalls. The platform relies entirely on publicly available data sources.`,
    },
    {
      id: 'need-account',
      categoryId: 'getting-started',
      category: $localize`:FAQ category getting started@@faq.cat.gettingStarted:Getting started`,
      question: $localize`:FAQ Q need account@@faq.q.needAccount:Do I need an account to use BitWLab?`,
      answer: $localize`:FAQ A need account@@faq.a.needAccount:Yes. A free account is required to access live charts and features. Registration only needs your email address — no credit card or personal data beyond that.`,
    },
    {
      id: 'languages',
      categoryId: 'getting-started',
      category: $localize`:FAQ category getting started@@faq.cat.gettingStarted:Getting started`,
      question: $localize`:FAQ Q languages@@faq.q.languages:Which languages are available?`,
      answer: $localize`:FAQ A languages@@faq.a.languages:The platform supports English and Hungarian. Switch at any time using the EN / HU toggle in the top navigation bar, or permanently from My Account in the user menu.`,
    },

    // ── Dashboard ────────────────────────────────────────────────────────────
    {
      id: 'dashboard-what',
      categoryId: 'dashboard',
      category: $localize`:FAQ category dashboard@@faq.cat.dashboard:Dashboard`,
      question: $localize`:FAQ Q what is dashboard@@faq.q.dashboard:What is the Dashboard?`,
      answer: $localize`:FAQ A what is dashboard@@faq.a.dashboard:The Dashboard is your personal overview screen. It shows customisable metric widgets for key Bitcoin indicators, a market signals banner with a composite cycle score, and quick access to your favourite and recently viewed charts.`,
    },
    {
      id: 'widgets-what',
      categoryId: 'dashboard',
      category: $localize`:FAQ category dashboard@@faq.cat.dashboard:Dashboard`,
      question: $localize`:FAQ Q what are widgets@@faq.q.widgets:What are widgets?`,
      answer: $localize`:FAQ A what are widgets@@faq.a.widgets:Widgets are metric cards arranged in a grid on your Dashboard. Each widget shows a key value — such as MVRV Z-Score, BTC 24-hour change, Stock-to-Flow, Halving progress, or Fear & Greed index — updated automatically.`,
    },
    {
      id: 'add-widget',
      categoryId: 'dashboard',
      category: $localize`:FAQ category dashboard@@faq.cat.dashboard:Dashboard`,
      question: $localize`:FAQ Q add remove widget@@faq.q.addWidget:How do I add or remove a widget?`,
      answer: $localize`:FAQ A add remove widget@@faq.a.addWidget:Click "Add Widget" at the top of the Dashboard to browse available metrics and add them to your grid. To remove a widget, hover over it and click the ✕ button that appears in the corner. Drag widgets to reorder them.`,
    },
    {
      id: 'signals-banner',
      categoryId: 'dashboard',
      category: $localize`:FAQ category dashboard@@faq.cat.dashboard:Dashboard`,
      question: $localize`:FAQ Q market signals banner@@faq.q.signalsBanner:What is the Market Signals Banner?`,
      answer: $localize`:FAQ A market signals banner@@faq.a.signalsBanner:The banner at the top of the Dashboard shows a composite cycle score (−100 to +100), the current BTC price, an overall zone label (Very Bullish to Very Bearish), and individual readings for each tracked indicator. Clicking it opens the Trade Planner.`,
    },

    // ── Charts & models ───────────────────────────────────────────────────────
    {
      id: 'charts-count',
      categoryId: 'charts',
      category: $localize`:FAQ category charts@@faq.cat.charts:Charts & models`,
      question: $localize`:FAQ Q how many charts@@faq.q.chartsCount:How many charts are available?`,
      answer: $localize`:FAQ A how many charts@@faq.a.chartsCount:Over 20 analytical models are available: MVRV Z-Score, Rainbow Band, Pi Cycle Top, Stock-to-Flow, Fear & Greed, Puell Multiple, Power Law, CVDD, Halving Spiral, Realized Price, 200-Day MA, 2-Year MA Multiplier, Hash Ribbons, VDD Multiple, Mayer Multiple, Difficulty Ribbon, 200-Week MA Heatmap, NVT Ratio, Thermocap Multiple, Excess Liquidity, and S&P 500 Liquidity.`,
    },
    {
      id: 'chart-navigate',
      categoryId: 'charts',
      category: $localize`:FAQ category charts@@faq.cat.charts:Charts & models`,
      question: $localize`:FAQ Q browse chart library@@faq.q.navigate:How do I browse the chart library?`,
      answer: $localize`:FAQ A browse chart library@@faq.a.navigate:Click "Charts" in the top navigation bar to open the Chart Library. Charts are grouped by category and searchable by name. Click any chart card to open the full interactive chart page.`,
    },
    {
      id: 'chart-export',
      categoryId: 'charts',
      category: $localize`:FAQ category charts@@faq.cat.charts:Charts & models`,
      question: $localize`:FAQ Q export chart@@faq.q.export:Can I export a chart?`,
      answer: $localize`:FAQ A export chart@@faq.a.export:Yes. On any chart page use the export menu in the toolbar to download the chart as a PNG image or CSV data file. The export captures all visible data and annotations.`,
    },
    {
      id: 'annotations',
      categoryId: 'charts',
      category: $localize`:FAQ category charts@@faq.cat.charts:Charts & models`,
      question: $localize`:FAQ Q annotations@@faq.q.annotations:What are chart annotations?`,
      answer: $localize`:FAQ A annotations@@faq.a.annotations:Annotations let you place personal notes on a chart at specific dates. Click the annotation tool in the chart toolbar, then click the chart at the date you want to mark. Your notes are saved to your account and persist across sessions.`,
    },
    {
      id: 'favourites',
      categoryId: 'charts',
      category: $localize`:FAQ category charts@@faq.cat.charts:Charts & models`,
      question: $localize`:FAQ Q favourites@@faq.q.favourites:How do I save a chart to my favourites?`,
      answer: $localize`:FAQ A favourites@@faq.a.favourites:Click the star (★) icon on any chart page to add it to your favourites. Starred charts appear in the Favourites tab on your Dashboard for quick access. Click the star again to remove it.`,
    },

    // ── Trade Planner ─────────────────────────────────────────────────────────
    {
      id: 'trade-planner-what',
      categoryId: 'trade-planner',
      category: $localize`:FAQ category trade planner@@faq.cat.tradePlanner:Trade Planner`,
      question: $localize`:FAQ Q what is trade planner@@faq.q.tradePlanner:What is the Trade Planner?`,
      answer: $localize`:FAQ A what is trade planner@@faq.a.tradePlanner:The Trade Planner is a decision-support tool that aggregates multiple on-chain cycle signals into a composite score. It shows a signal grid, price projections based on historical cycle data, and a personal trade plan log where you can record entries, targets, and notes.`,
    },
    {
      id: 'score-calc',
      categoryId: 'trade-planner',
      category: $localize`:FAQ category trade planner@@faq.cat.tradePlanner:Trade Planner`,
      question: $localize`:FAQ Q score calculation@@faq.q.scoreCalc:How is the market signal score calculated?`,
      answer: $localize`:FAQ A score calculation@@faq.a.scoreCalc:The composite score (−100 to +100) aggregates readings from MVRV Z-Score, Rainbow Band, Fear & Greed, Stock-to-Flow, Puell Multiple, and other indicators. Each contributes a normalised sub-score based on its current zone. Higher positive scores indicate bullish cycle conditions; lower negative scores indicate bearish conditions.`,
    },

    // ── Alerts ────────────────────────────────────────────────────────────────
    {
      id: 'alerts-what',
      categoryId: 'alerts',
      category: $localize`:FAQ category alerts@@faq.cat.alerts:Alerts`,
      question: $localize`:FAQ Q what are alerts@@faq.q.alerts:What are alerts?`,
      answer: $localize`:FAQ A what are alerts@@faq.a.alerts:Alerts are email notifications triggered when a chosen indicator crosses a threshold you set. For example, get notified when the MVRV Z-Score exceeds 7, or when the Fear & Greed index drops below 20.`,
    },
    {
      id: 'create-alert',
      categoryId: 'alerts',
      category: $localize`:FAQ category alerts@@faq.cat.alerts:Alerts`,
      question: $localize`:FAQ Q create alert@@faq.q.createAlert:How do I create an alert?`,
      answer: $localize`:FAQ A create alert@@faq.a.createAlert:Go to the Alerts page from the top navigation, click "Create alert", select an indicator and metric, set a threshold direction (above or below) and value, then save. You will receive an email when the condition is met. Alerts can be paused, edited, or deleted at any time.`,
    },

    // ── Account ───────────────────────────────────────────────────────────────
    {
      id: 'change-language',
      categoryId: 'account',
      category: $localize`:FAQ category account@@faq.cat.account:Account`,
      question: $localize`:FAQ Q change language@@faq.q.changeLanguage:How do I change the interface language?`,
      answer: $localize`:FAQ A change language@@faq.a.changeLanguage:Click EN or HU in the top navigation bar to switch between English and Hungarian. To save your preference permanently, open My Account from the user menu, select a language, and click Save changes.`,
    },
    {
      id: 'update-profile',
      categoryId: 'account',
      category: $localize`:FAQ category account@@faq.cat.account:Account`,
      question: $localize`:FAQ Q update profile@@faq.q.updateProfile:How do I update my name or preferences?`,
      answer: $localize`:FAQ A update profile@@faq.a.updateProfile:Click your avatar (initials button) in the top-right corner and select "My Account". Update your full name and language preference, then click "Save changes" to apply.`,
    },
    {
      id: 'data-collected',
      categoryId: 'account',
      category: $localize`:FAQ category account@@faq.cat.account:Account`,
      question: $localize`:FAQ Q data collected@@faq.q.dataCollect:What data does BitWLab collect about me?`,
      answer: $localize`:FAQ A data collected@@faq.a.dataCollect:Only your email address and optionally your full name are stored. Standard server logs (IP address, browser type) are kept for security. No payment data is collected and no third-party tracking cookies are used. See Privacy Policy in the user menu for full details.`,
    },
  ];

  protected readonly filteredFaqs = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.faqs;
    return this.faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  });

  protected readonly groupedFaqs = computed(() => {
    const map = new Map<string, { categoryId: string; category: string; items: FaqItem[] }>();
    for (const item of this.filteredFaqs()) {
      if (!map.has(item.categoryId)) {
        map.set(item.categoryId, { categoryId: item.categoryId, category: item.category, items: [] });
      }
      map.get(item.categoryId)!.items.push(item);
    }
    return [...map.values()];
  });

  protected closeGuide(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl('/dashboard');
  }
}
