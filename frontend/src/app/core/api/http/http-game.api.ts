import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { AttackResult, Encounter, PlayerProgress, Position } from '../../game.model';
import { toApiError } from '../../http/api-error';
import { GameApi } from '../game.api';
import { AttackResultDto, EncounterDto, PlayerProgressDto } from './contract.types';
import { toAttackResult, toEncounter } from './pokestop.mapper';

/** Implementacja `GameApi` na prawdziwym backendzie (api.mode.game: http). */
@Injectable({ providedIn: 'root' })
export class HttpGameApi extends GameApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async getProgress(): Promise<PlayerProgress> {
    return this.request<PlayerProgressDto>('GET', '/me/progress');
  }

  async listEncounters(around: Position, radiusM: number): Promise<Encounter[]> {
    const params = new HttpParams().set('lat', around.lat).set('lng', around.lng).set('radius', radiusM);
    const dtos = await this.request<EncounterDto[]>('GET', '/encounters', undefined, params);
    return dtos.map(toEncounter);
  }

  async attack(id: number, position: Position, pokemonIds: number[]): Promise<AttackResult> {
    const dto = await this.request<AttackResultDto>('POST', `/encounters/${id}/attack`, { lat: position.lat, lng: position.lng, pokemonIds });
    return toAttackResult(dto);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, params?: HttpParams): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, `${this.base}${path}`, { body, params }));
    } catch (error) {
      throw toApiError(error);
    }
  }
}
