import { Injectable, computed, inject, signal } from '@angular/core';
import { GameApi } from './api/game.api';
import { AppConfigService } from './config/app-config.service';
import { AttackResult, Encounter, Position } from './game.model';
import { GeolocationService } from './geolocation.service';
import { ProgressService } from './progress.service';

/** Przeciwnicy na mapie i próby ataku. Wynik walki zawsze rozstrzyga backend. */
@Injectable({ providedIn: 'root' })
export class EncounterService {
  private readonly api = inject(GameApi);
  private readonly geo = inject(GeolocationService);
  private readonly progress = inject(ProgressService);
  private readonly defaultCenter: Position = inject(AppConfigService).config.map.center;

  readonly encounters = signal<Encounter[]>([]);
  readonly attacking = signal(false);
  /** Aktualna pozycja użytkownika w formacie {lat, lng} albo null, gdy jej nie znamy. */
  readonly userPosition = computed<Position | null>(() => {
    const p = this.geo.position();
    return p ? { lat: p[1], lng: p[0] } : null;
  });

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.encounters.set(await this.api.listEncounters(this.userPosition() ?? this.defaultCenter));
  }

  /** Zwraca null, gdy nie znamy pozycji użytkownika (nie ma czego wysłać). */
  async attack(id: number): Promise<AttackResult | null> {
    const position = this.userPosition();
    if (!position || this.attacking()) return null;
    this.attacking.set(true);
    try {
      const result = await this.api.attack(id, position);
      if (result.outcome === 'won') {
        this.encounters.update((list) => list.filter((e) => e.id !== id));
        this.progress.update(result.progress);
      }
      return result;
    } finally {
      this.attacking.set(false);
    }
  }
}
