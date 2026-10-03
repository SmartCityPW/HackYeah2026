import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { GameApi } from './api/game.api';
import { AttackResult, Encounter, INTERACTION_RADIUS_M, Position } from './game.model';
import { distanceMeters } from './geo.utils';
import { GeolocationService } from './geolocation.service';
import { CollectionService } from './collection.service';
import { PokemonService } from './pokemon.service';
import { ProgressService } from './progress.service';

/** Po tylu metrach ruchu pytamy serwer o przeciwników na nowo (żeby nie pytać przy każdym odczycie GPS). */
const REFRESH_AFTER_M = 10;
/** Odświeżanie także na postoju: przeciwnicy wygasają, a serwer może wygenerować nowych. */
const REFRESH_EVERY_MS = 30_000;

/** Przeciwnicy w kółku gracza i próby ataku. Generuje ich i rozstrzyga walki wyłącznie backend. */
@Injectable({ providedIn: 'root' })
export class EncounterService {
  private readonly api = inject(GameApi);
  private readonly geo = inject(GeolocationService);
  private readonly progress = inject(ProgressService);
  private readonly pokemons = inject(PokemonService);
  private readonly collection = inject(CollectionService);
  private lastFetchedAt?: Position;

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
      if (!this.lastFetchedAt || distanceMeters(this.lastFetchedAt, position) >= REFRESH_AFTER_M) untracked(() => void this.refresh());
    });
    const timer = setInterval(() => void this.refresh(), REFRESH_EVERY_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async refresh(): Promise<void> {
    const position = this.userPosition();
    if (!position) return;
    this.lastFetchedAt = position;
    const encounters = await this.api.listEncounters(position, INTERACTION_RADIUS_M);
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
        if (result.awardedCharacter) this.collection.grant(result.awardedCharacter);
        await this.pokemons.refresh();
      }
      return result;
    } finally {
      this.attacking.set(false);
    }
  }
}
