import { EventPhase, GameEvent } from './event.model';

/**
 * Reguły czasu wydarzenia po stronie klienta. Backend jest wyrocznią (`phase`, `activeNow`, `nextWindowStart` w odpowiedzi),
 * a te funkcje służą atrapie, która ma się zachowywać jak serwer, oraz testom. Godziny dzienne liczą się w strefie wydarzenia.
 */
export type ScheduleFields = Pick<GameEvent, 'startsAt' | 'endsAt' | 'dailyFrom' | 'dailyTo' | 'status'>;

const MINUTE_MS = 60_000;

/** Składniki daty i godziny na ścianie zegara w danej strefie. */
function wallClock(date: Date, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  );
  return { y: parts['year'], mo: parts['month'], d: parts['day'], h: parts['hour'], mi: parts['minute'] };
}

/** Przesunięcie strefy względem UTC w milisekundach dla danej chwili. */
function offsetMs(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS;
}

const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function phaseOf(event: ScheduleFields, now: Date): EventPhase {
  if (event.status === 'cancelled') return 'cancelled';
  if (now.getTime() < Date.parse(event.startsAt)) return 'upcoming';
  return now.getTime() > Date.parse(event.endsAt) ? 'ended' : 'ongoing';
}

/** Czy w tej chwili można odebrać nagrodę: w okresie trwania i, gdy są godziny dzienne, w ich ramach (końce włącznie). */
export function isActiveNow(event: ScheduleFields, now: Date, timeZone: string): boolean {
  if (phaseOf(event, now) !== 'ongoing') return false;
  if (!event.dailyFrom || !event.dailyTo) return true;
  const w = wallClock(now, timeZone);
  const minutes = w.h * 60 + w.mi;
  return minutes >= minutesOf(event.dailyFrom) && minutes <= minutesOf(event.dailyTo);
}

/** Od kiedy najbliżej można odebrać nagrodę (ISO) albo null, gdy już można albo wydarzenie się skończyło lub odwołano. */
export function nextWindowStart(event: ScheduleFields, now: Date, timeZone: string): string | null {
  const phase = phaseOf(event, now);
  if (phase === 'ended' || phase === 'cancelled' || isActiveNow(event, now, timeZone)) return null;
  const earliest = Math.max(now.getTime(), Date.parse(event.startsAt));
  if (!event.dailyFrom || !event.dailyTo) return new Date(earliest).toISOString();
  const { y, mo, d } = wallClock(new Date(earliest), timeZone);
  const end = Date.parse(event.endsAt);
  for (let day = 0; day < 40; day++) {
    // Początek i koniec okienka danego dnia jako chwile UTC (strefa może zmienić przesunięcie, więc liczymy je osobno dla każdej chwili).
    const at = (hhmm: string) => {
      const wall = Date.UTC(y, mo - 1, d + day, 0, 0) + minutesOf(hhmm) * MINUTE_MS;
      return wall - offsetMs(new Date(wall - offsetMs(new Date(wall), timeZone)), timeZone);
    };
    const opens = Math.max(at(event.dailyFrom), Date.parse(event.startsAt));
    const closes = Math.min(at(event.dailyTo), end);
    if (opens > end) return null;
    if (closes >= earliest) return new Date(Math.max(opens, earliest)).toISOString();
  }
  return null;
}
