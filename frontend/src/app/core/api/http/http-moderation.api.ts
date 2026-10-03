import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { toApiError } from '../../http/api-error';
import { ModerationEntry, ModerationPage, ModerationQuery } from '../../moderation.model';
import { ModerationApi } from '../moderation.api';

interface PageDto {
  count: number;
  results: ModerationEntry[];
}

/** `GET /admin/moderation-log` (api.mode.pokestops: http). */
@Injectable({ providedIn: 'root' })
export class HttpModerationApi extends ModerationApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async list({ verdicts, since, pageSize }: ModerationQuery): Promise<ModerationPage> {
    let params = new HttpParams().set('verdict', verdicts.join(','));
    if (since) params = params.set('since', since);
    if (pageSize) params = params.set('pageSize', pageSize);
    try {
      const page = await firstValueFrom(this.http.get<PageDto>(`${this.base}/admin/moderation-log`, { params }));
      return { count: page.count, items: page.results };
    } catch (error) {
      throw toApiError(error);
    }
  }
}
