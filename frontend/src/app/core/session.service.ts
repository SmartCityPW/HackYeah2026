import { Injectable, computed, effect, signal } from '@angular/core';

export type Role = 'resident' | 'org' | 'admin';

export interface Profile {
  displayName: string;
  /** Nazwa organizacji dla roli `org`, w pozostałych przypadkach null. */
  organization: string | null;
}

// MOCK: profile przypisane do ról. Docelowo profil i rola przyjdą z API po zalogowaniu.
const PROFILES: Record<Role, Profile> = {
  resident: { displayName: 'Ty', organization: null },
  org: { displayName: 'Fundacja Zielone Miasto', organization: 'Fundacja Zielone Miasto' },
  admin: { displayName: 'Administrator', organization: null },
};

const STORAGE_KEY = 'scgo.role';

/** Rola zalogowanego użytkownika (przełączana ręcznie do czasu logowania z backendu). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly role = signal<Role>(this.load());
  readonly profile = computed(() => PROFILES[this.role()]);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.role());
      } catch {
        /* localStorage może być niedostępny (tryb prywatny) */
      }
    });
  }

  setRole(role: Role): void {
    this.role.set(role);
  }

  private load(): Role {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'org' || saved === 'admin' ? saved : 'resident';
    } catch {
      return 'resident';
    }
  }
}
