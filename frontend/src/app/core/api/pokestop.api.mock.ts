import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { distanceMeters } from '../geo.utils';
import { ApiHttpError } from '../http/api-error';
import { Pokemon } from '../pokemon.model';
import { Bbox, CHARACTER_IDS, CharacterId, CommentPage, NewReport, Pokestop, PokestopComment, PokestopStatus, VoteContext, VoteResult } from '../pokestop.model';
import { hasInteraction } from '../pokestop.utils';
import { PokestopApi } from './pokestop.api';
import { MOCK_POKEMONS, MOCK_STOPS } from './pokestop.mock-data';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Exp za głos i exp na poziom: te same wartości co w backend/config/default.yaml (game.exp.per_vote, game.levels). */
const EXP_PER_VOTE = 10;
const EXP_PER_LEVEL = 100;

/**
 * Atrapa backendu w pamięci. Robi to, co zrobiłby serwer: nadaje ID, ustala autora, pilnuje zasięgu i jednego głosu,
 * przyznaje exp wybranemu pokemonowi i blokuje pokemona zastawionego na zgłoszeniu.
 */
@Injectable()
export class MockPokestopApi extends PokestopApi {
  private readonly range = inject(AppConfigService).config.game.interactionRangeM;
  private stops: Pokestop[] = clone(MOCK_STOPS);
  private pokemons: Pokemon[] = clone(MOCK_POKEMONS);

  async list(area?: Bbox, status?: PokestopStatus): Promise<Pokestop[]> {
    const inArea = (s: Pokestop) => !area || (s.lng >= area.west && s.lng <= area.east && s.lat >= area.south && s.lat <= area.north);
    // Jak backend: odrzucone widzi tylko ten, kto o nie jawnie zapyta.
    const matchesStatus = (s: Pokestop) => (status ? s.status === status : s.status !== 'rejected');
    return clone(this.stops.filter((s) => inArea(s) && matchesStatus(s)));
  }

  async listInteractions(): Promise<Pokestop[]> {
    return clone(this.stops.filter(hasInteraction));
  }

  async get(id: number): Promise<Pokestop> {
    return clone(this.require(id));
  }

  async vote(id: number, vote: 'for' | 'against', { pokemonId, position }: VoteContext): Promise<VoteResult> {
    const stop = this.require(id);
    if (stop.mine) throw new ApiHttpError(403, 'own_pokestop', 'Nie możesz głosować na własne zgłoszenie.');
    if (stop.myVote) throw new ApiHttpError(409, 'already_voted', 'Już głosowałeś na tę pinezkę.');
    const pokemon = this.pokemons.find((p) => p.id === pokemonId);
    if (!pokemon) throw new ApiHttpError(404, 'not_found', 'Nie masz takiego pokemona.');
    if (distanceMeters(position, stop) > this.range) {
      throw new ApiHttpError(403, 'too_far', `Jesteś za daleko od tego miejsca. Podejdź na mniej niż ${this.range} m.`);
    }
    stop.myVote = vote;
    if (vote === 'for') stop.votesFor++;
    else stop.votesAgainst++;
    pokemon.exp += EXP_PER_VOTE;
    pokemon.level = 1 + Math.floor(pokemon.exp / EXP_PER_LEVEL);
    return { stop: clone(stop), pokemon: clone(pokemon) };
  }

  async listComments(id: number, page: number, pageSize: number): Promise<CommentPage> {
    const newestFirst = [...this.require(id).comments].reverse();
    return { total: newestFirst.length, items: clone(newestFirst.slice((page - 1) * pageSize, page * pageSize)) };
  }

  async comment(id: number, text: string, parentId?: number): Promise<PokestopComment> {
    const stop = this.require(id);
    const all = this.stops.flatMap((s) => s.comments.flatMap((c) => [c, ...(c.replies ?? [])]));
    const created: PokestopComment = { id: Math.max(0, ...all.map((c) => c.id)) + 1, author: 'Ty', text, mine: true, parentId: parentId ?? null, replies: [] };
    if (parentId) {
      const parent = stop.comments.find((c) => c.id === parentId);
      if (!parent) throw new ApiHttpError(422, 'validation_error', 'Można odpowiadać tylko na komentarz nadrzędny tej pinezki.');
      (parent.replies ??= []).push(created);
    } else {
      stop.comments.push(created);
    }
    return clone(created);
  }

  async create(report: NewReport): Promise<Pokestop> {
    const staked = report.type === 'report' || report.type === 'idea';
    let character = report.character;
    if (staked) {
      const pokemon = this.pokemons.find((p) => p.id === report.stakedPokemonId);
      if (!pokemon) throw new ApiHttpError(422, 'validation_error', 'Wybierz pokemona, którego zostawisz na zgłoszeniu.');
      if (pokemon.isStaked) throw new ApiHttpError(409, 'pokemon_unavailable', 'Ten pokemon jest już zastawiony. Wybierz innego.');
      pokemon.isStaked = true;
      character = pokemon.character;
    }
    const { stakedPokemonId: _staked, ...rest } = clone(report);
    const stop: Pokestop = {
      ...rest,
      character,
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
    const counts = Object.fromEntries(CHARACTER_IDS.map((c) => [c, 0])) as Record<CharacterId, number>;
    for (const p of this.pokemons) counts[p.character]++;
    return counts;
  }

  async listPokemons(availableOnly = false): Promise<Pokemon[]> {
    return clone(this.pokemons.filter((p) => !availableOnly || !p.isStaked));
  }

  private require(id: number): Pokestop {
    const stop = this.stops.find((s) => s.id === id);
    if (!stop) throw new ApiHttpError(404, 'not_found', `Pinezka ${id} nie istnieje.`);
    return stop;
  }
}
