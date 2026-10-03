import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountApi } from '../../core/api/account.api';
import { describeError } from '../../core/http/api-error';
import { AppConfigService } from '../../core/config/app-config.service';
import { ROLE_HOME } from '../../core/navigation';
import { Role, SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';

const ROLE_LABEL = { resident: 'Mieszkaniec', org: 'Organizacja', admin: 'Administrator' } as const;
const ROLES: Role[] = ['resident', 'org', 'admin'];

/** Konto: kim jestem, czy jestem gościem, jak zapisać postęp, zalogować się albo wylogować. Używane na ekranach wszystkich ról. */
@Component({
  selector: 'app-account-panel',
  imports: [RouterLink],
  templateUrl: './account-panel.html',
  styleUrl: './account.css',
})
export class AccountPanel {
  private readonly api = inject(AccountApi);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionService);

  protected readonly roleLabel = computed(() => ROLE_LABEL[this.session.role()]);
  protected readonly busy = signal(false);
  private readonly router = inject(Router);
  /** Tryb deweloperski na atrapie konta: przełącznik widoku (rola z backendu nie jest przełączalna). */
  private readonly devTools = inject(AppConfigService).config.dev.tools;
  protected readonly roleSwitch = computed(() => this.devTools && this.session.roleSwitchable());
  protected readonly roles = ROLES.map((role) => ({ role, label: ROLE_LABEL[role] }));

  protected switchRole(role: Role): void {
    this.session.setRole(role);
    void this.router.navigateByUrl(ROLE_HOME[role]);
  }

  protected async logout(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.logout();
      this.session.restart('/'); // nowy gość zakłada się przy starcie aplikacji
    } catch (error) {
      this.toast.show(describeError(error));
      this.busy.set(false);
    }
  }
}
