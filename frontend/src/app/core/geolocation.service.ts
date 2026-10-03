import { Injectable, signal } from '@angular/core';

/** Pozycja użytkownika z GPS-a ([lng, lat]); null, gdy brak zgody albo urządzenie jej nie podaje. */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly position = signal<[number, number] | null>(null);
  private watchId?: number;

  start(): void {
    if (this.watchId !== undefined || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.position.set([pos.coords.longitude, pos.coords.latitude]),
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
}
