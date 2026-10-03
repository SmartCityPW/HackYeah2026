import { Injectable, computed, inject, signal } from '@angular/core';
import { GameApi } from './api/game.api';
import { Pokemon } from './game.model';

/** Posiadane pokemony (egzemplarze z poziomem i mocą). Poziom i moc wylicza serwer z exp. */
@Injectable({ providedIn: 'root' })
export class PokemonService {
  private readonly api = inject(GameApi);

  readonly pokemons = signal<Pokemon[]>([]);
  /** Gotowe do walki: niezastawione na zgłoszeniach, najsilniejsze najpierw. */
  readonly available = computed(() => this.pokemons().filter((p) => !p.isStaked).sort((a, b) => b.power - a.power));

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.pokemons.set(await this.api.listPokemons());
  }
}
