import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { AttackResult, Encounter, PlayerPosition, PlayerProgress } from '../../game.model';
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

  async listEncounters(around: PlayerPosition, radiusM: number): Promise<Encounter[]> {
    let params = new HttpParams().set('lat', around.lat).set('lng', around.lng).set('radius', radiusM);
    if (around.accuracyM !== undefined) params = params.set('accuracyM', around.accuracyM);
    if (around.takenAt !== undefined) params = params.set('takenAt', around.takenAt);
    if (around.source !== undefined) params = params.set('source', around.source);
    const dtos = await this.request<EncounterDto[]>('GET', '/encounters', undefined, params);
    return dtos.map(toEncounter);
  }

  async attack(id: number, position: PlayerPosition, pokemonIds: number[]): Promise<AttackResult> {
    // Atak ma płaskie ciało (kontrakt: `AttackRequest`): czas odczytu to `clientTime`.
    const dto = await this.request<AttackResultDto>('POST', `/encounters/${id}/attack`, {
      lat: position.lat, lng: position.lng, pokemonIds,
      ...(position.accuracyM !== undefined ? { accuracyM: position.accuracyM } : {}),
      ...(position.takenAt !== undefined ? { clientTime: position.takenAt } : {}),
      ...(position.source !== undefined ? { source: position.source } : {}),
    });
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
