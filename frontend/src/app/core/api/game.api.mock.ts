import { Injectable } from '@angular/core';
import {
  AttackPokemonResult,
  AttackResult,
  Encounter,
  INTERACTION_RADIUS_M,
  MAX_BATTLE_TEAM,
  MAX_ENEMIES_IN_RANGE,
  MIN_ENEMIES_IN_RANGE,
  PlayerProgress,
  Pokemon,
  Position,
  TYPE_MULTIPLIER,
  TypeCode,
} from '../game.model';
import { distanceMeters, offsetMeters } from '../geo.utils';
import { CHARACTER_IDS, CharacterId } from '../pokestop.model';
import { GameApi } from './game.api';

const XP_PER_LEVEL = 100;
const EXP_PER_POKEMON_LEVEL = 100;
const LIFETIME_MS = 30 * 60_000;
/** Po tylu metrach marszu serwer losuje na nowo, ilu przeciwników ma być w kółku. */
const REROLL_AFTER_M = 40;
/** Przeciwnicy nie pojawiają się tuż na krawędzi kółka ani pod nogami gracza. */
const SPAWN_MIN_M = 8;
const SPAWN_EDGE_MARGIN = 0.9;

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

/**
 * Atrapa backendu gry: sama generuje przeciwników i rozstrzyga walki, jak zrobiłby to serwer.
 * W kółku gracza krąży od MIN do MAX przeciwników; ci, od których gracz odszedł (albo wygaśli), znikają,
 * a w ich miejsce pojawiają się nowi wokół aktualnej pozycji.
 */
@Injectable()
export class MockGameApi extends GameApi {
  /** Źródło losowości (do podmiany w testach). */
  random: () => number = Math.random;

  private xp = 120;
  private encounters: Encounter[] = [];
  private pokemons: OwnedPokemon[] = STARTING_POKEMONS.map((p) => ({ ...p }));
  private nextId = 1;
  private target = 0;
  private rolledAt?: Position;

  async listEncounters(around: Position, radiusM: number): Promise<Encounter[]> {
    const now = Date.now();
    this.encounters = this.encounters.filter((e) => Date.parse(e.expiresAt) > now && distanceMeters(around, e) <= radiusM);
    if (!this.rolledAt || distanceMeters(this.rolledAt, around) >= REROLL_AFTER_M) {
      this.rolledAt = around;
      this.target = MIN_ENEMIES_IN_RANGE + Math.floor(this.random() * (MAX_ENEMIES_IN_RANGE - MIN_ENEMIES_IN_RANGE + 1));
    }
    while (this.encounters.length < this.target) this.encounters.push(this.spawn(around, radiusM, now));
    return clone(this.encounters);
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

  /** Losowy punkt w kółku (równomiernie po powierzchni), szablon wg wag i poziom z jego zakresu. */
  private spawn(around: Position, radiusM: number, now: number): Encounter {
    const maxR = radiusM * SPAWN_EDGE_MARGIN;
    const r = Math.sqrt(SPAWN_MIN_M ** 2 + this.random() * (maxR ** 2 - SPAWN_MIN_M ** 2));
    const angle = this.random() * 2 * Math.PI;
    const { minLevel, maxLevel, basePower, growth, baseXp, weight, ...template } = this.pickTemplate();
    const level = minLevel + Math.floor(this.random() * (maxLevel - minLevel + 1));
    return {
      ...template,
      id: this.nextId++,
      level,
      power: basePower + growth * (level - 1),
      xpReward: baseXp,
      ...offsetMeters(around, r * Math.cos(angle), r * Math.sin(angle)),
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

/** Poziom i moc z exp, jak wylicza je serwer (100 exp na poziom, base_power + growth × (poziom − 1)). */
function toPokemon(p: OwnedPokemon): Pokemon {
  const species = SPECIES[p.character];
  const level = Math.floor(p.exp / EXP_PER_POKEMON_LEVEL) + 1;
  return { ...p, typeCode: species.typeCode, level, power: species.basePower + species.growth * (level - 1) };
}
