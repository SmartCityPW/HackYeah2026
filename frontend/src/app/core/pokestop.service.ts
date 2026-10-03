import { Injectable, signal } from '@angular/core';
import { CHARACTER_IDS, CharacterId, NewReport, Pokestop } from './pokestop.model';

// MOCK: dane w pamięci. Docelowo zastąpi je klient HTTP wygenerowany ze schematu OpenAPI backendu.
const MOCK_STOPS: Pokestop[] = [
  { id: 1, character: 'cyclist', type: 'report', title: 'Dziura w chodniku', description: 'Głęboka dziura przy przejściu, łatwo się potknąć.', author: 'Kasia', lat: 50.0617, lng: 19.9373, votesFor: 12, votesAgainst: 0, myVote: null },
  { id: 2, character: 'bin', type: 'report', title: 'Brakuje kosza na śmieci', description: 'Przy ławkach nie ma żadnego kosza, śmieci lądują na trawie.', author: 'Michał', lat: 50.0647, lng: 19.9450, votesFor: 5, votesAgainst: 2, myVote: null },
  { id: 3, character: 'tree', type: 'ngo', title: 'Ogród deszczowy na skwerze', description: 'Fundacja Zielone Miasto proponuje ogród deszczowy zamiast betonu. Co o tym myślisz?', author: 'Fundacja Zielone Miasto', lat: 50.0578, lng: 19.9265, votesFor: 40, votesAgainst: 7, myVote: null },
  { id: 4, character: 'train', type: 'consultation', title: 'Nowa ścieżka rowerowa', description: 'Miasto konsultuje przebieg ścieżki rowerowej wzdłuż ulicy. Zagłosuj za lub przeciw.', author: 'Urząd Miasta', lat: 50.0680, lng: 19.9150, votesFor: 88, votesAgainst: 31, myVote: null },
  { id: 5, character: 'lamp', type: 'report', title: 'Zepsuta latarnia', description: 'Latarnia nie świeci od tygodnia, wieczorem jest tu ciemno.', author: 'Ola', lat: 50.0555, lng: 19.9440, votesFor: 3, votesAgainst: 0, myVote: null },
];

@Injectable({ providedIn: 'root' })
export class PokestopService {
  readonly stops = signal<Pokestop[]>(MOCK_STOPS);

  /** Ile razy użytkownik zdobył daną postać (kolekcja). */
  readonly collection = signal<Record<CharacterId, number>>(
    Object.fromEntries(CHARACTER_IDS.map((id) => [id, 0])) as Record<CharacterId, number>,
  );

  /** Zwraca postać zdobytą za głos, albo null, jeśli użytkownik już głosował. */
  vote(id: number, vote: 'for' | 'against'): CharacterId | null {
    const stop = this.stops().find((s) => s.id === id);
    if (!stop || stop.myVote) return null;
    this.collection.update((c) => ({ ...c, [stop.character]: c[stop.character] + 1 }));
    this.stops.update((stops) =>
      stops.map((s) =>
        s.id !== id || s.myVote
          ? s
          : {
              ...s,
              myVote: vote,
              votesFor: s.votesFor + (vote === 'for' ? 1 : 0),
              votesAgainst: s.votesAgainst + (vote === 'against' ? 1 : 0),
            },
      ),
    );
    return stop.character;
  }

  addReport(report: NewReport): Pokestop {
    const stop: Pokestop = {
      ...report,
      id: Math.max(0, ...this.stops().map((s) => s.id)) + 1,
      type: 'report',
      author: 'Ty',
      votesFor: 0,
      votesAgainst: 0,
      myVote: null,
    };
    this.stops.update((stops) => [...stops, stop]);
    return stop;
  }
}
