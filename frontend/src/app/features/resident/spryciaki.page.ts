import { Component, computed, inject, signal } from '@angular/core';
import { CollectionService } from '../../core/collection.service';
import { MAX_BATTLE_TEAM, TYPES } from '../../core/game.model';
import { PokemonService } from '../../core/pokemon.service';
import { CHARACTERS, CHARACTER_IDS } from '../../core/pokestop.model';
import { ProgressService } from '../../core/progress.service';

type Filter = 'all' | 'ready' | 'staked';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'ready', label: '⚔️ Gotowe do walki' },
  { id: 'staked', label: '📌 Na zgłoszeniach' },
];

/** "Moje Spryciaki": posiadane egzemplarze (poziom, moc, typ, exp) i atlas odkrytych gatunków. */
@Component({
  selector: 'app-spryciaki-page',
  templateUrl: './spryciaki.page.html',
  styleUrl: './spryciaki.page.css',
})
export class SpryciakiPage {
  private readonly pokemonService = inject(PokemonService);
  protected readonly collection = inject(CollectionService);
  protected readonly progress = inject(ProgressService).progress;
  protected readonly characters = CHARACTERS;
  protected readonly species = CHARACTER_IDS.map((id) => ({ id, ...CHARACTERS[id] }));
  protected readonly types = TYPES;
  protected readonly filters = FILTERS;
  protected readonly maxTeam = MAX_BATTLE_TEAM;

  protected readonly filter = signal<Filter>('all');
  /** Najsilniejsze najpierw. */
  protected readonly owned = computed(() => [...this.pokemonService.pokemons()].sort((a, b) => b.power - a.power || b.exp - a.exp));
  protected readonly ready = this.pokemonService.available;
  protected readonly shown = computed(() => {
    const f = this.filter();
    return this.owned().filter((p) => f === 'all' || (f === 'ready' ? !p.isStaked : p.isStaked));
  });
  protected readonly strongest = computed(() => this.owned()[0] ?? null);
  /** Moc najlepszej możliwej drużyny do walki (bez mnożnika typu). */
  protected readonly bestTeamPower = computed(() =>
    this.ready()
      .slice(0, MAX_BATTLE_TEAM)
      .reduce((sum, p) => sum + p.power, 0),
  );

  constructor() {
    // Exp i nowe Spryciaki mogły dojść w walce, więc przy wejściu odświeżamy stan z serwera.
    void this.pokemonService.refresh();
  }
}
