import { Injectable, inject, signal } from '@angular/core';
import { AppConfigService } from './config/app-config.service';

/** Krótkie komunikaty (np. nagroda za głos), wyświetlane przez powłokę aplikacji. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly defaultMs = inject(AppConfigService).config.ui.toastMs;
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, durationMs = this.defaultMs): void {
    clearTimeout(this.timer);
    this.message.set(text);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
