import { Injectable, computed, inject, signal } from '@angular/core';
import { AppConfigService } from './config/app-config.service';
import { PlayerPosition } from './game.model';
import { offsetMeters } from './geo.utils';

/** Odczyt GPS: pozycja [lng, lat], jego dokładność w metrach i chwila odczytu. */
interface Fix {
  lngLat: [number, number];
  accuracyM: number;
  takenAt: number;
}

/**
 * Pozycja użytkownika. `position` to prawdziwy GPS albo, w trybie deweloperskim, pozycja symulowana (do testów bez wychodzenia z domu:
 * przycisk GPS, strzałki/WASD albo parametr adresu `?gps=lat,lng`). Symulacja jest oznaczona `source: 'simulated'`, a serwer przyjmie ją
 * tylko przy `location.allow_simulated: true` (lokalnie, demo): w produkcji narzędzia deweloperskie nie służą do oszukiwania.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly appConfig = inject(AppConfigService);
  private readonly actual = signal<Fix | null>(null);
  private readonly simulated = signal<[number, number] | null>(null);
  private watchId?: number;

  readonly position = computed(() => this.simulated() ?? this.actual()?.lngLat ?? null);
  readonly isSimulated = computed(() => this.simulated() !== null);
  /** Ta sama pozycja z danymi do weryfikacji przez serwer ({lat, lng, accuracyM, takenAt, source}); null, gdy jej nie znamy. */
  readonly latLng = computed<PlayerPosition | null>(() => {
    const simulated = this.simulated();
    if (simulated) return { lat: simulated[1], lng: simulated[0], source: 'simulated' };
    const fix = this.actual();
    return fix ? this.toPosition(fix) : null;
  });

  start(): void {
    this.applyUrlOverride();
    if (this.watchId !== undefined || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.actual.set(this.toFix(pos)),
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

  /**
   * Świeża pozycja do wysłania z akcją. Serwer odrzuca odczyty starsze niż `location.max_age_seconds`, a przeglądarka potrafi długo nie
   * odświeżać pozycji nieruchomego urządzenia, więc przed akcją prosimy o odczyt nie starszy niż `game.gpsMaxAgeSeconds`.
   * Symulacja zwraca się od razu. Bez dostępu do GPS zwraca ostatnią znaną pozycję (albo null).
   */
  fresh(): Promise<PlayerPosition | null> {
    if (this.simulated() || !('geolocation' in navigator)) return Promise.resolve(this.latLng());
    const { gpsMaxAgeSeconds, gpsTimeoutSeconds } = this.appConfig.config.game;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.actual.set(this.toFix(pos));
          resolve(this.latLng());
        },
        () => resolve(this.latLng()),
        { enableHighAccuracy: true, maximumAge: gpsMaxAgeSeconds * 1000, timeout: gpsTimeoutSeconds * 1000 },
      );
    });
  }

  /** Tryb deweloperski: "spacer" symulowaną pozycją o `dn` metrów na północ i `de` na wschód. */
  walk(dn: number, de: number): void {
    const current = this.simulated();
    if (!current) return;
    const next = offsetMeters({ lat: current[1], lng: current[0] }, dn, de);
    this.simulated.set([next.lng, next.lat]);
  }

  /** Tryb deweloperski: ustawia sztuczną pozycję (null wyłącza symulację). */
  simulate(position: [number, number] | null): void {
    this.simulated.set(position);
  }

  /**
   * Tryb deweloperski: parametr adresu `?gps=lat,lng` od razu ustawia symulowaną pozycję (np. w testach ręcznych i automatycznych).
   * Poza trybem deweloperskim (`dev.tools: false`) jest ignorowany.
   */
  private applyUrlOverride(): void {
    if (!this.appConfig.config.dev.tools || this.simulated()) return;
    const parts = (new URLSearchParams(globalThis.location?.search ?? '').get('gps') ?? '').split(',').map((part) => part.trim());
    if (parts.length !== 2 || parts.some((part) => part === '')) return; // `Number('')` to 0, więc puste części odrzucamy wprost
    const [lat, lng] = parts.map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) this.simulated.set([lng, lat]);
  }

  private toFix(pos: GeolocationPosition): Fix {
    return { lngLat: [pos.coords.longitude, pos.coords.latitude], accuracyM: pos.coords.accuracy, takenAt: pos.timestamp };
  }

  private toPosition(fix: Fix): PlayerPosition {
    return { lat: fix.lngLat[1], lng: fix.lngLat[0], accuracyM: fix.accuracyM, takenAt: new Date(fix.takenAt).toISOString(), source: 'gps' };
  }
}
