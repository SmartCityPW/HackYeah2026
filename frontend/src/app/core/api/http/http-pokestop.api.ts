import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { toApiError } from '../../http/api-error';
import { Position } from '../../game.model';
import { Pokemon } from '../../pokemon.model';
import { Bbox, CharacterId, CommentPage, NewReport, Pokestop, PokestopComment, PokestopPatch, PokestopStatus, SurveyAnswers, SurveyResult, SurveyResults, TimelineEntry, UpdateDraft, VoteContext, VoteResult } from '../../pokestop.model';
import { PokestopApi } from '../pokestop.api';
import { CommentDto, PageDto, PokemonDto, PokestopDto, SurveyResultDto, SurveyResultsDto, TimelineEntryDto, VoteResultDto } from './contract.types';
import { toComment, toNewPokestop, toPokemon, toPokestop, toSurveyResult, toSurveyResults, toTimelineEntry, toVoteResult } from './pokestop.mapper';

/** Maksymalny rozmiar strony akceptowany przez backend (pokestops.max_page_size w backend/config/default.yaml). */
const PAGE_SIZE = 200;

/** Implementacja `PokestopApi` na prawdziwym backendzie (api.mode.pokestops: http). */
@Injectable({ providedIn: 'root' })
export class HttpPokestopApi extends PokestopApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async list(area?: Bbox, status?: PokestopStatus): Promise<Pokestop[]> {
    const bbox = area ? `&bbox=${area.west},${area.south},${area.east},${area.north}` : '';
    const byStatus = status ? `&status=${status}` : '';
    return this.allPages<PokestopDto>((page) => `/pokestops?pageSize=${PAGE_SIZE}&page=${page}${bbox}${byStatus}`, toPokestop);
  }

  async listInteractions(): Promise<Pokestop[]> {
    return this.allPages<PokestopDto>((page) => `/me/interactions?pageSize=${PAGE_SIZE}&page=${page}`, toPokestop);
  }

  async get(id: number): Promise<Pokestop> {
    return toPokestop(await this.send<PokestopDto>('GET', `/pokestops/${id}`));
  }

  async listCollection(): Promise<Record<CharacterId, number>> {
    return this.send<Record<CharacterId, number>>('GET', '/me/collection');
  }

  async listPokemons(availableOnly = false): Promise<Pokemon[]> {
    const params = availableOnly ? new HttpParams().set('availableOnly', true) : undefined;
    const dtos = await this.send<PokemonDto[]>('GET', '/me/pokemons', undefined, params);
    return dtos.map(toPokemon);
  }

  async setStatus(id: number, status: PokestopStatus): Promise<Pokestop> {
    // Odrzucenie wymaga powodu (`note`). TODO (adaptacja): pole powodu w widoku moderacji.
    const note = status === 'rejected' ? 'Odrzucone przez administratora' : undefined;
    const dto = await this.send<PokestopDto>('PATCH', `/pokestops/${id}`, { status, note });
    return toPokestop(dto);
  }

  async manage(id: number, patch: PokestopPatch): Promise<Pokestop> {
    return toPokestop(await this.send<PokestopDto>('PATCH', `/pokestops/${id}`, patch));
  }

  async listTimeline(id: number): Promise<TimelineEntry[]> {
    const page = await this.send<PageDto<TimelineEntryDto>>('GET', `/pokestops/${id}/timeline?pageSize=${PAGE_SIZE}`);
    return page.results.map(toTimelineEntry);
  }

  async addUpdate(id: number, draft: UpdateDraft): Promise<TimelineEntry> {
    return toTimelineEntry(await this.send<TimelineEntryDto>('POST', `/pokestops/${id}/updates`, draft));
  }

  async editUpdate(id: number, updateId: number, draft: Partial<UpdateDraft>): Promise<TimelineEntry> {
    return toTimelineEntry(await this.send<TimelineEntryDto>('PATCH', `/pokestops/${id}/updates/${updateId}`, draft));
  }

  async deleteUpdate(id: number, updateId: number): Promise<void> {
    await this.send<void>('DELETE', `/pokestops/${id}/updates/${updateId}`);
  }

  async answerSurvey(id: number, answers: SurveyAnswers, position: Position): Promise<SurveyResult> {
    const dto = await this.send<SurveyResultDto>('POST', `/pokestops/${id}/survey-responses`, { position: { lat: position.lat, lng: position.lng }, answers });
    return toSurveyResult(dto);
  }

  async surveyResults(id: number): Promise<SurveyResults> {
    return toSurveyResults(await this.send<SurveyResultsDto>('GET', `/pokestops/${id}/survey-results`));
  }

  async vote(id: number, vote: 'for' | 'against', { pokemonId, position }: VoteContext): Promise<VoteResult> {
    const dto = await this.send<VoteResultDto>('POST', `/pokestops/${id}/vote`, { vote, pokemonId, position: { lat: position.lat, lng: position.lng } });
    return toVoteResult(dto);
  }

  async listComments(id: number, page: number, pageSize: number): Promise<CommentPage> {
    const result = await this.send<PageDto<CommentDto>>('GET', `/pokestops/${id}/comments?page=${page}&pageSize=${pageSize}`);
    return { total: result.count, items: result.results.map(toComment) };
  }

  async comment(id: number, text: string, parentId?: number): Promise<PokestopComment> {
    const dto = await this.send<CommentDto>('POST', `/pokestops/${id}/comments`, { text, ...(parentId ? { parentCommentId: parentId } : {}) });
    return toComment(dto);
  }

  async create(report: NewReport, position: Position): Promise<Pokestop> {
    const dto = await this.send<PokestopDto>('POST', '/pokestops', toNewPokestop(report, position));
    return toPokestop(dto);
  }

  /** Pobiera kolejne strony, aż uzbiera wszystkie wyniki (`count` z odpowiedzi). */
  private async allPages<D>(url: (page: number) => string, map: (dto: D) => Pokestop): Promise<Pokestop[]> {
    const result: Pokestop[] = [];
    for (let page = 1; ; page++) {
      const body = await this.send<PageDto<D>>('GET', url(page));
      result.push(...body.results.map(map));
      if (body.results.length === 0 || result.length >= body.count) return result;
    }
  }

  private async send<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, params?: HttpParams): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, `${this.base}${path}`, { body, params }));
    } catch (error) {
      throw toApiError(error);
    }
  }
}
