import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthSessionService } from './services/auth-session.service';
import { DonateModalComponent } from './components/donate-modal/donate-modal.component';
import { LanguageService } from './services/language.service';

@Component({
  imports: [RouterModule, DonateModalComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly langService = inject(LanguageService);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);

  protected readonly language = this.langService.current;
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly showDonateModal = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isAuthPage = computed(() => {
    const url = this.currentUrl() ?? '';
    return url.startsWith('/login') || url.startsWith('/register') || url.startsWith('/reset-password') || url.startsWith('/forgot-password');
  });

  protected userInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';
    if (user.fullName) {
      return user.fullName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase();
    }
    return user.email[0].toUpperCase();
  }

  protected switchLanguage(locale: 'en' | 'hu'): void {
    this.langService.switchTo(locale);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  protected logout(): void {
    this.authSession.clearCurrentUser();
    void this.router.navigateByUrl('/login');
  }

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

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.userMenuOpen() &&
      !(this.elRef.nativeElement as HTMLElement)
        .querySelector('.user-avatar-wrap')
        ?.contains(event.target as Node)
    ) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.mobileMenuOpen.set(false);
    this.userMenuOpen.set(false);
  }
}
