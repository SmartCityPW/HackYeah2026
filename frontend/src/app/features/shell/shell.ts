import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '../../core/navigation';
import { AppConfigService } from '../../core/config/app-config.service';
import { GeolocationService } from '../../core/geolocation.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { Navbar } from '../../shared/navbar/navbar';

/** Krok "spaceru" symulowanym GPS w metrach (z Shiftem 5x dłuższy). */
const WALK_STEP_M = 10;
const WALK_KEYS: Record<string, [number, number]> = {
  ArrowUp: [1, 0], w: [1, 0],
  ArrowDown: [-1, 0], s: [-1, 0],
  ArrowLeft: [0, -1], a: [0, -1],
  ArrowRight: [0, 1], d: [0, 1],
};

/**
 * Powłoka aplikacji: treść aktualnego widoku (router-outlet) + dolny pasek nawigacji dla roli.
 * Narzędzia deweloperskie: przełącznik ról jest w Profilu/Koncie (AccountPanel), symulowany GPS na mapie.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Navbar],
  host: { '(window:keydown)': 'onKeydown($event)' },
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly session = inject(SessionService);
  private readonly geo = inject(GeolocationService);
  private readonly config = inject(AppConfigService).config;
  protected readonly toast = inject(ToastService);
  protected readonly devTools = this.config.dev.tools;
  protected readonly navItems = computed(() => NAV_ITEMS[this.session.role()]);

  /** Tryb deweloperski: przy symulowanym GPS strzałki i WASD przesuwają gracza po mapie (z Shiftem 5x dalej). */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.devTools) return;
    const dir = WALK_KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    const target = event.target as HTMLElement | null;
    if (!dir || !this.geo.isSimulated() || target?.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    const step = event.shiftKey ? WALK_STEP_M * 5 : WALK_STEP_M;
    this.geo.walk(dir[0] * step, dir[1] * step);
  }

}
