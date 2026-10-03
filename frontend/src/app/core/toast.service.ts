import { Injectable, inject, signal } from '@angular/core';
import { AppConfigService } from './config/app-config.service';

export interface Toast {
  text: string;
  /** Ikona dopasowana do treści: 🎁 nagroda, 🚶 trzeba podejść, ⚠️ przerwanie lub błąd. Znaczenie niesie ikona, nie kolor. */
  icon: string;
}

/** Krótkie komunikaty (np. nagroda za głos), wyświetlane przez powłokę aplikacji. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly defaultMs = inject(AppConfigService).config.ui.toastMs;
  readonly message = signal<Toast | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, icon = 'ℹ️', durationMs = this.defaultMs): void {
    clearTimeout(this.timer);
    this.message.set({ text, icon });
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
