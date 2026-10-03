import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AppConfigService } from './config/app-config.service';

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

/** Rola zalogowanego użytkownika (przełączana ręcznie do czasu logowania z backendu). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storageKey = `${inject(AppConfigService).config.auth.storageKeyPrefix}.role`;
  readonly role = signal<Role>(this.load());
  readonly profile = computed(() => PROFILES[this.role()]);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(this.storageKey, this.role());
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
      const saved = localStorage.getItem(this.storageKey);
      return saved === 'org' || saved === 'admin' ? saved : 'resident';
    } catch {
      return 'resident';
    }
  }
}
