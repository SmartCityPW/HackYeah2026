import { Injectable, effect, signal } from '@angular/core';
import { Audience } from './scenario.model';

const STORAGE_KEY = 'scgo.role';

/**
 * MOCK sesji: rola użytkownika przełączana ręcznie (do czasu logowania i ról z backendu).
 * Docelowo rola i organizacja przyjdą z API po zalogowaniu.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly role = signal<Audience>(this.load());
  readonly organizationName = 'Fundacja Zielone Miasto';

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.role());
      } catch {
        /* localStorage może być niedostępny (tryb prywatny) */
      }
    });
  }

  toggleRole(): void {
    this.role.update((r) => (r === 'resident' ? 'org' : 'resident'));
  }

  private load(): Audience {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'org' ? 'org' : 'resident';
    } catch {
      return 'resident';
    }
  }
}
