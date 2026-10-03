import { Component, signal } from '@angular/core';

interface OrganizationRow {
  name: string;
  kind: string;
  verified: boolean;
}

/** Weryfikacja organizacji. MOCK: lista lokalna, docelowo z backendu (po stronie API zmiana statusu zaufania). */
@Component({
  selector: 'app-organizations-page',
  templateUrl: './organizations.page.html',
  styleUrl: './organizations.page.css',
})
export class OrganizationsPage {
  protected readonly organizations = signal<OrganizationRow[]>([
    { name: 'Fundacja Zielone Miasto', kind: 'Fundacja', verified: true },
    { name: 'Urząd Miasta', kind: 'Jednostka samorządu', verified: true },
    { name: 'Stowarzyszenie Rowerowy Kraków', kind: 'Stowarzyszenie', verified: false },
    { name: 'Rada Dzielnicy III', kind: 'Jednostka pomocnicza', verified: false },
  ]);

  protected toggle(name: string): void {
    this.organizations.update((list) => list.map((o) => (o.name === name ? { ...o, verified: !o.verified } : o)));
  }
}
