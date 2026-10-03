import { Role } from '../session.service';

/** Profil zalogowanego użytkownika (GET /me). */
export interface Me {
  id: number;
  displayName: string;
  role: Role;
  isGuest: boolean;
  /** Nazwa organizacji dla roli `org`, w pozostałych przypadkach null. */
  organization: string | null;
}

/**
 * Konto użytkownika. `me()` zwraca null, gdy profil nie pochodzi z backendu (mock): wtedy rolę
 * wybiera przełącznik deweloperski, a nie serwer.
 *
 *   me  GET /me
 */
export abstract class AccountApi {
  abstract me(): Promise<Me | null>;
}
