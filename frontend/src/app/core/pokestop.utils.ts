import { Pokestop } from './pokestop.model';

/** Odsetek głosów "za" (0–100); 0 gdy nikt jeszcze nie głosował. */
export function supportPercent(stop: Pokestop): number {
  const total = stop.votesFor + stop.votesAgainst;
  return total === 0 ? 0 : Math.round((stop.votesFor / total) * 100);
}

/** Czy użytkownik miał z inicjatywą styczność: zgłosił, zagłosował albo skomentował. */
export function hasInteraction(stop: Pokestop): boolean {
  return !!stop.mine || stop.myVote !== null || stop.comments.some((c) => c.mine);
}
