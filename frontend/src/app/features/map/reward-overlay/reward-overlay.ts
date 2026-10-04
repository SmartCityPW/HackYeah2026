import { Component, input, output } from '@angular/core';
import { Pokemon } from '../../../core/pokemon.model';
import { Reward } from '../../../shared/reward/reward';

/** Ekran nagrody nad mapą (po odebraniu pokemona z wydarzenia): ściemnione tło i arkusz z `app-reward`. */
@Component({
  selector: 'app-reward-overlay',
  imports: [Reward],
  template: `
    <section class="sheet" role="dialog" aria-label="Nowy Spryciak">
      <app-reward [pokemon]="pokemon()" [kicker]="kicker()" [heading]="heading()" [note]="note()" (closed)="closed.emit()" />
    </section>
  `,
  styles: `
    :host {
      position: absolute; inset: 0; z-index: 20; display: flex; align-items: flex-end; justify-content: center;
      background: linear-gradient(color-mix(in srgb, var(--color-plum) 15%, transparent), color-mix(in srgb, var(--color-plum) 75%, transparent));
    }
    .sheet {
      width: 100%; max-width: 560px; max-height: 90dvh; overflow-y: auto; box-sizing: border-box; padding: 18px 18px 24px;
      background: var(--surface); border-radius: 0; clip-path: var(--cut-tl); border-top: 6px solid var(--accent); box-shadow: 0 -8px 30px var(--shadow-strong);
    }
  `,
})
export class RewardOverlay {
  readonly pokemon = input.required<Pokemon>();
  readonly kicker = input('');
  readonly heading = input('Wpadł Ci nowy Spryciak!');
  readonly note = input('Dołączył do Twoich Spryciaków. Zdobywa exp, gdy głosujesz, i pomaga w walkach.');
  readonly closed = output<void>();
}
