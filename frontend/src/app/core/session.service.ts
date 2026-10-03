import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountApi, OrganizationInfo } from './api/account.api';
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
 * i nie da się ich zmienić z poziomu aplikacji (zmienia je logowanie); w trybie mock rolę przełącza się ręcznie
 * (narzędzia deweloperskie).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(AccountApi);
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = `${inject(AppConfigService).config.auth.storageKeyPrefix}.role`;
  private readonly remoteProfile = signal<Profile | null>(null);

  readonly role = signal<Role>(this.load());
  readonly profile = computed(() => this.remoteProfile() ?? PROFILES[this.role()]);
  /** Czy rolę da się przełączyć ręcznie (tylko gdy konto nie pochodzi z backendu). */
  readonly roleSwitchable = signal(true);
  /** Czy działają prawdziwe konta (logowanie, rejestracja). W trybie mock nie. */
  readonly hasAccounts = computed(() => !this.roleSwitchable());
  readonly isGuest = signal(false);
  /** Organizacja zalogowanego użytkownika z rolą `org` (z backendu); null w pozostałych przypadkach i w trybie mock. */
  readonly organization = signal<OrganizationInfo | null>(null);
  /**
   * Czy można publikować inicjatywy organizacji. Backend odmawia (403 `organization_not_verified`), dopóki administrator
   * nie zweryfikuje organizacji, więc interfejs nie zachęca do czegoś, co się nie uda. Dla pozostałych ról zawsze true.
   */
  readonly canPublishInitiatives = computed(
    () => this.role() !== 'org' || !this.hasAccounts() || this.organization()?.verificationStatus === 'verified',
  );

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
    this.organization.set(me.organization);
    this.remoteProfile.set({ displayName: me.displayName, organization: me.organization?.name ?? null });
    this.isGuest.set(me.isGuest);
  }

  /** Odświeża dane organizacji (np. po weryfikacji przez administratora, która zmienia możliwość publikowania). */
  async refreshOrganization(): Promise<void> {
    if (this.role() !== 'org') return;
    const organization = await this.api.myOrganization();
    this.organization.set(organization);
    if (organization) this.remoteProfile.update((p) => (p ? { ...p, organization: organization.name } : p));
  }

  setRole(role: Role): void {
    if (this.roleSwitchable()) this.role.set(role);
  }

  /**
   * Po zmianie konta (logowanie, rejestracja, wylogowanie) przeładowujemy aplikację pod danym adresem. Dzięki temu nie zostaje
   * po poprzednim użytkowniku żaden stan (pinezki, pokemony, komentarze), a rolę i profil wczytuje start aplikacji.
   */
  restart(path: string): void {
    this.document.defaultView?.location.assign(path);
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
