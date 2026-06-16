import { Component, LOCALE_ID, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthSessionService } from './services/auth-session.service';

type Language = 'en' | 'hu';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly locale = inject(LOCALE_ID);
  private readonly authSession = inject(AuthSessionService);
  protected readonly language = normalizeLanguage(this.locale);
  protected readonly currentUser = this.authSession.currentUser;

  protected switchLanguage(event: Event): void {
    const language = (event.target as HTMLSelectElement).value as Language;
    window.location.assign(`/${language}/`);
  }
}

function normalizeLanguage(locale: string): Language {
  return locale.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}
