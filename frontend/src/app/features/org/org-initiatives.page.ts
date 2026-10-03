import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MAP_PATH } from '../../core/navigation';
import { PokestopService } from '../../core/pokestop.service';
import { supportPercent } from '../../core/pokestop.utils';
import { describeError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { InitiativeCard } from '../../shared/initiative-card/initiative-card';

/** Inicjatywy opublikowane przez organizację wraz z podsumowaniem poparcia mieszkańców. */
@Component({
  selector: 'app-org-initiatives-page',
  imports: [InitiativeCard],
  templateUrl: './org-initiatives.page.html',
})
export class OrgInitiativesPage {
  private readonly pokestops = inject(PokestopService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  constructor() {
    void this.pokestops.loadAll().catch((error) => this.toast.show(describeError(error)));
  }

  protected readonly items = computed(() => {
    const organization = this.session.profile().organization;
    return this.pokestops.stops().filter((s) => s.organization === organization);
  });
  protected readonly totalVotes = computed(() => this.items().reduce((sum, s) => sum + s.votesFor + s.votesAgainst, 0));
  protected readonly totalComments = computed(() => this.items().reduce((sum, s) => sum + (s.commentCount ?? s.comments.length), 0));
  protected readonly averageSupport = computed(() => {
    const voted = this.items().filter((s) => s.votesFor + s.votesAgainst > 0);
    return voted.length ? Math.round(voted.reduce((sum, s) => sum + supportPercent(s), 0) / voted.length) : 0;
  });

  protected showOnMap(id: number): void {
    void this.router.navigate([MAP_PATH[this.session.role()]], { queryParams: { stop: id } });
  }
}
