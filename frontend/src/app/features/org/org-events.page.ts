import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog.service';
import { describeEventState, formatEventPeriod } from '../../core/event.format';
import { GameEvent } from '../../core/event.model';
import { EventService } from '../../core/event.service';
import { TYPES } from '../../core/game.model';
import { describeError } from '../../core/http/api-error';
import { MAP_PATH } from '../../core/navigation';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';

type Filter = 'current' | 'past' | 'cancelled';

/** Okno czasu listy własnych wydarzeń (dni wstecz i w przód). Wartość pokazowa: backend ogranicza okno tylko parametrami `from`/`to`. */
const WINDOW_DAYS = 365;

/** Wydarzenia zaufanego podmiotu: stan, uczestnicy i odwoływanie. Nowe wydarzenie tworzy się z mapy (miejsce wskazuje jej środek). */
@Component({
  selector: 'app-org-events-page',
  templateUrl: './org-events.page.html',
  styleUrl: './org-events.page.css',
})
export class OrgEventsPage {
  private readonly events = inject(EventService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly catalog = inject(CatalogService);

  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'current', label: 'Aktualne i zapowiedziane' },
    { id: 'past', label: 'Zakończone' },
    { id: 'cancelled', label: 'Odwołane' },
  ];
  protected readonly filter = signal<Filter>('current');
  protected readonly pendingCancel = signal<GameEvent | null>(null);
  protected readonly busy = signal(false);
  protected readonly loaded = signal(false);
  protected readonly types = TYPES;
  protected readonly period = formatEventPeriod;
  protected readonly state = describeEventState;

  protected readonly items = computed(() =>
    this.events
      .events()
      .filter((e) => e.mine)
      .filter((e) => (this.filter() === 'current' ? e.phase === 'upcoming' || e.phase === 'ongoing' : e.phase === (this.filter() === 'past' ? 'ended' : 'cancelled')))
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)),
  );

  constructor() {
    this.events
      .loadOwn(this.session.organization()?.id, WINDOW_DAYS)
      .then(() => this.loaded.set(true))
      .catch((error) => this.toast.show(describeError(error), '⚠️'));
  }

  protected reward(event: GameEvent) {
    const c = this.catalog.character(event.rewardCharacter);
    return { label: `${c.emoji} ${c.label}`, type: TYPES[c.typeCode].label, power: c.basePower };
  }

  protected showOnMap(event: GameEvent): void {
    void this.router.navigate([MAP_PATH[this.session.role()]], { queryParams: { event: event.id } });
  }

  protected async confirmCancel(): Promise<void> {
    const event = this.pendingCancel();
    if (!event || this.busy()) return;
    this.busy.set(true);
    try {
      await this.events.cancel(event.id);
      this.pendingCancel.set(null);
      this.toast.show('Wydarzenie odwołane. Znika z mapy, a nagrody nie da się już odebrać.', '✅');
    } catch (error) {
      this.toast.show(describeError(error), '⚠️');
    } finally {
      this.busy.set(false);
    }
  }
}
