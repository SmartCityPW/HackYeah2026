import { Component, computed, inject, input, output } from '@angular/core';
import { CatalogService } from '../../../core/catalog/catalog.service';
import { describeAge, describeEventState, formatEventPeriod } from '../../../core/event.format';
import { GameEvent } from '../../../core/event.model';
import { TYPES } from '../../../core/game.model';
import { Icon } from '../../../shared/icon/icon';
import { SpryciakModel } from '../../../shared/spryciak-model/spryciak-model';

/**
 * Karta wydarzenia "cool thing": zapowiedź (co to za wydarzenie, kto organizuje, jaki rzadki pokemon czeka), okres, stan i odbiór nagrody.
 * Opis można obejrzeć z każdej odległości i o każdej porze, ale pokemona odbiera się tylko w kółku i w godzinach wydarzenia
 * (przycisk jest wtedy aktywny, a w pozostałych przypadkach mówi, czego brakuje).
 */
@Component({
  selector: 'app-event-card',
  imports: [Icon, SpryciakModel],
  templateUrl: './event-card.html',
  styleUrl: './event-card.css',
})
export class EventCard {
  private readonly catalog = inject(CatalogService);

  readonly event = input.required<GameEvent>();
  /** Odległość gracza od wydarzenia w metrach; null, gdy nie znamy pozycji. */
  readonly distance = input<number | null>(null);
  readonly radius = input.required<number>();
  /** Odbierają mieszkańcy; organizacja i administrator tylko oglądają. */
  readonly canCollect = input(true);
  readonly busy = input(false);
  readonly closed = output<void>();
  readonly collect = output<void>();

  protected readonly types = TYPES;
  protected readonly reward = computed(() => this.catalog.character(this.event().rewardCharacter));
  protected readonly period = computed(() => formatEventPeriod(this.event()));
  protected readonly state = computed(() => describeEventState(this.event()));
  protected readonly age = computed(() => describeAge(this.event()));
  protected readonly inRange = computed(() => this.distance() !== null && this.distance()! <= this.radius());
  protected readonly full = computed(() => this.event().capacity !== null && this.event().participantCount >= this.event().capacity!);
  /** Co jeszcze stoi na przeszkodzie w odbiorze (null: można odebrać). */
  protected readonly blocker = computed<string | null>(() => {
    const e = this.event();
    if (e.checkedIn) return null;
    if (e.phase === 'ended' || e.phase === 'cancelled' || !e.activeNow) return null; // powód podaje zdanie o stanie
    if (this.distance() === null) return 'Włącz lokalizację. Nagrodę odbierzesz tylko na miejscu.';
    if (!this.inRange()) return `Jesteś ${this.distance()} m od miejsca. Podejdź na mniej niż ${this.radius()} m.`;
    if (this.full()) return 'Limit miejsc na tym wydarzeniu został wyczerpany.';
    return null;
  });
  protected readonly canPress = computed(() => this.canCollect() && this.event().activeNow && !this.event().checkedIn && this.inRange() && !this.full() && !this.busy());
}
