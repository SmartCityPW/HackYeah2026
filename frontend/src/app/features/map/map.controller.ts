import { Injectable, OnDestroy, signal } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { Encounter, INTERACTION_RADIUS_M } from '../../core/game.model';
import { circleRing } from '../../core/geo.utils';
import { POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { CharactersLayer } from './three/characters-layer';

// Worker serwujemy jako zasób statyczny (angular.json -> assets), bo bundler nie radzi sobie z workerem MapLibre.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const KRAKOW: [number, number] = [19.9373, 50.0617];
const RANGE_SOURCE = 'interaction-range';
const RIPPLE_SOURCE = 'interaction-ripple';
const RANGE_COLOR = '#38bdf8';
/** Ile trwa przejście jednej fali od gracza do krawędzi kółka (ms). */
const RIPPLE_MS = 2400;
/** Dwie fale przesunięte o pół okresu, żeby kółko pulsowało bez przerw. */
const RIPPLES = ['interaction-ripple-a', 'interaction-ripple-b'];
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** MapLibre liczy zoom dla kafelków 512 px. */
const TILE_SIZE_PX = 512;

/**
 * Jedyne miejsce w aplikacji, które zna MapLibre: tworzy mapę, rysuje pinezki i postacie 3D.
 * Dostarczany per komponent mapy (providers), więc ginie razem z nim.
 */
@Injectable()
export class MapController implements OnDestroy {
  readonly ready = signal(false);
  /** Środek widoku (tam celuje celownik przy dodawaniu zgłoszenia), aktualizowany przy każdym ruchu mapy. */
  readonly centerPosition = signal<{ lat: number; lng: number } | null>(null);

  private map?: maplibregl.Map;
  private readonly characters = new CharactersLayer();
  private readonly markers = new Map<number, maplibregl.Marker>();
  private readonly enemyMarkers = new Map<number, maplibregl.Marker>();
  private userMarker?: maplibregl.Marker;
  private pulseFrame?: number;
  private userLat?: number;
  /** Widok sprzed trybu walki, przywracany po jej zakończeniu. */
  private beforeBattle?: { zoom: number; pitch: number };

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
    const syncCenter = () => {
      const { lat, lng } = this.map!.getCenter();
      this.centerPosition.set({ lat, lng });
    };
    this.map.on('move', syncCenter);
    this.map.on('load', () => {
      syncCenter();
      this.addRangeLayers();
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
    const ring = circleRing({ lng: lngLat[0], lat: lngLat[1] }, INTERACTION_RADIUS_M);
    (this.map.getSource(RANGE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
    (this.map.getSource(RIPPLE_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: lngLat },
    });
    this.userLat = lngLat[1];
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

  /** Tryb walki: kamera najeżdża nisko na przeciwnika. */
  enterBattle(lat: number, lng: number): void {
    if (!this.map) return;
    this.beforeBattle ??= { zoom: this.map.getZoom(), pitch: this.map.getPitch() };
    this.map.easeTo({ center: [lng, lat], zoom: 18.6, pitch: 65, duration: 900 });
  }

  exitBattle(): void {
    if (!this.map || !this.beforeBattle) return;
    this.map.easeTo({ ...this.beforeBattle, duration: 700 });
    this.beforeBattle = undefined;
  }

  /** Przygasza pinezki i przeciwników spoza kółka interakcji (z nimi nie da się nic zrobić, trzeba podejść). */
  markInRange(stopIds: ReadonlySet<number>, encounterIds: ReadonlySet<number>): void {
    for (const [id, marker] of this.markers) marker.getElement().classList.toggle('out-of-range', !stopIds.has(id));
    for (const [id, marker] of this.enemyMarkers) marker.getElement().classList.toggle('out-of-range', !encounterIds.has(id));
  }

  ngOnDestroy(): void {
    if (this.pulseFrame !== undefined) cancelAnimationFrame(this.pulseFrame);
    this.map?.remove();
  }

  /**
   * Kółko interakcji: stała krawędź 50 m (wielokąt w metrach, więc przy przybliżaniu i oddalaniu mapy obejmuje
   * zawsze ten sam teren) i fale rozchodzące się od gracza aż do tej krawędzi. Pozycję ustawia `showUser`,
   * dopóki jej nie znamy, kółka nie ma.
   */
  private addRangeLayers(): void {
    const map = this.map!;
    const empty = { type: 'FeatureCollection' as const, features: [] };
    map.addSource(RANGE_SOURCE, { type: 'geojson', data: empty });
    map.addSource(RIPPLE_SOURCE, { type: 'geojson', data: empty });
    map.addLayer({ id: 'interaction-range-fill', type: 'fill', source: RANGE_SOURCE, paint: { 'fill-color': RANGE_COLOR, 'fill-opacity': 0.1 } });
    for (const id of RIPPLES) {
      map.addLayer({
        id,
        type: 'circle',
        source: RIPPLE_SOURCE,
        // Fala leży płasko na mapie i skaluje się razem z nią (jak wielokąt krawędzi).
        paint: { 'circle-color': RANGE_COLOR, 'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'map', 'circle-stroke-color': RANGE_COLOR },
      });
    }
    map.addLayer({ id: 'interaction-range-line', type: 'line', source: RANGE_SOURCE, paint: { 'line-color': RANGE_COLOR, 'line-width': 2.5, 'line-opacity': 0.9 } });

    const pulse = (now: number) => {
      if (this.userLat !== undefined) {
        const metersPerPx = (EARTH_CIRCUMFERENCE_M * Math.cos((this.userLat * Math.PI) / 180)) / (TILE_SIZE_PX * 2 ** map.getZoom());
        const edgePx = INTERACTION_RADIUS_M / metersPerPx;
        RIPPLES.forEach((id, i) => {
          const t = ((now / RIPPLE_MS + i / RIPPLES.length) % 1 + 1) % 1; // 0 przy kropce, 1 na krawędzi
          const fade = 1 - t;
          map.setPaintProperty(id, 'circle-radius', edgePx * t);
          map.setPaintProperty(id, 'circle-opacity', 0.28 * fade);
          map.setPaintProperty(id, 'circle-stroke-width', 2.5);
          map.setPaintProperty(id, 'circle-stroke-opacity', 0.9 * fade);
        });
      }
      this.pulseFrame = requestAnimationFrame(pulse);
    };
    this.pulseFrame = requestAnimationFrame(pulse);
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
