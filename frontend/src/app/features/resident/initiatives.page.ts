import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAP_PATH } from '../../core/navigation';
import { PokestopService } from '../../core/pokestop.service';
import { Pokestop, PokestopStatus, STATUS_MEANING } from '../../core/pokestop.model';
import { describeError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { InitiativeCard } from '../../shared/initiative-card/initiative-card';
import { StatusChip } from '../../shared/status-chip/status-chip';

type Filter = 'all' | 'mine' | 'voted' | 'resolved';

const FILTERS: { id: Filter; label: string; matches: (s: Pokestop) => boolean }[] = [
  { id: 'all', label: 'Wszystkie', matches: () => true },
  { id: 'mine', label: 'Moje zgłoszenia', matches: (s) => !!s.mine },
  { id: 'voted', label: 'Oddane głosy', matches: (s) => s.myVote !== null },
  { id: 'resolved', label: 'Załatwione', matches: (s) => s.status === 'resolved' },
];

/** Stan inicjatyw, z którymi użytkownik miał styczność (zgłosił, zagłosował, skomentował). */
@Component({
  selector: 'app-initiatives-page',
  imports: [InitiativeCard, StatusChip],
  templateUrl: './initiatives.page.html',
  styles: `
    .legend { margin: 0 0 14px; padding: 10px 12px; border-radius: var(--radius-s); background: var(--surface); font-size: .9rem; }
    .legend summary { cursor: pointer; font-weight: 700; color: var(--brand-strong); }
    .legend dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 12px; margin: 10px 0 0; align-items: start; }
    .legend dd { margin: 0; }
  `,
})
export class InitiativesPage {
  private readonly pokestops = inject(PokestopService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  constructor() {
    void this.pokestops.loadInteractions().catch((error) => this.toast.show(describeError(error)));
  }

  protected readonly filters = FILTERS;
  protected readonly statuses = (Object.keys(STATUS_MEANING) as PokestopStatus[]).map((status) => ({ status, meaning: STATUS_MEANING[status] }));
  protected readonly filter = signal<Filter>('all');
  protected readonly items = computed(() => {
    const matches = FILTERS.find((f) => f.id === this.filter())!.matches;
    return this.pokestops.interactions().filter(matches);
  });

  protected showOnMap(id: number): void {
    void this.router.navigate([MAP_PATH[this.session.role()]], { queryParams: { stop: id } });
  }
}
