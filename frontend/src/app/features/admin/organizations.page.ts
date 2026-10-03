import { Component, computed, inject, signal } from '@angular/core';
import { AccountApi, OrganizationInfo, VerificationStatus } from '../../core/api/account.api';
import { organizationKindLabel, VERIFICATION_META } from '../../core/account.utils';
import { describeError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast.service';

type Filter = VerificationStatus | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'pending', label: '⏳ Oczekujące' },
  { id: 'verified', label: '✔ Zweryfikowane' },
  { id: 'suspended', label: '⛔ Zawieszone' },
];

/** Co administrator może zrobić z organizacją w danym statusie (etykieta przycisku i status docelowy). */
const ACTIONS: Record<VerificationStatus, { label: string; to: VerificationStatus; danger?: boolean }[]> = {
  pending: [{ label: 'Zweryfikuj', to: 'verified' }, { label: 'Zawieś', to: 'suspended', danger: true }],
  verified: [{ label: 'Zawieś', to: 'suspended', danger: true }],
  suspended: [{ label: 'Przywróć', to: 'verified' }],
};

/** Weryfikacja organizacji: tylko zweryfikowane mogą publikować inicjatywy, ankiety i wydarzenia. */
@Component({
  selector: 'app-organizations-page',
  templateUrl: './organizations.page.html',
  styleUrl: './organizations.page.css',
})
export class OrganizationsPage {
  private readonly api = inject(AccountApi);
  private readonly toast = inject(ToastService);

  protected readonly filters = FILTERS;
  protected readonly filter = signal<Filter>('all');
  protected readonly loaded = signal(false);
  protected readonly busyId = signal<number | null>(null);
  private readonly all = signal<OrganizationInfo[]>([]);
  /** Oczekujące na górze: to one wymagają decyzji. */
  protected readonly organizations = computed(() => {
    const order: Record<VerificationStatus, number> = { pending: 0, verified: 1, suspended: 2 };
    return this.all()
      .filter((o) => this.filter() === 'all' || o.verificationStatus === this.filter())
      .sort((a, b) => order[a.verificationStatus] - order[b.verificationStatus] || a.name.localeCompare(b.name, 'pl'));
  });
  protected readonly pendingCount = computed(() => this.all().filter((o) => o.verificationStatus === 'pending').length);

  constructor() {
    void this.load();
  }

  protected readonly meta = VERIFICATION_META;
  protected readonly actions = ACTIONS;
  protected readonly kindLabel = organizationKindLabel;

  protected contact(o: OrganizationInfo): string {
    return [o.contactPerson, o.contactEmail, o.contactPhone].filter((part) => !!part).join(' · ');
  }

  protected async set(id: number, status: VerificationStatus): Promise<void> {
    this.busyId.set(id);
    try {
      const updated = await this.api.setOrganizationVerification(id, status);
      this.all.update((list) => list.map((o) => (o.id === id ? updated : o)));
    } catch (error) {
      this.toast.show(describeError(error));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    try {
      this.all.set(await this.api.listOrganizations());
    } catch (error) {
      this.toast.show(describeError(error));
    }
    this.loaded.set(true);
  }
}
