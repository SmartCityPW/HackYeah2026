import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { AppConfigService } from '../../core/config/app-config.service';
import * as maplibregl from 'maplibre-gl';
import { Encounter } from '../../core/game.model';
import { Bbox, POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { CharactersLayer } from './three/characters-layer';

/**
 * Jedyne miejsce w aplikacji, które zna MapLibre: tworzy mapę, rysuje pinezki i postacie 3D.
 * Dostarczany per komponent mapy (providers), więc ginie razem z nim.
 */
@Injectable()
export class MapController implements OnDestroy {
  private readonly config = inject(AppConfigService).config.map;
  readonly ready = signal(false);

  private map?: maplibregl.Map;
  private readonly characters = new CharactersLayer();
  private readonly markers = new Map<number, maplibregl.Marker>();
  private readonly enemyMarkers = new Map<number, maplibregl.Marker>();
  private userMarker?: maplibregl.Marker;

  init(container: HTMLElement): void {
    // Worker serwujemy jako zasób statyczny (angular.json -> assets), bo bundler nie radzi sobie z workerem MapLibre.
    maplibregl.setWorkerUrl(this.config.workerUrl);
    this.map = new maplibregl.Map({
      container,
      style: this.config.styleUrl,
      center: [this.config.center.lng, this.config.center.lat],
      zoom: this.config.zoom,
      pitch: this.config.pitch,
      bearing: this.config.bearing,
      attributionControl: { compact: true },
    });
    this.map.on('load', () => {
      this.map!.addLayer(this.characters);
      this.ready.set(true);
    });
  }

  /** Dopasowuje pinezki i postacie 3D do listy (dodaje nowe, usuwa brakujące). */
  showStops(stops: Pokestop[], onSelect: (id: number) => void): void {
    if (!this.map) return;
    const ids = new Set(stops.map((s) => s.id));
    for (const [id, marker] of this.markers) {
      if (ids.has(id)) continue;
      marker.remove();
      this.markers.delete(id);
    }
    for (const stop of stops) {
      if (!this.markers.has(stop.id)) this.markers.set(stop.id, this.createMarker(stop, onSelect));
    }
    void this.characters.setStops(stops);
  }

  /** Dopasowuje markery przeciwników do listy (dodaje nowe, usuwa pokonanych i wygasłych). */
  showEncounters(encounters: Encounter[], onSelect: (id: number) => void): void {
    if (!this.map) return;
    const ids = new Set(encounters.map((e) => e.id));
    for (const [id, marker] of this.enemyMarkers) {
      if (ids.has(id)) continue;
      marker.remove();
      this.enemyMarkers.delete(id);
    }
    for (const enc of encounters) {
      if (this.enemyMarkers.has(enc.id)) continue;
      const el = document.createElement('button');
      el.className = 'enemy-marker';
      el.innerHTML = `<span>${enc.emoji}</span>`;
      el.setAttribute('aria-label', `Przeciwnik: ${enc.name}`);
      el.addEventListener('click', () => onSelect(enc.id));
      this.enemyMarkers.set(enc.id, new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([enc.lng, enc.lat]).addTo(this.map));
    }
  }

  showUser(lngLat: [number, number]): void {
    if (!this.map) return;
    if (this.userMarker) {
      this.userMarker.setLngLat(lngLat);
      return;
    }
    const el = document.createElement('div');
    el.className = 'user-marker';
    this.userMarker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(this.map);
    this.map.jumpTo({ center: lngLat });
  }

  focus(lat: number, lng: number): void {
    this.map?.easeTo({ center: [lng, lat], duration: 600 });
  }

  /** Widoczny obszar mapy; po nim dociągamy pinezki z backendu (?bbox=). */
  bounds(): Bbox | null {
    const b = this.map?.getBounds();
    return b ? { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() } : null;
  }

  /** Wywołuje funkcję po każdym zakończonym ruchu lub przybliżeniu mapy. */
  onMoveEnd(callback: () => void): void {
    this.map?.on('moveend', callback);
  }

  /** Środek widoku, czyli miejsce wskazywane celownikiem przy dodawaniu zgłoszenia. */
  center(): { lat: number; lng: number } | null {
    return this.map?.getCenter() ?? null;
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private createMarker(stop: Pokestop, onSelect: (id: number) => void): maplibregl.Marker {
    const meta = POKESTOP_TYPES[stop.type];
    const el = document.createElement('button');
    el.className = 'stop-marker';
    el.style.setProperty('--stop-color', meta.color);
    el.innerHTML = `<span>${stop.icon ?? meta.emoji}</span>`;
    el.setAttribute('aria-label', stop.title);
    el.addEventListener('click', () => onSelect(stop.id));
    return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -34] }).setLngLat([stop.lng, stop.lat]).addTo(this.map!);
  }
}
