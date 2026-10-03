import { Injectable, signal } from '@angular/core';

export interface Toast {
  text: string;
  /** Ikonka dopasowana do treści: 🎁 nagroda, ✅ sukces, 🚶 trzeba podejść, ⚠️ przerwanie/błąd. */
  icon: string;
}

/** Krótkie komunikaty (np. nagroda za głos), wyświetlane przez powłokę aplikacji. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<Toast | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, icon = 'ℹ️', durationMs = 3000): void {
    clearTimeout(this.timer);
    this.message.set({ text, icon });
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
