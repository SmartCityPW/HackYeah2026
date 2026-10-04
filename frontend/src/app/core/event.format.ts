import { GameEvent } from './event.model';

const DAY = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const DAY_AND_TIME = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const sameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString();

/**
 * Okres wydarzenia po polsku, np. "10 paź 2026, 10:00–18:00" (jeden dzień),
 * "10 paź 2026 – 12 paź 2026, codziennie 08:00–22:00" (kilka dni z godzinami dziennymi) albo z godzinami przy obu datach (bez godzin dziennych).
 */
export function formatEventPeriod(event: Pick<GameEvent, 'startsAt' | 'endsAt' | 'dailyFrom' | 'dailyTo'>): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (sameDay(start, end)) return `${DAY.format(start)}, ${TIME.format(start)}–${TIME.format(end)}`;
  if (event.dailyFrom && event.dailyTo) return `${DAY.format(start)} – ${DAY.format(end)}, codziennie ${event.dailyFrom}–${event.dailyTo}`;
  return `${DAY.format(start)} ${TIME.format(start)} – ${DAY.format(end)} ${TIME.format(end)}`;
}

/** Stan wydarzenia jednym zdaniem: czy teraz można odebrać nagrodę, a jeśli nie, to od kiedy. */
export function describeEventState(event: Pick<GameEvent, 'phase' | 'activeNow' | 'startsAt' | 'nextWindowStart' | 'checkedIn'>): string {
  if (event.phase === 'cancelled') return 'Wydarzenie odwołane.';
  if (event.phase === 'ended') return 'Wydarzenie już się zakończyło.';
  if (event.checkedIn) return 'Nagroda odebrana.';
  if (event.activeNow) return 'Trwa teraz: możesz odebrać nagrodę, jeśli jesteś na miejscu.';
  const opens = event.nextWindowStart ? DAY_AND_TIME.format(new Date(event.nextWindowStart)) : null;
  if (event.phase === 'upcoming') return opens ? `Jeszcze się nie zaczęło. Nagrodę odbierzesz od ${opens}.` : 'Jeszcze się nie zaczęło.';
  return opens ? `Trwa, ale nagrodę odbierzesz tylko w godzinach wydarzenia: najbliżej od ${opens}.` : 'Trwa, ale teraz nie można odebrać nagrody.';
}

/** Przedział wieku jednym zdaniem albo null, gdy nie ma ograniczeń. */
export function describeAge(event: Pick<GameEvent, 'ageMin' | 'ageMax'>): string | null {
  if (event.ageMin !== null && event.ageMax !== null) return `${event.ageMin}–${event.ageMax} lat`;
  if (event.ageMin !== null) return `od ${event.ageMin} lat`;
  if (event.ageMax !== null) return `do ${event.ageMax} lat`;
  return null;
}
