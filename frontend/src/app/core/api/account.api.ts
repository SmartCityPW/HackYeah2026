import { Role } from '../session.service';

export type VerificationStatus = 'pending' | 'verified' | 'suspended';
export type OrganizationKind = 'ngo' | 'foundation' | 'association' | 'city_office' | 'district_council' | 'municipality' | 'other';

/** Organizacja z danymi kontaktowymi (widzi je tylko ona sama i administrator). */
export interface OrganizationInfo {
  id: number;
  name: string;
  kind: OrganizationKind;
  krs: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  verificationStatus: VerificationStatus;
}

/** Profil zalogowanego użytkownika (GET /me). */
export interface Me {
  id: number;
  displayName: string;
  role: Role;
  isGuest: boolean;
  /** Organizacja użytkownika z rolą `org`, w pozostałych przypadkach null. */
  organization: OrganizationInfo | null;
}

export interface Credentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface OrganizationRegistration extends Credentials {
  organization: {
    name: string;
    kind: OrganizationKind;
    krs?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
}

/**
 * Konto użytkownika i organizacje. `me()` zwraca null, gdy profil nie pochodzi z backendu (mock): wtedy rolę
 * wybiera przełącznik deweloperski, a logowanie i rejestracja nie są dostępne.
 *
 *   me                           GET   /me
 *   login                        POST  /auth/login
 *   register                     POST  /auth/register
 *   registerOrganization         POST  /auth/register-organization
 *   upgrade                      POST  /auth/upgrade                  (gość zapisuje postęp)
 *   logout                       (lokalnie: usunięcie tokenów)
 *   myOrganization               GET   /me/organization
 *   listOrganizations            GET   /admin/organizations?verificationStatus=
 *   setOrganizationVerification  PATCH /admin/organizations/{id}
 */
export abstract class AccountApi {
  abstract me(): Promise<Me | null>;
  /** Po powodzeniu tokeny są zapisane, a wywołujący przeładowuje aplikację, żeby wczytać nowego użytkownika. */
  abstract login(credentials: Credentials): Promise<void>;
  abstract register(credentials: Credentials): Promise<void>;
  abstract registerOrganization(registration: OrganizationRegistration): Promise<void>;
  /** Zachowuje głosy, kolekcję i XP gościa. */
  abstract upgrade(credentials: Credentials): Promise<void>;
  abstract logout(): Promise<void>;
  abstract myOrganization(): Promise<OrganizationInfo | null>;
  abstract listOrganizations(status?: VerificationStatus): Promise<OrganizationInfo[]>;
  abstract setOrganizationVerification(id: number, status: VerificationStatus): Promise<OrganizationInfo>;
}
