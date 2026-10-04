import { PlayerPosition } from '../game.model';
import { CheckInResult, EventQuery, GameEvent, NewEvent } from '../event.model';
import { Bbox } from '../pokestop.model';

/**
 * Wydarzenia zaufanych podmiotów. Tryb źródła danych jak dla pinezek (`api.mode.pokestops`).
 *   list     GET   /events?bbox=&from=&to=&organizationId=
 *   get      GET   /events/{id}
 *   create   POST  /events                      (zweryfikowana organizacja)
 *   cancel   PATCH /events/{id}                 { status: 'cancelled' }
 *   checkIn  POST  /events/{id}/check-in        { position }
 */
export abstract class EventApi {
  abstract list(area?: Bbox, query?: EventQuery): Promise<GameEvent[]>;
  abstract get(id: number): Promise<GameEvent>;
  abstract create(event: NewEvent): Promise<GameEvent>;
  abstract cancel(id: number): Promise<GameEvent>;
  /**
   * Odbiór nagrody: tylko w kółku interakcji i w czasie trwania (inaczej `TooFarError` albo błąd `outside_time_window`).
   * Jeden pokemon na uczestnika na wydarzenie.
   */
  abstract checkIn(id: number, position: PlayerPosition): Promise<CheckInResult>;
}
