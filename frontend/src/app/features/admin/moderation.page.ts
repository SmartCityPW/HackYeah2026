import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAP_PATH } from '../../core/navigation';
import { PokestopService } from '../../core/pokestop.service';
import { PokestopStatus, STATUS_META } from '../../core/pokestop.model';
import { describeError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { InitiativeCard } from '../../shared/initiative-card/initiative-card';

type Filter = PokestopStatus | 'all';

/** Moderacja: przegląd wszystkich zgłoszeń i zmiana ich statusu. */
@Component({
  selector: 'app-moderation-page',
  imports: [InitiativeCard],
  templateUrl: './moderation.page.html',
})
export class ModerationPage {
  private readonly pokestops = inject(PokestopService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  constructor() {
    void this.pokestops.loadAll(true).catch((error) => this.toast.show(describeError(error)));
  }

  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Wszystkie' },
    ...(Object.keys(STATUS_META) as PokestopStatus[]).map((id) => ({ id, label: STATUS_META[id].label })),
  ];
  protected readonly filter = signal<Filter>('all');
  protected readonly items = computed(() =>
    this.pokestops.stops().filter((s) => this.filter() === 'all' || s.status === this.filter()),
  );

  protected setStatus(id: number, status: PokestopStatus): void {
    void this.pokestops.setStatus(id, status).catch((error) => this.toast.show(describeError(error)));
  }

  protected showOnMap(id: number): void {
    void this.router.navigate([MAP_PATH[this.session.role()]], { queryParams: { stop: id } });
  }
}
