import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AuthSessionService } from './services/auth-session.service';
import { DonateModalComponent } from './components/donate-modal/donate-modal.component';
import { LanguageService } from './services/language.service';
import { LegalDialogService, LegalDoc } from './services/legal-dialog.service';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';

@Component({
  imports: [RouterModule, DonateModalComponent, FormsModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly langService = inject(LanguageService);
  private readonly authSession = inject(AuthSessionService);
  private readonly api = inject(AuthApiClient);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);
  protected readonly legalDialog = inject(LegalDialogService);

  protected readonly language = this.langService.current;
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly showDonateModal = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly profileModalOpen = signal(false);
  protected readonly profileSaving = signal(false);
  protected readonly profileMessage = signal('');
  protected readonly profileSuccess = signal(false);
  protected readonly profileLang = signal<'en' | 'hu'>('en');
  protected profileName = '';

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

  protected async switchLanguage(locale: 'en' | 'hu'): Promise<void> {
    const user = this.currentUser();
    if (user) {
      try {
        const updated = await this.api.updateCurrentUserProfile({
          fullName: user.fullName,
          languagePreference: locale,
        });
        this.authSession.updateCurrentUser({
          fullName: updated.fullName ?? undefined,
          languagePreference: updated.languagePreference,
          onboardingCompleted: updated.onboardingCompleted,
        });
      } catch {
        this.authSession.updateCurrentUser({ languagePreference: locale });
      }
    }
    this.langService.switchTo(locale);
  }

  protected openProfileModal(): void {
    const user = this.currentUser();
    this.profileName = user?.fullName ?? '';
    this.profileLang.set(user?.languagePreference ?? this.langService.current());
    this.profileMessage.set('');
    this.profileSuccess.set(false);
    this.userMenuOpen.set(false);
    this.profileModalOpen.set(true);
  }

  protected closeProfileModal(): void {
    this.profileModalOpen.set(false);
  }

  protected async saveProfile(): Promise<void> {
    if (this.profileSaving()) return;
    this.profileSaving.set(true);
    this.profileMessage.set('');
    this.profileSuccess.set(false);
    try {
      const updated = await this.api.updateCurrentUserProfile({
        fullName: this.profileName || undefined,
        languagePreference: this.profileLang(),
      });
      this.authSession.updateCurrentUser({
        fullName: updated.fullName ?? undefined,
        languagePreference: updated.languagePreference,
        onboardingCompleted: updated.onboardingCompleted,
      });
      this.profileSuccess.set(true);
      this.profileMessage.set($localize`:Profile saved@@profile.saved:Profile updated successfully.`);
      this.langService.switchTo(this.profileLang());
    } catch {
      this.profileMessage.set($localize`:Profile save failed@@profile.saveFailed:Could not save profile. Please try again.`);
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected openLegal(doc: LegalDoc): void {
    this.userMenuOpen.set(false);
    this.legalDialog.open(doc);
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
    this.legalDialog.close();
  }
}
