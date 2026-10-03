import { AttackResult, Encounter, PlayerProgress, Pokemon, Position } from '../game.model';

/**
 * Kontrakt gry z backendem. Cała logika walki i generowanie przeciwników są po stronie serwera
 * (klient nie może oszukiwać): frontend tylko pyta o stan i zgłasza próbę ataku z pozycją i drużyną.
 *
 *   listEncounters GET  /encounters?lat=&lng=&radius= (przeciwnicy w kółku interakcji gracza)
 *   attack         POST /encounters/{id}/attack     { lat, lng, pokemonIds }
 *   listPokemons   GET  /me/pokemons                (posiadane pokemony z poziomem i mocą)
 *   getProgress    GET  /me/progress
 */
export abstract class GameApi {
  abstract listEncounters(around: Position, radiusM: number): Promise<Encounter[]>;
  abstract attack(id: number, position: Position, pokemonIds: number[]): Promise<AttackResult>;
  abstract listPokemons(): Promise<Pokemon[]>;
  abstract getProgress(): Promise<PlayerProgress>;
}
