import { Injectable, inject, signal } from '@angular/core';
import { ModerationApi } from './api/moderation.api';
import { AppConfigService } from './config/app-config.service';
import { ModerationEntry, ModerationVerdict } from './moderation.model';
import { ToastService } from './toast.service';

/**
 * Log moderacji AI dla administratora: lista odrzuceń oraz odznaka "nowe odrzucenia od ostatniej wizyty".
 * Chwila ostatniej wizyty jest pamiętana w przeglądarce (localStorage), więc odznaka jest per urządzenie.
 */
@Injectable({ providedIn: 'root' })
export class ModerationService {
  private readonly api = inject(ModerationApi);
  private readonly toast = inject(ToastService);
  private readonly config = inject(AppConfigService).config;
  private readonly seenKey = `${this.config.auth.storageKeyPrefix}.moderationSeen`;

  readonly entries = signal<ModerationEntry[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  /** Ile odrzuceń pojawiło się od ostatniej wizyty administratora w zakładce "Odrzucenia AI". */
  readonly unseen = signal(0);
  /** Wpisy nowsze od tej chwili były nieprzeczytane w momencie ostatniego otwarcia listy (do oznaczenia "nowe"). */
  readonly seenBeforeOpen = signal<string | null>(null);

  async load(verdicts: ModerationVerdict[]): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.list({ verdicts, pageSize: 100 });
      this.entries.set(page.items);
      this.total.set(page.count);
    } finally {
      this.loading.set(false);
    }
  }

  /** Administrator obejrzał listę: wszystko do tej pory przestaje być "nowe". */
  markSeen(): void {
    this.seenBeforeOpen.set(this.readSeen());
    const newest = this.entries().filter((e) => e.verdict === 'rejected').map((e) => e.createdAt).sort().at(-1);
    this.writeSeen(newest ?? new Date().toISOString());
    this.unseen.set(0);
  }

  /** Pyta o liczbę nowych odrzuceń; gdy przybyło, a to nie pierwsze sprawdzenie, pokazuje komunikat. */
  async refreshUnseen(announce = true): Promise<void> {
    const page = await this.api.list({ verdicts: ['rejected'], since: this.readSeen() ?? undefined, pageSize: 1 });
    const grew = page.count > this.unseen();
    this.unseen.set(page.count);
    if (announce && grew && page.items[0]) this.toast.show(`Moderacja AI odrzuciła zgłoszenie: „${page.items[0].submitted.title}”`, '⚠️');
  }

  /** Sprawdza nowe odrzucenia od razu i potem co `ui.moderationPollSeconds`. Zwraca funkcję zatrzymującą. */
  startPolling(): () => void {
    const check = (announce: boolean) => void this.refreshUnseen(announce).catch(() => undefined);
    check(false);
    const timer = setInterval(() => check(true), this.config.ui.moderationPollSeconds * 1000);
    return () => clearInterval(timer);
  }

  private readSeen(): string | null {
    try {
      return localStorage.getItem(this.seenKey);
    } catch {
      return null;
    }
  }

  private writeSeen(value: string): void {
    try {
      localStorage.setItem(this.seenKey, value);
    } catch {
      /* przeglądarka bez localStorage: odznaka po prostu nie zapamięta wizyty */
    }
  }
}
