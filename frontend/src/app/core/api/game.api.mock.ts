import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { AttackPokemonResult, AttackResult, Encounter, PlayerProgress, Position } from '../game.model';
import { distanceMeters } from '../geo.utils';
import { ApiHttpError } from '../http/api-error';
import { CatalogService } from '../catalog/catalog.service';
import { GameApi } from './game.api';
import { MockPlayerState, OwnedPokemon, XP_PER_PLAYER_LEVEL } from './mock-player.state';

/** Ilu przeciwników najbliższych w kółku zwraca serwer (backend: game.encounters.max_in_response). */
export const MAX_IN_RESPONSE = 5;
const LIFETIME_MS = 30 * 60_000;
const METERS_PER_DEG_LAT = 111_320;
/** Teren jest podzielony na kwadraty o tym boku; każdy kwadrat ma własnych przeciwników (backend: game.encounters.cell_size_m). */
const CELL_M = 100;
/** Ilu przeciwników (0..CELL_MAX_ENEMIES) losuje kwadrat przy zasiedleniu (backend: game.encounters.max_per_cell). */
const CELL_MAX_ENEMIES = 6;
/** Wyczyszczony kwadrat (wszyscy pokonani albo wygaśli) zasiedla się na nowo dopiero po tym czasie (backend: game.encounters.respawn_seconds). */
const RESPAWN_MS = 60_000;

const toProgress = (xp: number): PlayerProgress => ({
  level: Math.floor(xp / XP_PER_PLAYER_LEVEL) + 1,
  xp,
  xpIntoLevel: xp % XP_PER_PLAYER_LEVEL,
  xpForNextLevel: XP_PER_PLAYER_LEVEL,
});

/** Szablony przeciwników jak `game_enemy_type` w `docs/db/seed_reference.sql`. */
interface EnemyTemplate extends Pick<Encounter, 'name' | 'emoji' | 'description' | 'actionLabel' | 'typeCode'> {
  minLevel: number;
  maxLevel: number;
  basePower: number;
  growth: number;
  baseXp: number;
  weight: number;
}

const TEMPLATES: EnemyTemplate[] = [
  { name: 'Korek Komunikacyjny', emoji: '🚗', typeCode: 'transport', description: 'Zablokował skrzyżowanie i nie chce odjechać.', actionLabel: 'Stań przy skrzyżowaniu i rozładuj korek', minLevel: 2, maxLevel: 4, basePower: 30, growth: 10, baseXp: 40, weight: 3 },
  { name: 'Śmieciowy Potwór', emoji: '🗑️', typeCode: 'clean', description: 'Rośnie przy każdym wyrzuconym papierku.', actionLabel: 'Wyrzuć jedną śmieć do kosza w pobliżu', minLevel: 1, maxLevel: 3, basePower: 20, growth: 8, baseXp: 25, weight: 4 },
  { name: 'Smogowy Duch', emoji: '🌫️', typeCode: 'air', description: 'Unosi się nad miastem w zimne dni.', actionLabel: 'Weź kilka głębokich wdechów, ale daleko od ulicy', minLevel: 3, maxLevel: 5, basePower: 45, growth: 12, baseXp: 55, weight: 2 },
  { name: 'Betonowy Golem', emoji: '🧱', typeCode: 'infra', description: 'Zabetonował skwer, na którym miała rosnąć trawa.', actionLabel: 'Dotknij najbliższego drzewa', minLevel: 4, maxLevel: 6, basePower: 60, growth: 15, baseXp: 70, weight: 1 },
];

interface Cell {
  row: number;
  col: number;
  /** Kiedy pusty kwadrat zasiedli się na nowo (ustawiane, gdy zostanie wyczyszczony). */
  refillAt?: number;
}

/**
 * Atrapa backendu gry: sama generuje przeciwników i rozstrzyga walki, jak zrobiłby to serwer.
 *
 * Przeciwnicy są przypisani do miejsc, nie do gracza: teren dzieli się na kwadraty CELL_M × CELL_M, a każdy
 * kwadrat przy pierwszym odwiedzeniu losuje 0..CELL_MAX_ENEMIES przeciwników, którzy stoją tam, dopóki nie
 * zostaną pokonani albo nie wygasną. Wracając w to samo miejsce, gracz spotyka tych samych przeciwników
 * (i widziałby ich każdy inny gracz). Wyczyszczony kwadrat odradza się po RESPAWN_MS. Gracz widzi najbliższych
 * MAX_IN_RESPONSE z tych, którzy stoją w jego kółku. Pokemony i xp gracza są wspólne z `MockPokestopApi`
 * (`MockPlayerState`).
 */
@Injectable()
export class MockGameApi extends GameApi {
  private readonly range = inject(AppConfigService).config.game;
  private readonly player = inject(MockPlayerState);
  private readonly catalog = inject(CatalogService);

  /** Źródło losowości (do podmiany w testach). */
  random: () => number = Math.random;

  private encounters: Encounter[] = [];
  private nextId = 1;
  private readonly cells = new Map<string, Cell>();
  /** Kwadrat, do którego należy przeciwnik (id -> klucz kwadratu). */
  private readonly cellOf = new Map<number, string>();

  async listEncounters(around: Position, radiusM: number): Promise<Encounter[]> {
    const now = Date.now();
    this.encounters = this.encounters.filter((e) => Date.parse(e.expiresAt) > now);
    for (const cell of this.cellsAround(around, radiusM)) this.settle(cell, now);
    const visible = this.encounters
      .map((e) => ({ e, d: distanceMeters(around, e) }))
      .filter(({ d }) => d <= radiusM)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_IN_RESPONSE)
      .map(({ e }) => e);
    return clone(visible);
  }

  async attack(id: number, position: Position, pokemonIds: number[]): Promise<AttackResult> {
    const target = this.encounters.find((e) => e.id === id);
    if (!target) throw new ApiHttpError(404, 'not_found', 'Ten przeciwnik już nie istnieje.');
    const team = this.validateTeam(pokemonIds);
    const distanceM = Math.round(distanceMeters(position, target));
    if (distanceM > this.range.interactionRangeM) return { outcome: 'too_far', distanceM };

    const pokemons: AttackPokemonResult[] = team.map((p) => ({
      pokemonId: p.id,
      powerUsed: this.player.toPokemon(p).power,
      typeMultiplierApplied: this.catalog.character(p.character).typeCode === target.typeCode ? this.range.typeMultiplier : 1,
    }));
    const pokemonPowerTotal = Math.round(pokemons.reduce((sum, p) => sum + p.powerUsed * p.typeMultiplierApplied, 0));
    if (pokemonPowerTotal <= target.power) return { outcome: 'lost', enemyPower: target.power, pokemonPowerTotal, pokemons };

    this.encounters = this.encounters.filter((e) => e.id !== id);
    for (const p of team) p.exp += target.xpReward;
    // Jak serwer: nagroda losowana z postaci poza unikalnymi za wydarzenia.
    const pool = this.catalog.characters().filter((c) => !c.isEventExclusive);
    const awardedCharacter = pool[Math.floor(this.random() * pool.length)].code;
    this.player.add(awardedCharacter);
    this.player.xp += target.xpReward;
    return {
      outcome: 'won',
      enemyPower: target.power,
      pokemonPowerTotal,
      pokemons: pokemons.map((p) => ({ ...p, expGained: target.xpReward })),
      awardedCharacter,
      xpGained: target.xpReward,
      progress: toProgress(this.player.xp),
    };
  }

  async getProgress(): Promise<PlayerProgress> {
    return toProgress(this.player.xp);
  }

  /** Jak serwer: 1–maxTeamSize różne, własne, niezastawione pokemony (inaczej 422). */
  private validateTeam(ids: number[]): OwnedPokemon[] {
    if (ids.length < 1 || ids.length > this.range.maxTeamSize || new Set(ids).size !== ids.length) {
      throw new ApiHttpError(422, 'validation_error', `Drużyna musi mieć od 1 do ${this.range.maxTeamSize} różnych pokemonów.`);
    }
    return ids.map((id) => {
      const p = this.player.find(id);
      if (!p || p.isStaked) throw new ApiHttpError(422, 'validation_error', 'Ten pokemon nie może walczyć (nie jest Twój albo czeka na zgłoszeniu).');
      return p;
    });
  }

  /** Kwadraty terenu, które zahaczają o kółko gracza (zasiedlane od razu, gdy gracz pierwszy raz je zobaczy). */
  private cellsAround(around: Position, radiusM: number): Cell[] {
    const northM = around.lat * METERS_PER_DEG_LAT;
    const cells: Cell[] = [];
    for (let row = Math.floor((northM - radiusM) / CELL_M); row <= Math.floor((northM + radiusM) / CELL_M); row++) {
      const eastM = around.lng * metersPerDegLng(row);
      for (let col = Math.floor((eastM - radiusM) / CELL_M); col <= Math.floor((eastM + radiusM) / CELL_M); col++) {
        const key = `${row}:${col}`;
        if (!this.cells.has(key)) this.cells.set(key, { row, col, refillAt: 0 });
        cells.push(this.cells.get(key)!);
      }
    }
    return cells;
  }

  /** Zasiedla nowy kwadrat; pusty (wyczyszczony) dopiero po RESPAWN_MS. */
  private settle(cell: Cell, now: number): void {
    const key = `${cell.row}:${cell.col}`;
    if (this.encounters.some((e) => this.cellOf.get(e.id) === key)) return;
    if (cell.refillAt === undefined) cell.refillAt = now + RESPAWN_MS;
    if (now < cell.refillAt) return;
    cell.refillAt = undefined;
    const count = Math.floor(this.random() * (CELL_MAX_ENEMIES + 1));
    for (let i = 0; i < count; i++) {
      const enemy = this.spawn(cell, now);
      this.cellOf.set(enemy.id, key);
      this.encounters.push(enemy);
    }
  }

  /** Losowy punkt w kwadracie, szablon wg wag i poziom z jego zakresu. */
  private spawn(cell: Cell, now: number): Encounter {
    const { minLevel, maxLevel, basePower, growth, baseXp, weight: _weight, ...template } = this.pickTemplate();
    const level = minLevel + Math.floor(this.random() * (maxLevel - minLevel + 1));
    return {
      ...template,
      id: this.nextId++,
      level,
      power: basePower + growth * (level - 1),
      xpReward: baseXp,
      lat: ((cell.row + this.random()) * CELL_M) / METERS_PER_DEG_LAT,
      lng: ((cell.col + this.random()) * CELL_M) / metersPerDegLng(cell.row),
      expiresAt: new Date(now + LIFETIME_MS).toISOString(),
    };
  }

  private pickTemplate(): EnemyTemplate {
    let roll = this.random() * TEMPLATES.reduce((sum, t) => sum + t.weight, 0);
    for (const t of TEMPLATES) {
      roll -= t.weight;
      if (roll < 0) return t;
    }
    return TEMPLATES[TEMPLATES.length - 1];
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Metry na stopień długości geograficznej w danym rzędzie kwadratów (liczone dla środka rzędu, żeby siatka była stała). */
function metersPerDegLng(row: number): number {
  const lat = ((row + 0.5) * CELL_M) / METERS_PER_DEG_LAT;
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}
