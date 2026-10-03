import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { toApiError } from '../../http/api-error';
import { AuthService, Tokens } from '../../http/auth.service';
import { AccountApi, Credentials, Me, OrganizationInfo, OrganizationRegistration, VerificationStatus } from '../account.api';
import { MeDto } from './contract.types';
import { toMe } from './pokestop.mapper';

/** Implementacja `AccountApi` na prawdziwym backendzie (api.mode.account: http). */
@Injectable({ providedIn: 'root' })
export class HttpAccountApi extends AccountApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async me(): Promise<Me | null> {
    return toMe(await this.send<MeDto>('GET', '/me'));
  }

  async login(credentials: Credentials): Promise<void> {
    this.auth.signIn(await this.send<Tokens>('POST', '/auth/login', credentials));
  }

  async register(credentials: Credentials): Promise<void> {
    this.auth.signIn(await this.send<Tokens>('POST', '/auth/register', credentials));
  }

  async registerOrganization(registration: OrganizationRegistration): Promise<void> {
    this.auth.signIn(await this.send<Tokens>('POST', '/auth/register-organization', registration));
  }

  async upgrade(credentials: Credentials): Promise<void> {
    await this.send<MeDto>('POST', '/auth/upgrade', credentials); // sesja gościa trwa, tokeny zostają
  }

  async logout(): Promise<void> {
    this.auth.signOut();
  }

  async myOrganization(): Promise<OrganizationInfo | null> {
    return this.send<OrganizationInfo>('GET', '/me/organization');
  }

  async listOrganizations(status?: VerificationStatus): Promise<OrganizationInfo[]> {
    const params = status ? new HttpParams().set('verificationStatus', status) : undefined;
    return this.send<OrganizationInfo[]>('GET', '/admin/organizations', undefined, params);
  }

  async setOrganizationVerification(id: number, status: VerificationStatus): Promise<OrganizationInfo> {
    return this.send<OrganizationInfo>('PATCH', `/admin/organizations/${id}`, { verificationStatus: status });
  }

  private async send<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, params?: HttpParams): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, `${this.base}${path}`, { body, params }));
    } catch (error) {
      throw toApiError(error);
    }
  }
}
