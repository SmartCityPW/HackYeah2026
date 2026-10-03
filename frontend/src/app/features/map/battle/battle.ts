import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { teamPower } from '../../../core/battle.utils';
import { EncounterService } from '../../../core/encounter.service';
import { ACTION_DWELL_S, AttackResult, Encounter, MAX_BATTLE_TEAM, TYPES } from '../../../core/game.model';
import { PokemonService } from '../../../core/pokemon.service';
import { CHARACTERS } from '../../../core/pokestop.model';

/** Kroki walki: akcja na miejscu -> wybór drużyny -> starcie -> wynik. */
export type BattlePhase = 'action' | 'team' | 'fighting' | 'result';

/** Starcie trwa co najmniej tyle, żeby animacja zdążyła się odegrać (wynik i tak przychodzi z serwera). */
const CLASH_MS = 1600;
/** Tyle sekund gracz ma na powrót do kółka, zanim walka się przerwie (GPS potrafi na chwilę "skoczyć"). */
const LEAVE_GRACE_S = 5;

/**
 * Tryb walki z przeciwnikiem. Wynik rozstrzyga serwer: komponent prowadzi gracza przez kroki,
 * pokazuje podgląd mocy drużyny i odgrywa starcie. Wyjście z kółka przed starciem na dłużej niż
 * LEAVE_GRACE_S sekund przerywa walkę.
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
  /** Gracz wyszedł z kółka przed starciem i nie wrócił na czas. */
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
  /** Ile sekund zostało na powrót do kółka; null, gdy gracz jest w kółku. */
  protected readonly graceLeft = signal<number | null>(null);
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
    const timer = setInterval(() => this.tick(), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * Co sekundę: odliczanie akcji na miejscu (biegnie tylko w kółku) i pilnowanie zasięgu. Poza kółkiem
   * gracz ma LEAVE_GRACE_S sekund na powrót; po starciu zasięg już nie ma znaczenia.
   */
  private tick(): void {
    const phase = this.phase();
    if (phase !== 'action' && phase !== 'team') return;
    if (!this.inRange()) {
      const left = (this.graceLeft() ?? LEAVE_GRACE_S + 1) - 1;
      this.graceLeft.set(left);
      if (left <= 0) this.interrupted.emit();
      return;
    }
    this.graceLeft.set(null);
    if (phase === 'action') {
      const left = this.dwellLeft() - 1;
      this.dwellLeft.set(left);
      if (left <= 0) this.phase.set('team');
    }
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

  /** Tryb demo: pomija odliczanie akcji na miejscu (serwer i tak nie sprawdza go jeszcze, patrz api-contract.md). */
  protected skipAction(): void {
    if (this.phase() === 'action') this.phase.set('team');
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
