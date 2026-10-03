import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountApi } from './api/account.api';
import { AppConfigService } from './config/app-config.service';

export type Role = 'resident' | 'org' | 'admin';

export interface Profile {
  displayName: string;
  /** Nazwa organizacji dla roli `org`, w pozostałych przypadkach null. */
  organization: string | null;
}

// MOCK: profile przypisane do ról, gdy konto nie pochodzi z backendu (api.mode.account: mock).
const PROFILES: Record<Role, Profile> = {
  resident: { displayName: 'Ty', organization: null },
  org: { displayName: 'Fundacja Zielone Miasto', organization: 'Fundacja Zielone Miasto' },
  admin: { displayName: 'Administrator', organization: null },
};

/**
 * Rola i profil zalogowanego użytkownika. Z backendem (`api.mode.account: http`) pochodzą z GET /me
 * i nie da się ich zmienić z poziomu aplikacji; w trybie mock rolę przełącza się ręcznie (narzędzia deweloperskie).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(AccountApi);
  private readonly storageKey = `${inject(AppConfigService).config.auth.storageKeyPrefix}.role`;
  private readonly remoteProfile = signal<Profile | null>(null);

  readonly role = signal<Role>(this.load());
  readonly profile = computed(() => this.remoteProfile() ?? PROFILES[this.role()]);
  /** Czy rolę da się przełączyć ręcznie (tylko gdy konto nie pochodzi z backendu). */
  readonly roleSwitchable = signal(true);
  readonly isGuest = signal(false);

  constructor() {
    effect(() => {
      if (!this.roleSwitchable()) return;
      try {
        localStorage.setItem(this.storageKey, this.role());
      } catch {
        /* localStorage może być niedostępny (tryb prywatny) */
      }
    });
  }

  /** Wywoływane przy starcie aplikacji (po założeniu konta gościa): pobiera rolę i profil z backendu, jeśli on jest źródłem. */
  async init(): Promise<void> {
    const me = await this.api.me();
    if (!me) return;
    this.roleSwitchable.set(false);
    this.role.set(me.role);
    this.remoteProfile.set({ displayName: me.displayName, organization: me.organization });
    this.isGuest.set(me.isGuest);
  }

  setRole(role: Role): void {
    if (this.roleSwitchable()) this.role.set(role);
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
