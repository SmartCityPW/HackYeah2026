import { Position } from '../game.model';
import { CharacterId, NewReport, Pokestop, PokestopStatus, VoteResult } from '../pokestop.model';

/**
 * Kontrakt z backendem. Frontend zależy tylko od tej klasy: mock (`MockPokestopApi`)
 * podmieniamy na implementację HTTP jednym wpisem w `app.config.ts`.
 *
 * Odpowiadające endpointy (do uzgodnienia z backendem):
 *   list           GET   /pokestops
 *   vote           POST  /pokestops/{id}/vote       { vote, position }
 *   comment        POST  /pokestops/{id}/comments   { text, position }
 *   create         POST  /pokestops                 { ..., lat, lng, position }
 *
 * `position` to pozycja gracza: serwer odrzuca akcję (`TooFarError`, kod `too_far`), gdy pinezka
 * leży poza kółkiem interakcji (INTERACTION_RADIUS_M).
 *   setStatus      PATCH /pokestops/{id}            { status }   (administrator)
 *   listCollection GET   /me/collection
 */
export abstract class PokestopApi {
  abstract list(): Promise<Pokestop[]>;
  abstract vote(id: number, vote: 'for' | 'against', position: Position): Promise<VoteResult>;
  abstract comment(id: number, text: string, position: Position): Promise<Pokestop>;
  abstract create(report: NewReport, position: Position): Promise<Pokestop>;
  abstract setStatus(id: number, status: PokestopStatus): Promise<Pokestop>;
  abstract listCollection(): Promise<Record<CharacterId, number>>;
}
