import { Injectable } from '@angular/core';
import { TypeCode } from '../game.model';
import { Pokemon } from '../pokemon.model';
import { CharacterId } from '../pokestop.model';

/** Wartości jak w backend/config/default.yaml (game.levels): 100 exp na poziom pokemona i 100 xp na poziom gracza. */
export const EXP_PER_POKEMON_LEVEL = 100;
export const XP_PER_PLAYER_LEVEL = 100;

/** Słownik postaci jak w `docs/db/seed_reference.sql` (typ, moc na poziomie 1, przyrost na poziom). */
export const SPECIES: Record<CharacterId, { typeCode: TypeCode; basePower: number; growth: number }> = {
  cyclist: { typeCode: 'transport', basePower: 20, growth: 4 },
  bin: { typeCode: 'clean', basePower: 15, growth: 4 },
  tree: { typeCode: 'green', basePower: 18, growth: 4 },
  train: { typeCode: 'transport', basePower: 25, growth: 5 },
  lamp: { typeCode: 'energy', basePower: 12, growth: 3 },
};

export interface OwnedPokemon {
  id: number;
  character: CharacterId;
  exp: number;
  isStaked: boolean;
}

/** Poziom i moc z exp, jak wylicza je serwer (poziom = 1 + exp / 100, moc = base_power + growth × (poziom − 1)). */
export function toPokemon(p: OwnedPokemon): Pokemon {
  const species = SPECIES[p.character];
  const level = 1 + Math.floor(p.exp / EXP_PER_POKEMON_LEVEL);
  return {
    id: p.id,
    character: p.character,
    typeCode: species.typeCode,
    nickname: null,
    level,
    exp: p.exp,
    expIntoLevel: p.exp % EXP_PER_POKEMON_LEVEL,
    expForNextLevel: EXP_PER_POKEMON_LEVEL,
    power: species.basePower + species.growth * (level - 1),
    isStaked: p.isStaked,
  };
}

/**
 * Stan gracza w atrapach: jeden na całą aplikację, współdzielony przez `MockPokestopApi` (głos daje exp, zgłoszenie
 * zastawia pokemona) i `MockGameApi` (walka daje exp drużynie, nowego pokemona i xp gracza). Dzięki temu exp z walki
 * widać przy wyborze pokemona do głosu, tak jak byłoby z prawdziwym backendem.
 */
@Injectable({ providedIn: 'root' })
export class MockPlayerState {
  /** XP gracza (poziom gracza liczy się z niego; głosy nie dają xp, tylko exp pokemonowi). */
  xp = 120;
  readonly pokemons: OwnedPokemon[] = [
    { id: 1, character: 'cyclist', exp: 150, isStaked: false },
    { id: 2, character: 'lamp', exp: 40, isStaked: false },
    { id: 3, character: 'tree', exp: 0, isStaked: false },
  ];

  find(id: number): OwnedPokemon | undefined {
    return this.pokemons.find((p) => p.id === id);
  }

  add(character: CharacterId): OwnedPokemon {
    const pokemon: OwnedPokemon = { id: Math.max(0, ...this.pokemons.map((p) => p.id)) + 1, character, exp: 0, isStaked: false };
    this.pokemons.push(pokemon);
    return pokemon;
  }
}
