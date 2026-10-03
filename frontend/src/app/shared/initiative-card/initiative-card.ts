import { Component, computed, input, output } from '@angular/core';
import { CHARACTERS, POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { supportPercent } from '../../core/pokestop.utils';
import { StatusChip } from '../status-chip/status-chip';

/** Karta inicjatywy: tytuł, status, poparcie i ślad interakcji użytkownika. Akcje wstawiane przez `<ng-content>`. */
@Component({
  selector: 'app-initiative-card',
  imports: [StatusChip],
  templateUrl: './initiative-card.html',
  styleUrl: './initiative-card.css',
})
export class InitiativeCard {
  readonly stop = input.required<Pokestop>();
  readonly showInteraction = input(true);
  readonly opened = output<void>();

  protected readonly type = computed(() => POKESTOP_TYPES[this.stop().type]);
  protected readonly character = computed(() => CHARACTERS[this.stop().character]);
  protected readonly support = computed(() => supportPercent(this.stop()));
  protected readonly myComments = computed(() => this.stop().comments.filter((c) => c.mine).length);
}
