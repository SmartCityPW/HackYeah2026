import { Injectable, computed, inject, signal } from '@angular/core';
import { PokestopApi } from './api/pokestop.api';
import { Pokemon } from './pokemon.model';

/** Pokemony użytkownika (egzemplarze z poziomem i exp) oraz wybór pokemona do głosu i zastawu. */
@Injectable({ providedIn: 'root' })
export class PokemonService {
  private readonly api = inject(PokestopApi);

  readonly pokemons = signal<Pokemon[]>([]);
  readonly loaded = signal(false);
  /** Niezastawione na zgłoszeniach: tylko te można zostawić na nowym zgłoszeniu. */
  readonly available = computed(() => this.pokemons().filter((p) => !p.isStaked));

  private readonly chosenId = signal<number | null>(null);
  /** Pokemon, który dostanie exp za głos (ostatnio wybrany, a gdy go nie ma, pierwszy z listy). */
  readonly chosen = computed(() => this.pokemons().find((p) => p.id === this.chosenId()) ?? this.pokemons()[0] ?? null);

  async refresh(): Promise<void> {
    this.pokemons.set(await this.api.listPokemons());
    this.loaded.set(true);
  }

  choose(id: number): void {
    this.chosenId.set(id);
  }

  /** Podmienia pokemona po zmianie (np. exp z głosu), nie czekając na ponowne pobranie listy. */
  replace(updated: Pokemon): void {
    this.pokemons.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  }
}
