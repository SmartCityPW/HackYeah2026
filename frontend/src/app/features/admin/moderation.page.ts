import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAP_PATH } from '../../core/navigation';
import { PokestopService } from '../../core/pokestop.service';
import { PokestopStatus, STATUS_META } from '../../core/pokestop.model';
import { describeError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { ModerationService } from '../../core/moderation.service';
import { InitiativeCard } from '../../shared/initiative-card/initiative-card';
import { AiRejections } from './ai-rejections/ai-rejections';

type Filter = PokestopStatus | 'all';

/** Moderacja: przegląd wszystkich zgłoszeń i zmiana ich statusu. */
@Component({
  selector: 'app-moderation-page',
  imports: [InitiativeCard, AiRejections],
  templateUrl: './moderation.page.html',
  styles: `
    .tabs { display: flex; gap: 6px; margin: 0 0 14px; padding: 3px; border-radius: 12px; background: var(--tint); }
    .tabs button { flex: 1; border: 0; border-radius: 10px; padding: 9px 10px; background: transparent; font: inherit; color: var(--text); cursor: pointer; }
    .tabs button.on { background: var(--surface); font-weight: 700; box-shadow: 0 1px 3px var(--shadow); }
    .tabs .count { margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: var(--accent-strong); color: var(--on-strong); font-size: .75rem; font-weight: 800; }
  `,
})
export class ModerationPage {
  private readonly pokestops = inject(PokestopService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly moderation = inject(ModerationService);
  /** `?karta=ai` otwiera zakładkę odrzuceń AI (np. z odnośnika w komunikacie). */
  readonly karta = input<string>();
  protected readonly tab = linkedSignal<'reports' | 'ai'>(() => (this.karta() === 'ai' ? 'ai' : 'reports'));

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
