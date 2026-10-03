import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { GameApi } from './api/game.api';
import { CollectionService } from './collection.service';
import { AppConfigService } from './config/app-config.service';
import { AttackResult, Encounter } from './game.model';
import { distanceMeters } from './geo.utils';
import { GeolocationService } from './geolocation.service';
import { PokemonService } from './pokemon.service';
import { ProgressService } from './progress.service';

/** Przeciwnicy w kółku gracza i próby ataku. Generuje ich i rozstrzyga walki wyłącznie backend. */
@Injectable({ providedIn: 'root' })
export class EncounterService {
  private readonly api = inject(GameApi);
  private readonly geo = inject(GeolocationService);
  private readonly progress = inject(ProgressService);
  private readonly pokemons = inject(PokemonService);
  private readonly collection = inject(CollectionService);
  private readonly game = inject(AppConfigService).config.game;
  private lastFetchedAt?: { lat: number; lng: number };

  readonly encounters = signal<Encounter[]>([]);
  readonly attacking = signal(false);
  /** Aktualna pozycja użytkownika w formacie {lat, lng} albo null, gdy jej nie znamy. */
  readonly userPosition = this.geo.latLng;

  constructor() {
    // Przeciwnicy są tam, gdzie gracz: bez pozycji nie ma kogo pokazać.
    effect(() => {
      const position = this.userPosition();
      if (!position) {
        this.lastFetchedAt = undefined;
        this.encounters.set([]);
        return;
      }
      if (!this.lastFetchedAt || distanceMeters(this.lastFetchedAt, position) >= this.game.encounterRefreshMeters) {
        untracked(() => void this.refresh().catch(() => undefined));
      }
    });
    const timer = setInterval(() => void this.refresh().catch(() => undefined), this.game.encounterRefreshSeconds * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async refresh(): Promise<void> {
    const position = this.userPosition();
    if (!position) return;
    this.lastFetchedAt = position;
    const encounters = await this.api.listEncounters(position, this.game.interactionRangeM);
    // Odpowiedź na starą pozycję nie może nadpisać nowszej (gracz zdążył się ruszyć albo wyłączyć GPS).
    if (this.lastFetchedAt === position) this.encounters.set(encounters);
  }

  /**
   * Atakuje przeciwnika wybraną drużyną (1–3 pokemony). Zwraca null, gdy nie znamy pozycji użytkownika
   * albo atak już trwa. Po wygranej przeciwnik znika, a exp pokemonów, XP i kolekcja się aktualizują.
   */
  async attack(id: number, pokemonIds: number[]): Promise<AttackResult | null> {
    const position = this.userPosition();
    if (!position || this.attacking()) return null;
    this.attacking.set(true);
    try {
      const result = await this.api.attack(id, position, pokemonIds);
      if (result.outcome === 'won') {
        this.encounters.update((list) => list.filter((e) => e.id !== id));
        this.progress.update(result.progress);
        await Promise.all([this.pokemons.refresh(), this.collection.refresh()]);
      }
      return result;
    } finally {
      this.attacking.set(false);
    }
  }
}
