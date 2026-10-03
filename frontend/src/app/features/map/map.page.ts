import { Component, ElementRef, OnDestroy, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { CHARACTERS, CHARACTER_IDS, CharacterId, POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { PokestopService } from '../../core/pokestop.service';
import { findScenario } from '../../core/scenario.catalog';
import { describeDetails } from '../../core/scenario.utils';
import { SessionService } from '../../core/session.service';
import { ReportDraft, ReportPanel } from './report-panel/report-panel';
import { CharactersLayer } from './three/characters-layer';

// Worker serwujemy jako zasób statyczny (angular.json -> assets), bo bundler nie radzi sobie z workerem MapLibre.
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const KRAKOW: [number, number] = [19.9373, 50.0617];

@Component({
  selector: 'app-map-page',
  imports: [ReportPanel],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage implements OnDestroy {
  private readonly service = inject(PokestopService);
  protected readonly session = inject(SessionService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  private map?: maplibregl.Map;
  private markers = new Map<number, maplibregl.Marker>();
  private watchId?: number;
  private userMarker?: maplibregl.Marker;
  private readonly mapReady = signal(false);
  private readonly characters = new CharactersLayer();

  protected readonly types = POKESTOP_TYPES;
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.service.stops().find((s) => s.id === this.selectedId()) ?? null);
  protected readonly reward = signal<string | null>(null);

  protected readonly characterMeta = CHARACTERS;
  protected readonly characterIds = CHARACTER_IDS;
  protected readonly collection = this.service.collection;
  protected readonly panel = signal<'none' | 'report' | 'collection'>('none');
  protected readonly selectedDetails = computed(() => {
    const stop = this.selected();
    const scenario = findScenario(stop?.scenarioId);
    return stop?.details && scenario ? describeDetails(scenario, stop.details) : [];
  });

  constructor() {
    afterNextRender(() => this.initMap());

    effect(() => {
      const stops = this.service.stops();
      if (this.mapReady()) {
        this.syncMarkers(stops);
        void this.characters.setStops(stops);
      }
    });
  }

  protected vote(stop: Pokestop, vote: 'for' | 'against'): void {
    const won = this.service.vote(stop.id, vote);
    if (won) this.showReward(`Dziękujemy za głos! Zdobywasz: ${CHARACTERS[won].emoji} ${CHARACTERS[won].label}`);
  }

  protected openPanel(panel: 'report' | 'collection'): void {
    this.selectedId.set(null);
    this.panel.set(this.panel() === panel ? 'none' : panel);
  }

  protected onReportDrafted(draft: ReportDraft): void {
    if (!this.map) return;
    const center = this.map.getCenter();
    const stop = this.service.addReport({ ...draft, lat: center.lat, lng: center.lng });
    this.panel.set('none');
    this.selectedId.set(stop.id);
    this.showReward(
      draft.type === 'ngo'
        ? 'Inicjatywa opublikowana! Mieszkańcy mogą teraz głosować.'
        : 'Zgłoszenie dodane! Gdy inni je potwierdzą, dostaniesz postać.',
    );
  }

  protected toggleRole(): void {
    this.session.toggleRole();
    this.panel.set('none');
    this.selectedId.set(null);
  }

  private showReward(text: string): void {
    this.reward.set(text);
    setTimeout(() => this.reward.set(null), 3000);
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
      zoom: 16.3,
      pitch: 55,
      bearing: -15,
      attributionControl: { compact: true },
    });
    this.map.on('load', () => {
      this.map!.addLayer(this.characters);
      this.mapReady.set(true);
    });
    this.startGeolocation();
  }

  private syncMarkers(stops: Pokestop[]): void {
    for (const stop of stops) {
      if (this.markers.has(stop.id)) continue;
      const meta = POKESTOP_TYPES[stop.type];
      const el = document.createElement('button');
      el.className = 'stop-marker';
      el.style.setProperty('--stop-color', meta.color);
      el.innerHTML = `<span>${stop.icon ?? meta.emoji}</span>`;
      el.setAttribute('aria-label', stop.title);
      el.addEventListener('click', () => {
        this.selectedId.set(stop.id);
        this.map?.easeTo({ center: [stop.lng, stop.lat], duration: 600 });
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -34] }).setLngLat([stop.lng, stop.lat]).addTo(this.map!);
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
