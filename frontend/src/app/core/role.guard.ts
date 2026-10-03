import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ROLE_HOME } from './navigation';
import { Role, SessionService } from './session.service';

/** Wpuszcza tylko użytkownika z daną rolą; resztę odsyła na ich stronę główną. */
export const roleGuard =
  (role: Role): CanActivateFn =>
  () => {
    const current = inject(SessionService).role();
    return current === role || inject(Router).createUrlTree([ROLE_HOME[current]]);
  };
