import { Pokestop } from './pokestop.model';
import { hasInteraction, supportPercent } from './pokestop.utils';

const stop = (patch: Partial<Pokestop> = {}): Pokestop => ({
  id: 1, type: 'report', character: 'bin', status: 'open', title: 't', description: '', author: 'a',
  comments: [], lat: 0, lng: 0, votesFor: 0, votesAgainst: 0, myVote: null, ...patch,
});

describe('pokestop utils', () => {
  it('computes support percent and handles no votes', () => {
    expect(supportPercent(stop())).toBe(0);
    expect(supportPercent(stop({ votesFor: 3, votesAgainst: 1 }))).toBe(75);
  });

  it('detects interaction by authorship, vote or comment', () => {
    expect(hasInteraction(stop())).toBe(false);
    expect(hasInteraction(stop({ mine: true }))).toBe(true);
    expect(hasInteraction(stop({ myVote: 'against' }))).toBe(true);
    expect(hasInteraction(stop({ comments: [{ id: 1, author: 'x', text: 'y', mine: true }] }))).toBe(true);
  });
});
