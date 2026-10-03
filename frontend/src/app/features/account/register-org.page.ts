import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountApi, OrganizationKind } from '../../core/api/account.api';
import { FieldErrors, ORGANIZATION_KINDS, optional, validateOrganization } from '../../core/account.utils';
import { AppConfigService } from '../../core/config/app-config.service';
import { describeError, toApiError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';

/**
 * Rejestracja organizacji (NGO, samorząd). Konto powstaje od razu, ale organizacja ma status "czeka na weryfikację":
 * do czasu decyzji administratora widzi swój panel, a nie może publikować inicjatyw (backend: 403).
 */
@Component({
  selector: 'app-register-org-page',
  imports: [RouterLink],
  templateUrl: './register-org.page.html',
  styleUrl: '../../shared/account/account.css',
})
export class RegisterOrgPage {
  private readonly api = inject(AccountApi);
  protected readonly session = inject(SessionService);
  protected readonly passwordMinLength = inject(AppConfigService).config.auth.passwordMinLength;
  protected readonly kinds = ORGANIZATION_KINDS;

  protected readonly displayName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly name = signal('');
  protected readonly kind = signal<OrganizationKind | ''>('');
  protected readonly krs = signal('');
  protected readonly contactPerson = signal('');
  protected readonly contactEmail = signal('');
  protected readonly contactPhone = signal('');
  protected readonly attempted = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<FieldErrors>({});
  protected readonly formError = signal<string | null>(null);
  protected readonly alreadySignedIn = computed(() => this.session.hasAccounts() && !this.session.isGuest());

  private readonly registration = computed(() => ({
    email: this.email().trim(),
    password: this.password(),
    displayName: optional(this.displayName()),
    organization: {
      name: this.name().trim(),
      kind: this.kind() as OrganizationKind,
      krs: optional(this.krs()),
      contactPerson: optional(this.contactPerson()),
      contactEmail: optional(this.contactEmail()),
      contactPhone: optional(this.contactPhone()),
    },
  }));
  protected readonly errors = computed<FieldErrors>(() =>
    this.attempted() ? { ...validateOrganization(this.registration(), this.passwordMinLength), ...this.serverErrors() } : {},
  );

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    this.serverErrors.set({});
    this.formError.set(null);
    if (Object.keys(validateOrganization(this.registration(), this.passwordMinLength)).length || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.registerOrganization(this.registration());
      this.session.restart('/org/organizacja');
    } catch (error) {
      const e = toApiError(error);
      this.serverErrors.set(e.fields);
      this.formError.set(describeError(e));
      this.busy.set(false);
    }
  }
}
