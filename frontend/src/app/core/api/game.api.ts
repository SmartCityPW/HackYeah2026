import { AttackResult, Encounter, PlayerProgress, Position } from '../game.model';

/**
 * Kontrakt gry z backendem. Cała logika walki i generowanie przeciwników są po stronie serwera
 * (klient nie może oszukiwać): frontend tylko pyta o stan i zgłasza próbę ataku z pozycją i drużyną.
 *
 *   listEncounters GET  /encounters?lat=&lng=&radius=  (najbliżsi przeciwnicy w kółku interakcji gracza)
 *   attack         POST /encounters/{id}/attack        { lat, lng, pokemonIds }
 *   getProgress    GET  /me/progress
 *
 * Pokemony gracza (do drużyny) pochodzą z `PokestopApi.listPokemons`: to ta sama lista, której używa głos i zastaw.
 */
export abstract class GameApi {
  abstract listEncounters(around: Position, radiusM: number): Promise<Encounter[]>;
  abstract attack(id: number, position: Position, pokemonIds: number[]): Promise<AttackResult>;
  abstract getProgress(): Promise<PlayerProgress>;
}
