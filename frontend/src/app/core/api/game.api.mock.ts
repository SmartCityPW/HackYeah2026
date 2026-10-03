import { Injectable } from '@angular/core';
import {
  AttackPokemonResult,
  AttackResult,
  Encounter,
  INTERACTION_RADIUS_M,
  MAX_BATTLE_TEAM,
  MAX_ENEMIES_IN_RANGE,
  PlayerProgress,
  Pokemon,
  Position,
  TYPE_MULTIPLIER,
  TypeCode,
} from '../game.model';
import { distanceMeters } from '../geo.utils';
import { CHARACTER_IDS, CharacterId } from '../pokestop.model';
import { GameApi } from './game.api';

const XP_PER_LEVEL = 100;
const EXP_PER_POKEMON_LEVEL = 100;
const LIFETIME_MS = 30 * 60_000;
const METERS_PER_DEG_LAT = 111_320;
/** Teren jest podzielony na kwadraty o tym boku; każdy kwadrat ma własnych przeciwników. */
const CELL_M = 100;
/** Ilu przeciwników (0..CELL_MAX_ENEMIES) losuje kwadrat przy zasiedleniu. */
const CELL_MAX_ENEMIES = 6;
/** Wyczyszczony kwadrat (wszyscy pokonani albo wygaśli) zasiedla się na nowo dopiero po tym czasie. */
const RESPAWN_MS = 60_000;

const toProgress = (xp: number): PlayerProgress => ({
  level: Math.floor(xp / XP_PER_LEVEL) + 1,
  xp,
  xpIntoLevel: xp % XP_PER_LEVEL,
  xpForNextLevel: XP_PER_LEVEL,
});

/** Słownik postaci jak w `docs/db/seed_reference.sql` (typ, moc na poziomie 1, przyrost na poziom). */
const SPECIES: Record<CharacterId, { typeCode: TypeCode; basePower: number; growth: number }> = {
  cyclist: { typeCode: 'transport', basePower: 20, growth: 4 },
  bin: { typeCode: 'clean', basePower: 15, growth: 4 },
  tree: { typeCode: 'green', basePower: 18, growth: 4 },
  train: { typeCode: 'transport', basePower: 25, growth: 5 },
  lamp: { typeCode: 'energy', basePower: 12, growth: 3 },
};

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

interface OwnedPokemon {
  id: number;
  character: CharacterId;
  exp: number;
  isStaked: boolean;
}

/** Drużyna startowa atrapy (zgodna z MOCK_COLLECTION w pokestop.mock-data.ts). */
const STARTING_POKEMONS: OwnedPokemon[] = [
  { id: 1, character: 'cyclist', exp: 150, isStaked: false },
  { id: 2, character: 'lamp', exp: 40, isStaked: false },
  { id: 3, character: 'tree', exp: 0, isStaked: false },
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
 * MAX_ENEMIES_IN_RANGE z tych, którzy stoją w jego kółku.
 */
@Injectable()
export class MockGameApi extends GameApi {
  /** Źródło losowości (do podmiany w testach). */
  random: () => number = Math.random;

  private xp = 120;
  private encounters: Encounter[] = [];
  private pokemons: OwnedPokemon[] = STARTING_POKEMONS.map((p) => ({ ...p }));
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
      .slice(0, MAX_ENEMIES_IN_RANGE)
      .map(({ e }) => e);
    return clone(visible);
  }

  async attack(id: number, position: Position, pokemonIds: number[]): Promise<AttackResult> {
    const target = this.encounters.find((e) => e.id === id);
    if (!target) throw new Error(`Przeciwnik ${id} już nie istnieje`);
    const team = this.validateTeam(pokemonIds);
    const distanceM = Math.round(distanceMeters(position, target));
    if (distanceM > INTERACTION_RADIUS_M) return { outcome: 'too_far', distanceM };

    const pokemons: AttackPokemonResult[] = team.map((p) => ({
      pokemonId: p.id,
      powerUsed: toPokemon(p).power,
      typeMultiplierApplied: SPECIES[p.character].typeCode === target.typeCode ? TYPE_MULTIPLIER : 1,
    }));
    const pokemonPowerTotal = Math.round(pokemons.reduce((sum, p) => sum + p.powerUsed * p.typeMultiplierApplied, 0));
    if (pokemonPowerTotal <= target.power) return { outcome: 'lost', enemyPower: target.power, pokemonPowerTotal, pokemons };

    this.encounters = this.encounters.filter((e) => e.id !== id);
    for (const p of team) p.exp += target.xpReward;
    const awardedCharacter = CHARACTER_IDS[Math.floor(this.random() * CHARACTER_IDS.length)];
    this.pokemons.push({ id: Math.max(...this.pokemons.map((p) => p.id)) + 1, character: awardedCharacter, exp: 0, isStaked: false });
    this.xp += target.xpReward;
    return {
      outcome: 'won',
      enemyPower: target.power,
      pokemonPowerTotal,
      pokemons: pokemons.map((p) => ({ ...p, expGained: target.xpReward })),
      awardedCharacter,
      xpGained: target.xpReward,
      progress: toProgress(this.xp),
    };
  }

  async listPokemons(): Promise<Pokemon[]> {
    return this.pokemons.map(toPokemon);
  }

  async getProgress(): Promise<PlayerProgress> {
    return toProgress(this.xp);
  }

  /** Jak serwer: 1–3 różne, własne, niezastawione pokemony (inaczej 422). */
  private validateTeam(ids: number[]): OwnedPokemon[] {
    if (ids.length < 1 || ids.length > MAX_BATTLE_TEAM || new Set(ids).size !== ids.length) {
      throw new Error(`Drużyna musi mieć od 1 do ${MAX_BATTLE_TEAM} różnych pokemonów`);
    }
    return ids.map((id) => {
      const p = this.pokemons.find((x) => x.id === id);
      if (!p || p.isStaked) throw new Error(`Pokemon ${id} nie może walczyć`);
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
    const { minLevel, maxLevel, basePower, growth, baseXp, weight, ...template } = this.pickTemplate();
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

/** Poziom i moc z exp, jak wylicza je serwer (100 exp na poziom, base_power + growth × (poziom − 1)). */
function toPokemon(p: OwnedPokemon): Pokemon {
  const species = SPECIES[p.character];
  const level = Math.floor(p.exp / EXP_PER_POKEMON_LEVEL) + 1;
  return {
    ...p,
    typeCode: species.typeCode,
    level,
    expIntoLevel: p.exp % EXP_PER_POKEMON_LEVEL,
    expForNextLevel: EXP_PER_POKEMON_LEVEL,
    power: species.basePower + species.growth * (level - 1),
  };
}
