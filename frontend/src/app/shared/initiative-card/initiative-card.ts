import { Component, computed, inject, input, output, signal } from '@angular/core';
import { describeError } from '../../core/http/api-error';
import { POKESTOP_TYPES, Pokestop, STATUS_MEANING, STATUS_META } from '../../core/pokestop.model';
import { PokestopService } from '../../core/pokestop.service';
import { supportPercent } from '../../core/pokestop.utils';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../icon/icon';
import { InitiativeTimeline } from '../initiative-timeline/initiative-timeline';
import { StatusChip } from '../status-chip/status-chip';

/**
 * Karta inicjatywy: tytuł, status, poparcie i ślad interakcji użytkownika. Rozwija się (`expandable`) i pokazuje, co znaczy status,
 * opis, pola własne organizatora oraz losy inicjatywy (oś czasu, pobierana przy pierwszym rozwinięciu).
 * Akcje wstawiane przez `<ng-content>` są zawsze widoczne; panel prowadzenia inicjatywy trafia do slotu `[manage]` w rozwinięciu.
 */
@Component({
  selector: 'app-initiative-card',
  imports: [StatusChip, InitiativeTimeline, Icon],
  templateUrl: './initiative-card.html',
  styleUrl: './initiative-card.css',
})
export class InitiativeCard {
  private readonly pokestops = inject(PokestopService);
  private readonly toast = inject(ToastService);

  readonly stop = input.required<Pokestop>();
  readonly showInteraction = input(true);
  /** Kliknięcie nagłówka rozwija kartę. Bez tego (np. moderacja) nagłówek od razu emituje `opened`. */
  readonly expandable = input(true);
  /** Czy w rozwinięciu pokazać oś czasu (panel organizatora ma własną, z edycją). */
  readonly showTimeline = input(true);
  /** Karta ma się od razu pojawić rozwinięta. */
  readonly startOpen = input(false);
  /** Przejście do inicjatywy na mapie. */
  readonly opened = output<void>();

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly type = computed(() => POKESTOP_TYPES[this.stop().type]);
  protected readonly support = computed(() => supportPercent(this.stop()));
  protected readonly myComments = computed(() => this.stop().comments.filter((c) => c.mine).length);
  protected readonly meaning = computed(() => ({ label: STATUS_META[this.stop().status].label, text: STATUS_MEANING[this.stop().status] }));
  protected readonly entries = computed(() => this.pokestops.timelines()[this.stop().id] ?? []);

  constructor() {
    queueMicrotask(() => {
      if (this.startOpen()) void this.toggle();
    });
  }

  protected async toggle(): Promise<void> {
    if (!this.expandable()) {
      this.opened.emit();
      return;
    }
    this.open.update((v) => !v);
    if (!this.open() || this.pokestops.timelines()[this.stop().id]) return;
    this.loading.set(true);
    try {
      await this.pokestops.loadTimeline(this.stop().id);
    } catch (error) {
      this.toast.show(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
