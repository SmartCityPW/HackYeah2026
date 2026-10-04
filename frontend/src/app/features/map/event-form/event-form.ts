import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CatalogService } from '../../../core/catalog/catalog.service';
import { GameEvent, NewEvent } from '../../../core/event.model';
import { EventService } from '../../../core/event.service';
import { TYPES } from '../../../core/game.model';
import { describeError, toApiError } from '../../../core/http/api-error';
import { SpryciakModel } from '../../../shared/spryciak-model/spryciak-model';

type Errors = Record<string, string>;

/** Wartość pola `datetime-local` ("2026-10-10T10:00", czas lokalny przeglądarki) -> ISO 8601. */
export function toIso(local: string): string {
  return new Date(local).toISOString();
}

/** `datetime-local` dla chwili `date` (czas lokalny, bez sekund). */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Formularz wydarzenia "cool thing" dla zaufanego podmiotu. Miejsce wskazuje środek mapy (`location`), a nie pozycja organizatora,
 * więc wydarzenie można zaplanować gdziekolwiek. Nagrodę (rzadki Spryciak) wybiera się z katalogu gatunków wyłącznych dla wydarzeń.
 * Okres to dzień lub dni plus (opcjonalnie) godziny dzienne, w których można odebrać nagrodę.
 */
@Component({
  selector: 'app-event-form',
  imports: [SpryciakModel],
  templateUrl: './event-form.html',
  styleUrl: './event-form.css',
})
export class EventForm {
  private readonly events = inject(EventService);
  private readonly catalog = inject(CatalogService);

  /** Miejsce wydarzenia (środek mapy); null, dopóki mapa nie jest gotowa. */
  readonly location = input<{ lat: number; lng: number } | null>(null);
  readonly cancelled = output<void>();
  readonly created = output<GameEvent>();

  protected readonly types = TYPES;
  /** Rzadkie gatunki do wyboru (wyłączne dla wydarzeń). */
  protected readonly rewards = computed(() => this.catalog.characters().filter((c) => c.isEventExclusive));

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly address = signal('');
  protected readonly startsAt = signal(toLocalInput(nextFullHour(1)));
  protected readonly endsAt = signal(toLocalInput(nextFullHour(4)));
  protected readonly limitHours = signal(false);
  protected readonly dailyFrom = signal('10:00');
  protected readonly dailyTo = signal('18:00');
  protected readonly reward = signal<string | null>(null);
  protected readonly capacity = signal('');
  protected readonly ageMin = signal('');
  protected readonly ageMax = signal('');

  protected readonly errors = signal<Errors>({});
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly chosen = computed(() => this.rewards().find((c) => c.code === this.reward()) ?? null);

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Sprawdzenie przed wysłaniem (serwer i tak decyduje). */
  private validate(): Errors {
    const e: Errors = {};
    if (this.title().trim().length < 3) e['title'] = 'Tytuł ma mieć co najmniej 3 znaki';
    if (!this.startsAt()) e['startsAt'] = 'Podaj początek';
    if (!this.endsAt()) e['endsAt'] = 'Podaj koniec';
    else if (this.startsAt() && new Date(this.endsAt()) <= new Date(this.startsAt())) e['endsAt'] = 'Koniec musi być później niż początek';
    if (this.limitHours() && (!this.dailyFrom() || !this.dailyTo())) e['dailyFrom'] = 'Podaj obie godziny';
    else if (this.limitHours() && this.dailyFrom() >= this.dailyTo()) e['dailyTo'] = 'Godzina końca musi być późniejsza niż początku';
    if (!this.reward()) e['rewardCharacter'] = 'Wybierz rzadkiego pokemona, którego dostaną uczestnicy';
    if (this.ageMin() && this.ageMax() && Number(this.ageMin()) > Number(this.ageMax())) e['ageMax'] = 'Wiek maksymalny nie może być mniejszy niż minimalny';
    return e;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const local = this.validate();
    this.errors.set(local);
    this.formError.set(null);
    const where = this.location();
    if (Object.keys(local).length) return;
    if (!where) {
      this.formError.set('Poczekaj, aż mapa się wczyta: miejsce wydarzenia wskazuje jej środek.');
      return;
    }
    const draft: NewEvent = {
      title: this.title().trim(), description: this.description().trim(), address: this.address().trim() || undefined, lat: where.lat, lng: where.lng,
      startsAt: toIso(this.startsAt()), endsAt: toIso(this.endsAt()), rewardCharacter: this.reward()!,
      ...(this.limitHours() ? { dailyFrom: this.dailyFrom(), dailyTo: this.dailyTo() } : {}),
      ...(this.capacity() ? { capacity: Number(this.capacity()) } : {}),
      ...(this.ageMin() ? { ageMin: Number(this.ageMin()) } : {}),
      ...(this.ageMax() ? { ageMax: Number(this.ageMax()) } : {}),
    };
    this.busy.set(true);
    try {
      this.created.emit(await this.events.create(draft));
    } catch (error) {
      const e = toApiError(error);
      this.errors.set(e.fields);
      this.formError.set(describeError(e));
    } finally {
      this.busy.set(false);
    }
  }
}

function nextFullHour(hoursAhead: number): Date {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hoursAhead);
  return date;
}
