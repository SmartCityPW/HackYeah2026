import { isActiveNow, nextWindowStart, phaseOf, ScheduleFields } from './event.schedule';

const TZ = 'Europe/Warsaw';
/** 10-12.10.2026 (CEST, UTC+2), odbiór codziennie 10:00-18:00 czasu warszawskiego. */
const EVENT: ScheduleFields = { startsAt: '2026-10-10T06:00:00Z', endsAt: '2026-10-12T20:00:00Z', dailyFrom: '10:00', dailyTo: '18:00', status: 'scheduled' };
const at = (iso: string) => new Date(iso);

describe('event.schedule (te same reguły co backend/apps/events/services.py)', () => {
  it('derives the phase from the period and cancellation', () => {
    expect(phaseOf(EVENT, at('2026-10-10T05:59:00Z'))).toBe('upcoming');
    expect(phaseOf(EVENT, at('2026-10-11T12:00:00Z'))).toBe('ongoing');
    expect(phaseOf(EVENT, at('2026-10-12T20:01:00Z'))).toBe('ended');
    expect(phaseOf({ ...EVENT, status: 'cancelled' }, at('2026-10-11T12:00:00Z'))).toBe('cancelled');
  });

  it.each([
    ['2026-10-11T07:59:00Z', false], // 09:59 lokalnie
    ['2026-10-11T08:00:00Z', true], // 10:00: początek włącznie
    ['2026-10-11T16:00:00Z', true], // 18:00: koniec włącznie
    ['2026-10-11T16:01:00Z', false], // 18:01
  ])('is active only inside the daily hours (%s)', (iso, expected) => {
    expect(isActiveNow(EVENT, at(iso), TZ)).toBe(expected);
  });

  it('is active all day when there are no daily hours', () => {
    expect(isActiveNow({ ...EVENT, dailyFrom: null, dailyTo: null }, at('2026-10-11T02:00:00Z'), TZ)).toBe(true);
  });

  it('is never active outside the period, even inside the daily hours', () => {
    expect(isActiveNow(EVENT, at('2026-10-09T09:00:00Z'), TZ)).toBe(false);
    expect(isActiveNow(EVENT, at('2026-10-13T09:00:00Z'), TZ)).toBe(false);
  });

  it('tells when the reward can be collected next', () => {
    expect(nextWindowStart(EVENT, at('2026-10-11T16:30:00Z'), TZ)).toBe('2026-10-12T08:00:00.000Z'); // po godzinach: jutro 10:00 lokalnie
    expect(nextWindowStart(EVENT, at('2026-10-11T05:00:00Z'), TZ)).toBe('2026-10-11T08:00:00.000Z'); // przed godzinami: dziś 10:00
    expect(nextWindowStart(EVENT, at('2026-10-09T12:00:00Z'), TZ)).toBe('2026-10-10T08:00:00.000Z'); // przed startem: pierwszy dzień
    expect(nextWindowStart(EVENT, at('2026-10-11T10:00:00Z'), TZ)).toBeNull(); // już można
  });

  it('has no next window after the last day, after the end or when cancelled', () => {
    expect(nextWindowStart(EVENT, at('2026-10-12T17:00:00Z'), TZ)).toBeNull(); // po 19:00 ostatniego dnia
    expect(nextWindowStart(EVENT, at('2026-10-13T08:00:00Z'), TZ)).toBeNull();
    expect(nextWindowStart({ ...EVENT, status: 'cancelled' }, at('2026-10-11T05:00:00Z'), TZ)).toBeNull();
  });

  it('starts the window at the event start when that is later than the daily opening', () => {
    const late = { ...EVENT, startsAt: '2026-10-10T12:00:00Z' }; // start o 14:00 lokalnie
    expect(nextWindowStart(late, at('2026-10-10T09:00:00Z'), TZ)).toBe('2026-10-10T12:00:00.000Z');
  });

  it('handles the switch to winter time (daily hours stay at local clock time)', () => {
    const winter: ScheduleFields = { startsAt: '2026-10-24T06:00:00Z', endsAt: '2026-10-27T20:00:00Z', dailyFrom: '10:00', dailyTo: '18:00', status: 'scheduled' };
    expect(nextWindowStart(winter, at('2026-10-25T17:30:00Z'), TZ)).toBe('2026-10-26T09:00:00.000Z'); // 18:30 lokalnie (po zmianie na CET); jutro 10:00 = 09:00 UTC
  });
});
