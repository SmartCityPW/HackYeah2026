import { Injectable } from '@angular/core';
import { ApiHttpError } from '../http/api-error';
import { AccountApi, Credentials, Me, OrganizationInfo, OrganizationRegistration, VerificationStatus } from './account.api';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const unavailable = () => new ApiHttpError(0, 'unavailable_in_mock', 'Konta działają po przełączeniu na backend (api.mode.account: http w app-config.yaml).');

const MOCK_ORGANIZATIONS: OrganizationInfo[] = [
  { id: 1, name: 'Fundacja Zielone Miasto', kind: 'foundation', krs: '0000123456', contactPerson: 'Anna Kowalska', contactEmail: 'kontakt@zielonemiasto.example', contactPhone: null, verificationStatus: 'verified' },
  { id: 2, name: 'Urząd Miasta', kind: 'city_office', krs: null, contactPerson: 'Biuro Konsultacji', contactEmail: 'konsultacje@miasto.example', contactPhone: null, verificationStatus: 'verified' },
  { id: 3, name: 'Stowarzyszenie Rowerowy Kraków', kind: 'association', krs: '0000654321', contactPerson: 'Piotr Nowak', contactEmail: 'biuro@rowerowy.example', contactPhone: '+48 600 100 200', verificationStatus: 'pending' },
  { id: 4, name: 'Rada Dzielnicy III', kind: 'district_council', krs: null, contactPerson: null, contactEmail: null, contactPhone: null, verificationStatus: 'pending' },
];

/**
 * Atrapa: brak konta z backendu, rolę wybiera przełącznik deweloperski (SessionService), a logowanie i rejestracja
 * zwracają jasny komunikat. Organizacje są w pamięci, żeby ekrany organizacji i administratora dało się pokazać bez backendu.
 */
@Injectable()
export class MockAccountApi extends AccountApi {
  private organizations: OrganizationInfo[] = clone(MOCK_ORGANIZATIONS);

  async me(): Promise<Me | null> {
    return null;
  }

  async login(_credentials: Credentials): Promise<void> {
    throw unavailable();
  }

  async register(_credentials: Credentials): Promise<void> {
    throw unavailable();
  }

  async registerOrganization(_registration: OrganizationRegistration): Promise<void> {
    throw unavailable();
  }

  async upgrade(_credentials: Credentials): Promise<void> {
    throw unavailable();
  }

  async logout(): Promise<void> {
    throw unavailable();
  }

  async myOrganization(): Promise<OrganizationInfo | null> {
    return clone(this.organizations[0]);
  }

  async listOrganizations(status?: VerificationStatus): Promise<OrganizationInfo[]> {
    return clone(this.organizations.filter((o) => !status || o.verificationStatus === status));
  }

  async setOrganizationVerification(id: number, status: VerificationStatus): Promise<OrganizationInfo> {
    const organization = this.organizations.find((o) => o.id === id);
    if (!organization) throw new ApiHttpError(404, 'not_found', 'Nie ma takiej organizacji.');
    organization.verificationStatus = status;
    return clone(organization);
  }
}
