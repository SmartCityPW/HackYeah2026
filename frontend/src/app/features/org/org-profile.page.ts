import { Component, computed, inject } from '@angular/core';
import { organizationKindLabel, VERIFICATION_META } from '../../core/account.utils';
import { describeError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { AccountPanel } from '../../shared/account/account-panel';

/** Profil organizacji z backendu (typ, KRS, kontakt) i jej status weryfikacji; niżej konto (wylogowanie). */
@Component({
  selector: 'app-org-profile-page',
  imports: [AccountPanel],
  templateUrl: './org-profile.page.html',
  styleUrl: './org-profile.page.css',
})
export class OrgProfilePage {
  private readonly session = inject(SessionService);
  protected readonly organization = this.session.organization;
  protected readonly name = computed(() => this.organization()?.name ?? this.session.profile().organization);
  protected readonly status = computed(() => {
    const status = this.organization()?.verificationStatus;
    return status ? { key: status, ...VERIFICATION_META[status] } : null;
  });
  /** Tylko wypełnione dane (puste pola nie zajmują miejsca). */
  protected readonly rows = computed(() => {
    const o = this.organization();
    if (!o) return [];
    return [
      { label: 'Typ podmiotu', value: organizationKindLabel(o.kind) },
      { label: 'KRS', value: o.krs },
      { label: 'Osoba kontaktowa', value: o.contactPerson },
      { label: 'E-mail', value: o.contactEmail },
      { label: 'Telefon', value: o.contactPhone },
    ].filter((r): r is { label: string; value: string } => !!r.value);
  });

  constructor() {
    // Status mógł się zmienić od startu aplikacji (administrator zweryfikował organizację), więc odświeżamy go po wejściu.
    const toast = inject(ToastService);
    void this.session.refreshOrganization().catch((error) => toast.show(describeError(error)));
  }
}
