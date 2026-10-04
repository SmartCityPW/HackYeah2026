import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { CheckInResult, EventQuery, GameEvent, NewEvent } from '../../event.model';
import { PlayerPosition } from '../../game.model';
import { toPositionDto } from '../../http/position.dto';
import { toApiError } from '../../http/api-error';
import { Bbox } from '../../pokestop.model';
import { EventApi } from '../event.api';
import { PageDto, PokemonDto } from './contract.types';
import { toPokemon } from './pokestop.mapper';

/** Maksymalny rozmiar strony (pokestops.max_page_size w backend/config/default.yaml). */
const PAGE_SIZE = 200;

interface CheckInDto {
  event: GameEvent;
  pokemon: PokemonDto;
}

/** `EventApi` na prawdziwym backendzie (api.mode.pokestops: http). */
@Injectable({ providedIn: 'root' })
export class HttpEventApi extends EventApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async list(area?: Bbox, query: EventQuery = {}): Promise<GameEvent[]> {
    const events: GameEvent[] = [];
    for (let page = 1; ; page++) {
      let params = new HttpParams().set('pageSize', PAGE_SIZE).set('page', page);
      if (area) params = params.set('bbox', `${area.west},${area.south},${area.east},${area.north}`);
      if (query.from) params = params.set('from', query.from);
      if (query.to) params = params.set('to', query.to);
      if (query.organizationId !== undefined) params = params.set('organizationId', query.organizationId);
      const body = await this.send<PageDto<GameEvent>>('GET', '/events', undefined, params);
      events.push(...body.results);
      if (body.results.length === 0 || events.length >= body.count) return events;
    }
  }

  get(id: number): Promise<GameEvent> {
    return this.send<GameEvent>('GET', `/events/${id}`);
  }

  create(event: NewEvent): Promise<GameEvent> {
    return this.send<GameEvent>('POST', '/events', event);
  }

  cancel(id: number): Promise<GameEvent> {
    return this.send<GameEvent>('PATCH', `/events/${id}`, { status: 'cancelled' });
  }

  async checkIn(id: number, position: PlayerPosition): Promise<CheckInResult> {
    const dto = await this.send<CheckInDto>('POST', `/events/${id}/check-in`, { position: toPositionDto(position) });
    return { event: dto.event, pokemon: toPokemon(dto.pokemon) };
  }

  private async send<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, params?: HttpParams): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, `${this.base}${path}`, { body, params }));
    } catch (error) {
      throw toApiError(error);
    }
  }
}
