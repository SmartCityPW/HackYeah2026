import { CharacterId, NewReport, Pokestop, PokestopStatus, VoteResult } from '../pokestop.model';

/**
 * Kontrakt z backendem. Frontend zależy tylko od tej klasy: mock (`MockPokestopApi`)
 * podmieniamy na implementację HTTP jednym wpisem w `app.config.ts`.
 *
 * Odpowiadające endpointy (do uzgodnienia z backendem):
 *   list           GET   /pokestops
 *   vote           POST  /pokestops/{id}/vote       { vote: 'for' | 'against' }
 *   comment        POST  /pokestops/{id}/comments   { text }
 *   create         POST  /pokestops
 *   setStatus      PATCH /pokestops/{id}            { status }   (administrator)
 *   listCollection GET   /me/collection
 */
export abstract class PokestopApi {
  abstract list(): Promise<Pokestop[]>;
  abstract vote(id: number, vote: 'for' | 'against'): Promise<VoteResult>;
  abstract comment(id: number, text: string): Promise<Pokestop>;
  abstract create(report: NewReport): Promise<Pokestop>;
  abstract setStatus(id: number, status: PokestopStatus): Promise<Pokestop>;
  abstract listCollection(): Promise<Record<CharacterId, number>>;
}
