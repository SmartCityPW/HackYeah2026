import { AttackResult, Encounter, PlayerProgress, Position } from '../game.model';

/**
 * Kontrakt gry z backendem. Cała logika walki i generowanie przeciwników są po stronie serwera
 * (klient nie może oszukiwać): frontend tylko pyta o stan i zgłasza próbę ataku z pozycją.
 *
 *   listEncounters GET  /encounters?lat=&lng=       (przeciwnicy w okolicy użytkownika)
 *   attack         POST /encounters/{id}/attack     { lat, lng }
 *   getProgress    GET  /me/progress
 */
export abstract class GameApi {
  abstract listEncounters(around: Position): Promise<Encounter[]>;
  abstract attack(id: number, position: Position): Promise<AttackResult>;
  abstract getProgress(): Promise<PlayerProgress>;
}
