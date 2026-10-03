import { Component, ElementRef, OnDestroy, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { PokestopService } from '../../core/pokestop.service';

// Worker serwujemy jako zasób statyczny (angular.json -> assets), bo bundler nie radzi sobie z workerem MapLibre.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const KRAKOW: [number, number] = [19.9373, 50.0617];

@Component({
  selector: 'app-map-page',
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage implements OnDestroy {
  private readonly service = inject(PokestopService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  private map?: maplibregl.Map;
  private markers = new Map<number, maplibregl.Marker>();
  private watchId?: number;
  private userMarker?: maplibregl.Marker;
  private readonly mapReady = signal(false);

  protected readonly types = POKESTOP_TYPES;
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.service.stops().find((s) => s.id === this.selectedId()) ?? null);
  protected readonly reward = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const stops = this.service.stops();
      if (this.mapReady()) this.syncMarkers(stops);
    });
  }

  protected vote(stop: Pokestop, vote: 'for' | 'against'): void {
    this.service.vote(stop.id, vote);
    this.reward.set('Dziękujemy za głos! +1 punkt odkrywcy');
    setTimeout(() => this.reward.set(null), 2500);
  }

  protected close(): void {
    this.selectedId.set(null);
  }

  ngOnDestroy(): void {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId);
    this.map?.remove();
  }

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.container().nativeElement,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: KRAKOW,
      zoom: 15.5,
      pitch: 55,
      bearing: -15,
      attributionControl: { compact: true },
    });
    this.map.on('load', () => this.mapReady.set(true));
    this.startGeolocation();
  }

  private syncMarkers(stops: Pokestop[]): void {
    for (const stop of stops) {
      if (this.markers.has(stop.id)) continue;
      const meta = POKESTOP_TYPES[stop.type];
      const el = document.createElement('button');
      el.className = 'stop-marker';
      el.style.setProperty('--stop-color', meta.color);
      el.innerHTML = `<span>${meta.emoji}</span>`;
      el.setAttribute('aria-label', stop.title);
      el.addEventListener('click', () => {
        this.selectedId.set(stop.id);
        this.map?.easeTo({ center: [stop.lng, stop.lat], duration: 600 });
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([stop.lng, stop.lat]).addTo(this.map!);
      this.markers.set(stop.id, marker);
    }
  }

  private startGeolocation(): void {
    if (!('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        if (!this.userMarker) {
          const el = document.createElement('div');
          el.className = 'user-marker';
          this.userMarker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(this.map!);
          this.map!.jumpTo({ center: lngLat });
        } else {
          this.userMarker.setLngLat(lngLat);
        }
      },
      () => {
        /* brak zgody lub brak GPS: zostajemy na domyślnym widoku (Kraków) */
      },
      { enableHighAccuracy: true },
    );
  }
}
