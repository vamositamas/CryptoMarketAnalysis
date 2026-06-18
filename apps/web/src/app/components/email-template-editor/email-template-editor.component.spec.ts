import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiClient, type EmailTemplate } from '@crypto-market-analysis/data-access/api-client';
import { EmailTemplateEditorComponent } from './email-template-editor.component';

const mockHtmlTemplate: EmailTemplate = {
  key: 'alert_triggered_html',
  label: 'Alert Triggered — HTML Body',
  value: '<h2>Alert Triggered: {{alertName}}</h2>',
  isCustom: false,
  updatedAt: null,
  variables: ['alertName', 'chartTitle'],
};

const mockSubjectTemplate: EmailTemplate = {
  key: 'alert_triggered_subject',
  label: 'Alert Triggered — Subject Line',
  value: 'Alert Triggered: {{alertName}}',
  isCustom: false,
  updatedAt: null,
  variables: ['alertName'],
};

describe('EmailTemplateEditorComponent', () => {
  let fixture: ComponentFixture<EmailTemplateEditorComponent>;
  let api: {
    getEmailTemplates: jest.Mock;
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
      updateEmailTemplate: jest.fn().mockResolvedValue({ ...mockHtmlTemplate, isCustom: true, updatedAt: '2026-06-17T08:00:00.000Z' }),
      resetEmailTemplate: jest.fn().mockResolvedValue({ ...mockHtmlTemplate, isCustom: false, updatedAt: null }),
    };
  });

  it('shows loading state before API responds', () => {
    setUp();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading');
  });

  it('renders template selector with both templates after load', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent?.trim()).toContain('HTML Body');
    expect(options[1].textContent?.trim()).toContain('Subject Line');
  });

  it('populates textarea with the first template value on load', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea');
    expect(textarea?.value).toContain('Alert Triggered: {{alertName}}');
  });

  it('shows variable reference panel for the selected template', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('alertName');
    expect(text).toContain('chartTitle');
  });

  it('shows Default badge when template is not customized', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Default');
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

    await fixture.componentInstance['save']();
    fixture.detectChanges();

    expect(api.updateEmailTemplate).toHaveBeenCalledWith('alert_triggered_html', expect.any(String));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('saved successfully');
  });

  it('calls resetEmailTemplate and shows success message on reset', async () => {
    api.getEmailTemplates.mockResolvedValue({
      templates: [{ ...mockHtmlTemplate, isCustom: true }, mockSubjectTemplate],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['resetToDefault']();
    fixture.detectChanges();

    expect(api.resetEmailTemplate).toHaveBeenCalledWith('alert_triggered_html');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('reset to default');
  });
});
