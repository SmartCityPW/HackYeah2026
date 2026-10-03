import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NAV_ITEMS, ROLE_HOME } from '../../core/navigation';
import { Role, SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { Navbar } from '../../shared/navbar/navbar';

const ROLES: { role: Role; label: string }[] = [
  { role: 'resident', label: '👤 Mieszkaniec' },
  { role: 'org', label: '🏢 Zaufana organizacja' },
  { role: 'admin', label: '🛡️ Administrator' },
];

/** Powłoka aplikacji: treść aktualnego widoku (router-outlet) + dolny pasek nawigacji dla roli. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Navbar],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);

  protected readonly role = this.session.role;
  protected readonly navItems = computed(() => NAV_ITEMS[this.session.role()]);
  protected readonly roles = ROLES;

  /** Tryb deweloperski: przełączanie widoku do czasu logowania z backendu. */
  protected switchRole(role: Role): void {
    this.session.setRole(role);
    void this.router.navigateByUrl(ROLE_HOME[role]);
  }
}
