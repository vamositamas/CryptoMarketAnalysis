import { Injectable, signal } from '@angular/core';

export type LegalDoc = 'disclaimer' | 'privacy-policy' | 'terms-of-use';

@Injectable({ providedIn: 'root' })
export class LegalDialogService {
  readonly activeDoc = signal<LegalDoc | null>(null);

  open(doc: LegalDoc): void {
    this.activeDoc.set(doc);
  }

  close(): void {
    this.activeDoc.set(null);
  }
}
