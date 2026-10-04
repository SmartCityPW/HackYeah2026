import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { CatalogService } from '../../core/catalog/catalog.service';
import { AppConfigService } from '../../core/config/app-config.service';
import * as maplibregl from 'maplibre-gl';
import { GameEvent } from '../../core/event.model';
import { Encounter } from '../../core/game.model';
import { circleRing } from '../../core/geo.utils';
import { Bbox, POKESTOP_TYPES, Pokestop, isTrustedType } from '../../core/pokestop.model';
import { CharactersLayer } from './three/characters-layer';

const RANGE_SOURCE = 'interaction-range';
const RIPPLE_SOURCE = 'interaction-ripple';
/** Ile trwa przejście jednej fali od gracza do krawędzi kółka (ms). */
const RIPPLE_MS = 2400;
/** Dwie fale przesunięte o pół okresu, żeby kółko pulsowało bez przerw. */
const RIPPLES = ['interaction-ripple-a', 'interaction-ripple-b'];
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
/** MapLibre liczy zoom dla kafelków 512 px. */
const TILE_SIZE_PX = 512;

/** Kolor z tokenu palety (styles.css), bo warstwy MapLibre wymagają konkretnej wartości, a nie zmiennej CSS. */
const token = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Jedyne miejsce w aplikacji, które zna MapLibre: tworzy mapę, rysuje pinezki i postacie 3D.
 * Dostarczany per komponent mapy (providers), więc ginie razem z nim.
 */
@Injectable()
export class MapController implements OnDestroy {
  private readonly appConfig = inject(AppConfigService).config;
  private readonly config = this.appConfig.map;
  private readonly radiusM = this.appConfig.game.interactionRangeM;
  readonly ready = signal(false);
  /** Środek widoku (tam celuje celownik przy dodawaniu zgłoszenia), aktualizowany przy każdym ruchu mapy. */
  readonly centerPosition = signal<{ lat: number; lng: number } | null>(null);

  private map?: maplibregl.Map;
  private readonly catalog = inject(CatalogService);
  private readonly characters = new CharactersLayer((code) => this.catalog.character(code).modelPath);
  private readonly markers = new Map<number, maplibregl.Marker>();
  private readonly enemyMarkers = new Map<number, maplibregl.Marker>();
  private readonly eventMarkers = new Map<number, maplibregl.Marker>();
  private pulseFrame?: number;
  private userLat?: number;
  /** Widok sprzed trybu walki, przywracany po jej zakończeniu. */
  private beforeBattle?: { zoom: number; pitch: number };

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
    const syncCenter = () => {
      const { lat, lng } = this.map!.getCenter();
      this.centerPosition.set({ lat, lng });
    };
    this.map.on('move', syncCenter);
    this.map.on('load', () => {
      this.map!.addLayer(this.characters);
      syncCenter();
      this.addRangeLayers();
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

  /**
   * Dopasowuje punkty wydarzeń (marker + wirujący rzadki pokemon na podstawie). Marker pokazuje, czy nagrodę można odebrać
   * już teraz (`data-active`), a znaczenie niesie też ikona i obramowanie, nie sam kolor.
   */
  showEvents(events: GameEvent[], onSelect: (id: number) => void): void {
    if (!this.map) return;
    const ids = new Set(events.map((e) => e.id));
    for (const [id, marker] of this.eventMarkers) {
      if (ids.has(id)) continue;
      marker.remove();
      this.eventMarkers.delete(id);
    }
    for (const event of events) {
      const existing = this.eventMarkers.get(event.id);
      if (existing) {
        existing.getElement().dataset['active'] = String(event.activeNow);
        continue;
      }
      const el = document.createElement('button');
      el.className = 'stop-marker event-marker';
      el.dataset['active'] = String(event.activeNow);
      el.innerHTML = '<span>🎪</span>';
      el.setAttribute('aria-label', `Wydarzenie: ${event.title}`);
      el.addEventListener('click', () => onSelect(event.id));
      this.eventMarkers.set(event.id, new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -34] }).setLngLat([event.lng, event.lat]).addTo(this.map));
    }
    void this.characters.setEvents(events);
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

  /** Pozycja gracza: kółko interakcji i model 3D jego Spryciaka-towarzysza (`modelPath`) zamiast kropki. */
  showUser(lngLat: [number, number], modelPath: string | null): void {
    if (!this.map) return;
    const ring = circleRing({ lng: lngLat[0], lat: lngLat[1] }, this.radiusM);
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
    const first = this.userLat === undefined;
    this.userLat = lngLat[1];
    void this.characters.setPlayer(lngLat, modelPath);
    if (first) this.map.jumpTo({ center: lngLat });
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
  markInRange(stopIds: ReadonlySet<number>, encounterIds: ReadonlySet<number>, eventIds: ReadonlySet<number> = new Set()): void {
    for (const [id, marker] of this.markers) marker.getElement().classList.toggle('out-of-range', !stopIds.has(id));
    for (const [id, marker] of this.eventMarkers) marker.getElement().classList.toggle('out-of-range', !eventIds.has(id));
    for (const [id, marker] of this.enemyMarkers) marker.getElement().classList.toggle('out-of-range', !encounterIds.has(id));
  }

  ngOnDestroy(): void {
    if (this.pulseFrame !== undefined) cancelAnimationFrame(this.pulseFrame);
    this.map?.remove();
  }

  /**
   * Kółko interakcji: stała krawędź (wielokąt w metrach, więc przy przybliżaniu i oddalaniu mapy obejmuje zawsze
   * ten sam teren) i fale rozchodzące się od gracza aż do tej krawędzi. Pozycję ustawia `showUser`,
   * dopóki jej nie znamy, kółka nie ma. Kolor to token marki (fiolet).
   */
  private addRangeLayers(): void {
    const map = this.map!;
    const color = token('--color-indigo');
    const empty = { type: 'FeatureCollection' as const, features: [] };
    map.addSource(RANGE_SOURCE, { type: 'geojson', data: empty });
    map.addSource(RIPPLE_SOURCE, { type: 'geojson', data: empty });
    map.addLayer({ id: 'interaction-range-fill', type: 'fill', source: RANGE_SOURCE, paint: { 'fill-color': color, 'fill-opacity': 0.1 } });
    for (const id of RIPPLES) {
      map.addLayer({
        id,
        type: 'circle',
        source: RIPPLE_SOURCE,
        // Fala leży płasko na mapie i skaluje się razem z nią (jak wielokąt krawędzi).
        paint: { 'circle-color': color, 'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'map', 'circle-stroke-color': color },
      });
    }
    map.addLayer({ id: 'interaction-range-line', type: 'line', source: RANGE_SOURCE, paint: { 'line-color': color, 'line-width': 2.5, 'line-opacity': 0.9 } });

    const pulse = (now: number) => {
      if (this.userLat !== undefined) {
        const metersPerPx = (EARTH_CIRCUMFERENCE_M * Math.cos((this.userLat * Math.PI) / 180)) / (TILE_SIZE_PX * 2 ** map.getZoom());
        const edgePx = this.radiusM / metersPerPx;
        RIPPLES.forEach((id, i) => {
          const t = (((now / RIPPLE_MS + i / RIPPLES.length) % 1) + 1) % 1; // 0 przy kropce, 1 na krawędzi
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
    el.dataset['type'] = stop.type;
    el.style.setProperty('--stop-color', meta.color);
    // Zaufane podmioty: zawsze wykrzyknik (bez ikony scenariusza), tak jak model 3D.
    const trusted = isTrustedType(stop.type);
    if (trusted) el.dataset['trusted'] = 'true';
    el.innerHTML = `<span>${trusted ? '!' : (stop.icon ?? meta.emoji)}</span>`;
    el.setAttribute('aria-label', trusted ? `Inicjatywa zaufanego podmiotu: ${stop.title}` : stop.title);
    el.addEventListener('click', () => onSelect(stop.id));
    return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -34] }).setLngLat([stop.lng, stop.lat]).addTo(this.map!);
  }
}
