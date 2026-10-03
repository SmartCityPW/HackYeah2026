import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/session.service';

/** Profil zaufanej organizacji. MOCK: dane statyczne, docelowo z backendu. */
@Component({
  selector: 'app-org-profile-page',
  templateUrl: './org-profile.page.html',
  styleUrl: './org-profile.page.css',
})
export class OrgProfilePage {
  protected readonly organization = inject(SessionService).profile().organization;
  protected readonly rows = [
    { label: 'Typ podmiotu', value: 'Organizacja pozarządowa (fundacja)' },
    { label: 'KRS', value: '0000123456' },
    { label: 'Osoba kontaktowa', value: 'Anna Kowalska' },
    { label: 'E-mail', value: 'kontakt@zielonemiasto.example' },
  ];
}
