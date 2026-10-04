import { Injectable, computed, inject, signal } from '@angular/core';
import { EventApi } from './api/event.api';
import { CheckInResult, GameEvent, NewEvent } from './event.model';
import { PlayerPosition } from './game.model';
import { PokemonService } from './pokemon.service';
import { Bbox } from './pokestop.model';
import { ProgressService } from './progress.service';

/**
 * Wydarzenia "cool thing" zaufanych podmiotów, pobierane obszarami mapy (jak pinezki). Stan `activeNow`, `phase` i
 * `nextWindowStart` pochodzi z serwera i starzeje się z czasem, więc mapa odświeża go okresowo (`refresh`).
 */
@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = inject(EventApi);
  private readonly pokemons = inject(PokemonService);
  private readonly progress = inject(ProgressService);

  readonly events = signal<GameEvent[]>([]);
  /** Na mapie: tylko to, co jeszcze trwa albo dopiero się zacznie (zakończone i odwołane znikają). */
  readonly visibleEvents = computed(() => this.events().filter((e) => e.phase === 'upcoming' || e.phase === 'ongoing'));
  private lastArea?: Bbox;

  /** Dociąga wydarzenia z widocznego obszaru mapy (okno domyślne: najbliższe dni). */
  async loadArea(area: Bbox): Promise<void> {
    this.lastArea = area;
    this.merge(await this.api.list(area));
  }

  /** Odświeża ostatnio pobrany obszar (stan "można odebrać" zmienia się z upływem czasu, a ktoś inny mógł zająć miejsce). */
  async refresh(): Promise<void> {
    if (this.lastArea) await this.loadArea(this.lastArea);
  }

  /** Wydarzenia organizacji do zarządzania (z odwołanymi, w szerokim oknie czasu). */
  async loadOwn(organizationId: number | undefined, windowDays: number): Promise<void> {
    const day = 24 * 3_600_000;
    this.merge(await this.api.list(undefined, {
      organizationId, managed: true, from: new Date(Date.now() - windowDays * day).toISOString(), to: new Date(Date.now() + windowDays * day).toISOString(),
    }));
  }

  async open(id: number): Promise<GameEvent | null> {
    const known = this.events().find((e) => e.id === id);
    if (known) return known;
    try {
      const event = await this.api.get(id);
      this.merge([event]);
      return event;
    } catch {
      return null;
    }
  }

  async create(draft: NewEvent): Promise<GameEvent> {
    const event = await this.api.create(draft);
    this.merge([event]);
    return event;
  }

  async cancel(id: number): Promise<void> {
    this.merge([await this.api.cancel(id)]);
  }

  /** Zwraca nowego pokemona (nagrodę). Błędy (za daleko, poza czasem, już odebrane, limit) przechodzą do wywołującego. */
  async checkIn(id: number, position: PlayerPosition): Promise<CheckInResult> {
    const result = await this.api.checkIn(id, position);
    this.merge([result.event]);
    void this.pokemons.refresh();
    void this.progress.refresh();
    return result;
  }

  private merge(incoming: GameEvent[]): void {
    this.events.update((current) => {
      const byId = new Map(current.map((e) => [e.id, e]));
      for (const event of incoming) byId.set(event.id, event);
      return [...byId.values()];
    });
  }
}
