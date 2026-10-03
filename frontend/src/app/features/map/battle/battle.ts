import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { teamPower } from '../../../core/battle.utils';
import { EncounterService } from '../../../core/encounter.service';
import { ACTION_DWELL_S, AttackResult, Encounter, MAX_BATTLE_TEAM, TYPES } from '../../../core/game.model';
import { PokemonService } from '../../../core/pokemon.service';
import { CHARACTERS } from '../../../core/pokestop.model';

/** Kroki walki: akcja na miejscu -> wybór drużyny -> starcie -> wynik. */
export type BattlePhase = 'action' | 'team' | 'fighting' | 'result';

/** Starcie trwa co najmniej tyle, żeby animacja zdążyła się odegrać (wynik i tak przychodzi z serwera). */
const CLASH_MS = 1600;

/**
 * Tryb walki z przeciwnikiem. Wynik rozstrzyga serwer: komponent prowadzi gracza przez kroki,
 * pokazuje podgląd mocy drużyny i odgrywa starcie. Wyjście z kółka przed starciem przerywa walkę.
 */
@Component({
  selector: 'app-battle',
  templateUrl: './battle.html',
  styleUrl: './battle.css',
})
export class Battle {
  private readonly encounters = inject(EncounterService);
  private readonly pokemonService = inject(PokemonService);

  readonly encounter = input.required<Encounter>();
  /** Czy gracz stoi w kółku interakcji przy przeciwniku. */
  readonly inRange = input.required<boolean>();
  /** Koniec walki (ucieczka albo powrót na mapę po wyniku). */
  readonly closed = output<void>();
  /** Gracz wyszedł z kółka przed starciem. */
  readonly interrupted = output<void>();
  /** Serwer odrzucił atak (za daleko, przeciwnik zniknął); komunikat dla gracza. */
  readonly failed = output<string>();

  protected readonly types = TYPES;
  protected readonly characters = CHARACTERS;
  protected readonly maxTeam = MAX_BATTLE_TEAM;
  protected readonly dwellTotal = ACTION_DWELL_S;

  protected readonly phase = signal<BattlePhase>('action');
  protected readonly dwellLeft = signal(ACTION_DWELL_S);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly result = signal<Exclude<AttackResult, { outcome: 'too_far' }> | null>(null);

  protected readonly available = this.pokemonService.available;
  protected readonly team = computed(() => this.available().filter((p) => this.selectedIds().includes(p.id)));
  protected readonly preview = computed(() => teamPower(this.team(), this.encounter()));
  /** Szerokość pasków mocy (drużyna vs przeciwnik) w procentach. */
  protected readonly bars = computed(() => {
    const ours = this.result()?.pokemonPowerTotal ?? this.preview().total;
    const theirs = this.encounter().power;
    const max = Math.max(ours, theirs, 1);
    return { ours, theirs, oursPct: (ours / max) * 100, theirsPct: (theirs / max) * 100 };
  });

  constructor() {
    // Akcja na miejscu: odliczanie biegnie tylko wtedy, gdy gracz stoi w kółku.
    const timer = setInterval(() => {
      if (this.phase() !== 'action' || !this.inRange()) return;
      const left = this.dwellLeft() - 1;
      this.dwellLeft.set(left);
      if (left <= 0) this.phase.set('team');
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect(() => {
      const phase = this.phase();
      if (!this.inRange() && (phase === 'action' || phase === 'team')) this.interrupted.emit();
    });
  }

  protected toggle(id: number): void {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_BATTLE_TEAM ? [...ids, id] : ids,
    );
  }

  protected async fight(): Promise<void> {
    const ids = this.team().map((p) => p.id);
    if (ids.length === 0 || this.phase() !== 'team') return;
    this.phase.set('fighting');
    try {
      const [result] = await Promise.all([this.encounters.attack(this.encounter().id, ids), delay(CLASH_MS)]);
      if (!result) {
        this.failed.emit('Nie znamy Twojej pozycji. Włącz lokalizację.');
      } else if (result.outcome === 'too_far') {
        this.failed.emit(`Za daleko: ${result.distanceM} m od przeciwnika.`);
      } else {
        this.result.set(result);
        this.phase.set('result');
      }
    } catch {
      this.failed.emit('Przeciwnik zniknął, zanim doszło do starcia.');
    }
  }

  /** Po przegranej: kolejna próba, można zmienić skład (akcji na miejscu nie powtarzamy). */
  protected retry(): void {
    this.result.set(null);
    this.phase.set('team');
  }

  protected expGained(pokemonId: number): number {
    return this.result()?.pokemons.find((p) => p.pokemonId === pokemonId)?.expGained ?? 0;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
