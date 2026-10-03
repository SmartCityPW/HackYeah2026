import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountApi } from '../../core/api/account.api';
import { FieldErrors, optional, validateCredentials } from '../../core/account.utils';
import { AppConfigService } from '../../core/config/app-config.service';
import { describeError, toApiError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';

/**
 * Rejestracja mieszkańca. Gość nie zakłada nowego konta, tylko zapisuje to, które ma (POST /auth/upgrade):
 * zachowuje głosy, kolekcję i XP. Ktoś, kto jest już zalogowany, formularza nie widzi.
 */
@Component({
  selector: 'app-register-page',
  imports: [RouterLink],
  templateUrl: './register.page.html',
  styleUrl: '../../shared/account/account.css',
})
export class RegisterPage {
  private readonly api = inject(AccountApi);
  protected readonly session = inject(SessionService);
  protected readonly passwordMinLength = inject(AppConfigService).config.auth.passwordMinLength;

  protected readonly displayName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly attempted = signal(false);
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<FieldErrors>({});
  protected readonly formError = signal<string | null>(null);
  /** Zapis postępu gościa (upgrade) zamiast zakładania nowego konta. */
  protected readonly savingProgress = this.session.isGuest;
  /** Zalogowany użytkownik (nie gość) nie rejestruje się ponownie. */
  protected readonly alreadySignedIn = computed(() => this.session.hasAccounts() && !this.session.isGuest());

  private readonly values = computed(() => ({ email: this.email(), password: this.password(), displayName: this.displayName() }));
  protected readonly errors = computed<FieldErrors>(() =>
    this.attempted() ? { ...validateCredentials(this.values(), this.passwordMinLength), ...this.serverErrors() } : {},
  );

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    this.serverErrors.set({});
    this.formError.set(null);
    if (Object.keys(validateCredentials(this.values(), this.passwordMinLength)).length || this.busy()) return;
    this.busy.set(true);
    const credentials = { email: this.email().trim(), password: this.password(), displayName: optional(this.displayName()) };
    try {
      if (this.savingProgress()) await this.api.upgrade(credentials);
      else await this.api.register(credentials);
      this.session.restart('/konto');
    } catch (error) {
      const e = toApiError(error);
      this.serverErrors.set(e.fields);
      this.formError.set(describeError(e));
      this.busy.set(false);
    }
  }
}
