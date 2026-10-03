import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountApi } from '../../core/api/account.api';
import { FieldErrors, validateLogin } from '../../core/account.utils';
import { ApiHttpError, describeError, toApiError } from '../../core/http/api-error';
import { ROLE_HOME } from '../../core/navigation';
import { SessionService } from '../../core/session.service';

/** Logowanie. Po sukcesie aplikacja przeładowuje się jako zalogowany użytkownik (rola z GET /me). */
@Component({
  selector: 'app-login-page',
  imports: [RouterLink],
  templateUrl: './login.page.html',
  styleUrl: '../../shared/account/account.css',
})
export class LoginPage {
  private readonly api = inject(AccountApi);
  protected readonly session = inject(SessionService);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly attempted = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<FieldErrors>({});
  protected readonly formError = signal<string | null>(null);
  protected readonly errors = computed<FieldErrors>(() =>
    this.attempted() ? { ...validateLogin({ email: this.email(), password: this.password() }), ...this.serverErrors() } : {},
  );

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    this.serverErrors.set({});
    this.formError.set(null);
    if (Object.keys(validateLogin({ email: this.email(), password: this.password() })).length || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.login({ email: this.email().trim(), password: this.password() });
      this.session.restart(ROLE_HOME.resident); // strażnik ról przekieruje organizację i administratora na ich strony
    } catch (error) {
      const e: ApiHttpError = toApiError(error);
      this.serverErrors.set(e.fields);
      this.formError.set(describeError(e));
      this.busy.set(false);
    }
  }
}
