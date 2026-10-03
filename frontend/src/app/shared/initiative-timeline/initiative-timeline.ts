import { Component, input, output } from '@angular/core';
import { formatDateTime } from '../../core/date.utils';
import { STATUS_META, TimelineEntry } from '../../core/pokestop.model';
import { StatusChip } from '../status-chip/status-chip';

/**
 * Losy inicjatywy jako oś czasu (najnowsze na górze): wpisy organizatora, zmiany statusu i narodziny inicjatywy.
 * Przyciski edycji i usuwania pojawiają się tylko przy wpisach, które serwer oznaczył jako `editable`, i gdy `manageable`.
 */
@Component({
  selector: 'app-initiative-timeline',
  imports: [StatusChip],
  templateUrl: './initiative-timeline.html',
  styleUrl: './initiative-timeline.css',
})
export class InitiativeTimeline {
  readonly entries = input.required<TimelineEntry[]>();
  readonly loading = input(false);
  readonly manageable = input(false);
  readonly edit = output<TimelineEntry>();
  readonly remove = output<TimelineEntry>();

  protected readonly format = formatDateTime;
  protected readonly meta = STATUS_META;
}
