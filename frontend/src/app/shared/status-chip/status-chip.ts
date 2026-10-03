import { Component, computed, input } from '@angular/core';
import { PokestopStatus, STATUS_META } from '../../core/pokestop.model';

@Component({
  selector: 'app-status-chip',
  template: `<span class="chip" [style.--c]="meta().color">{{ meta().label }}</span>`,
  styles: `.chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .72rem; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 14%, white); white-space: nowrap; }`,
})
export class StatusChip {
  readonly status = input.required<PokestopStatus>();
  protected readonly meta = computed(() => STATUS_META[this.status()]);
}
