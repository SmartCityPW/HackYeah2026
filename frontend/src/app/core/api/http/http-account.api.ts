import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { toApiError } from '../../http/api-error';
import { AccountApi, Me } from '../account.api';
import { MeDto } from './contract.types';

/** Implementacja `AccountApi` na prawdziwym backendzie (api.mode.account: http). */
@Injectable({ providedIn: 'root' })
export class HttpAccountApi extends AccountApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async me(): Promise<Me | null> {
    try {
      const dto = await firstValueFrom(this.http.get<MeDto>(`${this.base}/me`));
      return { id: dto.id, displayName: dto.displayName, role: dto.role, isGuest: dto.isGuest, organization: dto.organization?.name ?? null };
    } catch (error) {
      throw toApiError(error);
    }
  }
}
