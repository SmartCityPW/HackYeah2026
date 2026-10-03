import { Injectable, computed, signal } from '@angular/core';

/**
 * Pozycja użytkownika [lng, lat]. `position` to prawdziwy GPS albo, w trybie deweloperskim,
 * stała pozycja symulowana (do testów bez wychodzenia z domu).
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly actual = signal<[number, number] | null>(null);
  private readonly simulated = signal<[number, number] | null>(null);
  private watchId?: number;

  readonly position = computed(() => this.simulated() ?? this.actual());
  readonly isSimulated = computed(() => this.simulated() !== null);

  start(): void {
    if (this.watchId !== undefined || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.actual.set([pos.coords.longitude, pos.coords.latitude]),
      () => {
        /* brak zgody lub GPS: aplikacja działa dalej na domyślnym widoku */
      },
      { enableHighAccuracy: true },
    );
  }

  stop(): void {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = undefined;
  }

  /** Tryb deweloperski: ustawia sztuczną pozycję (null wyłącza symulację). */
  simulate(position: [number, number] | null): void {
    this.simulated.set(position);
  }
}
