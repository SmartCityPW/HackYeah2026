import { describeAge, describeEventState, formatEventPeriod } from './event.format';

describe('event.format', () => {
  it('formats a one-day period with hours', () => {
    const text = formatEventPeriod({ startsAt: '2026-10-10T08:00:00Z', endsAt: '2026-10-10T16:00:00Z', dailyFrom: null, dailyTo: null });
    expect(text).toMatch(/10 paź 2026, \d{2}:\d{2}–\d{2}:\d{2}/);
  });

  it('formats a multi-day period with daily hours', () => {
    const text = formatEventPeriod({ startsAt: '2026-10-10T06:00:00Z', endsAt: '2026-10-12T20:00:00Z', dailyFrom: '08:00', dailyTo: '22:00' });
    expect(text).toContain('10 paź 2026 – 12 paź 2026, codziennie 08:00–22:00');
  });

  it('formats a multi-day period without daily hours with the times at both ends', () => {
    const text = formatEventPeriod({ startsAt: '2026-10-10T06:00:00Z', endsAt: '2026-10-12T20:00:00Z', dailyFrom: null, dailyTo: null });
    expect(text).toMatch(/10 paź 2026 \d{2}:\d{2} – 12 paź 2026 \d{2}:\d{2}/);
  });

  const base = { phase: 'ongoing', activeNow: false, startsAt: '2026-10-10T06:00:00Z', nextWindowStart: null, checkedIn: false } as const;

  it('says whether the reward can be collected now, later or never', () => {
    expect(describeEventState({ ...base, activeNow: true })).toContain('możesz odebrać');
    expect(describeEventState({ ...base, phase: 'upcoming', nextWindowStart: '2026-10-11T08:00:00Z' })).toContain('Nagrodę odbierzesz od');
    expect(describeEventState({ ...base, nextWindowStart: '2026-10-11T08:00:00Z' })).toContain('tylko w godzinach wydarzenia');
    expect(describeEventState({ ...base, phase: 'ended' })).toContain('zakończyło');
    expect(describeEventState({ ...base, phase: 'cancelled' })).toContain('odwołane');
    expect(describeEventState({ ...base, activeNow: true, checkedIn: true })).toBe('Nagroda odebrana.');
  });

  it('describes the age range', () => {
    expect(describeAge({ ageMin: 8, ageMax: 14 })).toBe('8–14 lat');
    expect(describeAge({ ageMin: 8, ageMax: null })).toBe('od 8 lat');
    expect(describeAge({ ageMin: null, ageMax: 12 })).toBe('do 12 lat');
    expect(describeAge({ ageMin: null, ageMax: null })).toBeNull();
  });
});
