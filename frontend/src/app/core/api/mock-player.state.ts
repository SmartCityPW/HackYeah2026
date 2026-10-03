import { Injectable, inject } from '@angular/core';
import { CatalogService } from '../catalog/catalog.service';
import { Pokemon } from '../pokemon.model';
import { CharacterId } from '../pokestop.model';

/** Wartości jak w backend/config/default.yaml (game.levels): 100 exp na poziom pokemona i 100 xp na poziom gracza. */
export const EXP_PER_POKEMON_LEVEL = 100;
export const XP_PER_PLAYER_LEVEL = 100;

export interface OwnedPokemon {
  id: number;
  character: CharacterId;
  exp: number;
  isStaked: boolean;
}

/** Poziom i moc z exp, jak wylicza je serwer (poziom = 1 + exp / 100, moc = basePower + powerGrowth × (poziom − 1)). */
export function toPokemon(p: OwnedPokemon, catalog: CatalogService): Pokemon {
  const species = catalog.character(p.character);
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
    power: species.basePower + species.powerGrowth * (level - 1),
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
  private readonly catalog = inject(CatalogService);
  /** XP gracza (poziom gracza liczy się z niego; głosy nie dają xp, tylko exp pokemonowi). */
  xp = 120;
  /** Na start: postać startowa i dwie kolejne ze słownika (z różnym exp, żeby było widać poziomy). */
  readonly pokemons: OwnedPokemon[] = this.starterTeam();

  find(id: number): OwnedPokemon | undefined {
    return this.pokemons.find((p) => p.id === id);
  }

  toPokemon(p: OwnedPokemon): Pokemon {
    return toPokemon(p, this.catalog);
  }

  add(character: CharacterId): OwnedPokemon {
    const pokemon: OwnedPokemon = { id: Math.max(0, ...this.pokemons.map((p) => p.id)) + 1, character, exp: 0, isStaked: false };
    this.pokemons.push(pokemon);
    return pokemon;
  }

  private starterTeam(): OwnedPokemon[] {
    const all = this.catalog.characters();
    const starter = all.find((c) => c.isStarter) ?? all[0];
    const others = all.filter((c) => c !== starter && !c.isEventExclusive).slice(0, 2);
    return [starter, ...others].map((c, i) => ({ id: i + 1, character: c.code, exp: [150, 40, 0][i], isStaked: false }));
  }
}
