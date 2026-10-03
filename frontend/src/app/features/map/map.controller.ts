import { Injectable, OnDestroy, signal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { CharactersLayer } from './three/characters-layer';

// Worker serwujemy jako zasób statyczny (angular.json -> assets), bo bundler nie radzi sobie z workerem MapLibre.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const KRAKOW: [number, number] = [19.9373, 50.0617];

/**
 * Jedyne miejsce w aplikacji, które zna MapLibre: tworzy mapę, rysuje pinezki i postacie 3D.
 * Dostarczany per komponent mapy (providers), więc ginie razem z nim.
 */
@Injectable()
export class MapController implements OnDestroy {
  readonly ready = signal(false);

  private map?: maplibregl.Map;
  private readonly characters = new CharactersLayer();
  private readonly markers = new Map<number, maplibregl.Marker>();
  private userMarker?: maplibregl.Marker;

  init(container: HTMLElement): void {
    this.map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: KRAKOW,
      zoom: 16.3,
      pitch: 55,
      bearing: -15,
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
