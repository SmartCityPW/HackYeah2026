import { Component, computed, input } from '@angular/core';
import { PokestopStatus, STATUS_META } from '../../core/pokestop.model';

/** Status pinezki: ikona + etykieta w kolorach palety (znaczenie nie zależy od samej barwy). */
@Component({
  selector: 'app-status-chip',
  template: `<span class="chip" [style.--bg]="meta().bg" [style.--fg]="meta().fg"><span aria-hidden="true">{{ meta().icon }}</span> {{ meta().label }}</span>`,
  styles: `.chip { display: inline-block; padding: 2px 10px; border-radius: var(--radius-s); font-size: .72rem; font-weight: 700; color: var(--fg); background: var(--bg); white-space: nowrap; }`,
})
export class StatusChip {
  readonly status = input.required<PokestopStatus>();
  protected readonly meta = computed(() => STATUS_META[this.status()]);
}
