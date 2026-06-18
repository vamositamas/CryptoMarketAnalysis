import { Component, LOCALE_ID, inject, signal, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthSessionService } from './services/auth-session.service';
import { DonateModalComponent } from './components/donate-modal/donate-modal.component';

type Language = 'en' | 'hu';

@Component({
  imports: [RouterModule, DonateModalComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly locale = inject(LOCALE_ID);
  private readonly authSession = inject(AuthSessionService);
  protected readonly language = normalizeLanguage(this.locale);
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly showDonateModal = signal(false);
  protected readonly mobileMenuOpen = signal(false);

  protected openDonateModal(): void {
    this.showDonateModal.set(true);
    this.mobileMenuOpen.set(false);
  }

  protected closeDonateModal(): void {
    this.showDonateModal.set(false);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected switchLanguage(event: Event): void {
    const language = (event.target as HTMLSelectElement).value as Language;
    window.location.assign(`/${language}/`);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.mobileMenuOpen.set(false);
  }
}

function normalizeLanguage(locale: string): Language {
  return locale.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}
