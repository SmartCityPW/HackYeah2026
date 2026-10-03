import { Injectable, signal } from '@angular/core';

/** Krótkie komunikaty (np. nagroda za głos), wyświetlane przez powłokę aplikacji. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, durationMs = 3000): void {
    clearTimeout(this.timer);
    this.message.set(text);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
