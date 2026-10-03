import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { AttackResult, Encounter, PlayerProgress, Position } from '../../game.model';
import { NotAdaptedYet, toApiError } from '../../http/api-error';
import { GameApi } from '../game.api';
import { PlayerProgressDto } from './contract.types';

/**
 * Implementacja `GameApi` na prawdziwym backendzie (api.mode.game: http).
 * Gotowe: postęp gracza. Przeciwnicy i walka czekają na backend (dziś 501) oraz na ekran wyboru drużyny.
 */
@Injectable({ providedIn: 'root' })
export class HttpGameApi extends GameApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async getProgress(): Promise<PlayerProgress> {
    try {
      return await firstValueFrom(this.http.get<PlayerProgressDto>(`${this.base}/me/progress`));
    } catch (error) {
      throw toApiError(error);
    }
  }

  async listEncounters(_around: Position): Promise<Encounter[]> {
    throw new NotAdaptedYet('przeciwnicy', 'Backend zwraca na razie 501 (GET /encounters). Po jego implementacji: GET /encounters?lat=&lng=.');
  }

  async attack(_id: number, _position: Position): Promise<AttackResult> {
    throw new NotAdaptedYet('atak', 'Backend wymaga pokemonIds (1-3 własne pokemony) i zwraca też wynik "lost". Zob. api-contract.md, punkt 10.');
  }
}
