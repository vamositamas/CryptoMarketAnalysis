import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiClient, type EmailTemplate } from '@crypto-market-analysis/data-access/api-client';
import { EmailTemplateEditorComponent } from './email-template-editor.component';

const mockHtmlTemplate: EmailTemplate = {
  key: 'alert_triggered_en_html',
  label: 'Alert Triggered — HTML Body (EN)',
  value: '<h2>Alert Triggered: {{alertName}}</h2>',
  isCustom: false,
  updatedAt: null,
  variables: ['alertName', 'chartTitle'],
};

const mockSubjectTemplate: EmailTemplate = {
  key: 'alert_triggered_en_subject',
  label: 'Alert Triggered — Subject Line (EN)',
  value: 'Alert Triggered: {{alertName}}',
  isCustom: false,
  updatedAt: null,
  variables: ['alertName'],
};

describe('EmailTemplateEditorComponent', () => {
  let fixture: ComponentFixture<EmailTemplateEditorComponent>;
  let api: {
    getEmailTemplates: jest.Mock;
    getEmailConfig: jest.Mock;
    updateEmailTemplate: jest.Mock;
    resetEmailTemplate: jest.Mock;
  };

  function setUp(): void {
    TestBed.configureTestingModule({
      imports: [EmailTemplateEditorComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiClient, useValue: api },
      ],
    });
    fixture = TestBed.createComponent(EmailTemplateEditorComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = {
      getEmailTemplates: jest.fn().mockResolvedValue({ templates: [mockHtmlTemplate, mockSubjectTemplate] }),
      getEmailConfig: jest.fn().mockResolvedValue({ provider: 'Resend', apiKeyConfigured: true, fromEmail: 'test@example.com', appUrl: 'https://example.com' }),
      updateEmailTemplate: jest.fn().mockResolvedValue({ ...mockHtmlTemplate, isCustom: true, updatedAt: '2026-06-17T08:00:00.000Z' }),
      resetEmailTemplate: jest.fn().mockResolvedValue({ ...mockHtmlTemplate, isCustom: false, updatedAt: null }),
    };
  });

  it('shows loading state before API responds', () => {
    setUp();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading');
  });

  it('renders template type buttons and language buttons after load', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const typeBtn = buttons.find((b) => b.textContent?.includes('Alert Triggered'));
    const enBtn = buttons.find((b) => b.textContent?.trim() === 'English');
    const huBtn = buttons.find((b) => b.textContent?.trim() === 'Hungarian');

    expect(typeBtn).not.toBeUndefined();
    expect(enBtn).not.toBeUndefined();
    expect(huBtn).not.toBeUndefined();
  });

  it('populates textarea with the first template value on load', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['htmlDraft']).toContain('Alert Triggered: {{alertName}}');
  });

  it('shows variable reference panel for the selected template', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('alertName');
    expect(text).toContain('chartTitle');
  });

  it('does not show Custom badge when template is not customized', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const badge = (fixture.nativeElement as HTMLElement).querySelector('.et-custom-badge');
    expect(badge).toBeNull();
    const resetBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Reset'),
    );
    expect(resetBtn).toBeUndefined();
  });

  it('shows Custom badge and Reset button when template is customized', async () => {
    api.getEmailTemplates.mockResolvedValue({
      templates: [{ ...mockHtmlTemplate, isCustom: true, updatedAt: '2026-06-17T08:00:00.000Z' }, mockSubjectTemplate],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Custom');
    const resetBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Reset'),
    );
    expect(resetBtn).not.toBeUndefined();
  });

  it('calls updateEmailTemplate and shows success message on save', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '<p>new template</p>';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await fixture.componentInstance['saveAll']();
    fixture.detectChanges();

    expect(api.updateEmailTemplate).toHaveBeenCalledWith('alert_triggered_en_html', expect.any(String));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('saved successfully');
  });

  it('calls resetEmailTemplate and shows success message on reset', async () => {
    api.getEmailTemplates.mockResolvedValue({
      templates: [{ ...mockHtmlTemplate, isCustom: true }, mockSubjectTemplate],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['resetAll']();
    fixture.detectChanges();

    expect(api.resetEmailTemplate).toHaveBeenCalledWith('alert_triggered_en_html');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('reset to default');
  });
});
