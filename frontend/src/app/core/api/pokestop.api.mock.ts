import { Injectable } from '@angular/core';
import { CharacterId, NewReport, Pokestop, PokestopStatus, VoteResult } from '../pokestop.model';
import { PokestopApi } from './pokestop.api';
import { MOCK_COLLECTION, MOCK_STOPS } from './pokestop.mock-data';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Atrapa backendu w pamięci. Robi to, co zrobiłby serwer: nadaje ID, ustala autora i przyznaje nagrody. */
@Injectable()
export class MockPokestopApi extends PokestopApi {
  private stops: Pokestop[] = clone(MOCK_STOPS);
  private collection: Record<CharacterId, number> = { ...MOCK_COLLECTION };

  async list(): Promise<Pokestop[]> {
    return clone(this.stops);
  }

  async vote(id: number, vote: 'for' | 'against'): Promise<VoteResult> {
    const stop = this.require(id);
    if (stop.myVote) return { stop: clone(stop), awarded: null };
    stop.myVote = vote;
    if (vote === 'for') stop.votesFor++;
    else stop.votesAgainst++;
    this.collection[stop.character]++;
    return { stop: clone(stop), awarded: stop.character };
  }

  async comment(id: number, text: string): Promise<Pokestop> {
    const stop = this.require(id);
    const nextId = Math.max(0, ...this.stops.flatMap((s) => s.comments.map((c) => c.id))) + 1;
    stop.comments.push({ id: nextId, author: 'Ty', text, mine: true });
    return clone(stop);
  }

  async create(report: NewReport): Promise<Pokestop> {
    const stop: Pokestop = {
      ...clone(report),
      id: Math.max(0, ...this.stops.map((s) => s.id)) + 1,
      status: 'open',
      author: report.organization ?? 'Ty',
      mine: true,
      comments: [],
      votesFor: 0,
      votesAgainst: 0,
      myVote: null,
    };
    this.stops.push(stop);
    return clone(stop);
  }

  async setStatus(id: number, status: PokestopStatus): Promise<Pokestop> {
    const stop = this.require(id);
    stop.status = status;
    return clone(stop);
  }

  async listCollection(): Promise<Record<CharacterId, number>> {
    return { ...this.collection };
  }

  private require(id: number): Pokestop {
    const stop = this.stops.find((s) => s.id === id);
    if (!stop) throw new Error(`Pokestop ${id} nie istnieje`);
    return stop;
  }
}
