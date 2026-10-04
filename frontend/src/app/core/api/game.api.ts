import { AttackResult, Encounter, PlayerPosition, PlayerProgress } from '../game.model';

/**
 * Kontrakt gry z backendem. Cała logika walki i generowanie przeciwników są po stronie serwera
 * (klient nie może oszukiwać): frontend tylko pyta o stan i zgłasza próbę ataku z pozycją i drużyną.
 *
 *   listEncounters GET  /encounters?lat=&lng=&radius=&accuracyM=&takenAt=&source=  (najbliżsi przeciwnicy TEGO gracza w kółku interakcji)
 *   attack         POST /encounters/{id}/attack        { lat, lng, accuracyM, clientTime, source, pokemonIds }
 *   getProgress    GET  /me/progress
 *
 * Pokemony gracza (do drużyny) pochodzą z `PokestopApi.listPokemons`: to ta sama lista, której używa głos i zastaw.
 */
export abstract class GameApi {
  abstract listEncounters(around: PlayerPosition, radiusM: number): Promise<Encounter[]>;
  abstract attack(id: number, position: PlayerPosition, pokemonIds: number[]): Promise<AttackResult>;
  abstract getProgress(): Promise<PlayerProgress>;
}
