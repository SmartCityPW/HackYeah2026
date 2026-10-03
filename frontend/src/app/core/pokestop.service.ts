import { Injectable, signal } from '@angular/core';
import { Pokestop } from './pokestop.model';

// MOCK: dane w pamięci. Docelowo zastąpi je klient HTTP wygenerowany ze schematu OpenAPI backendu.
const MOCK_STOPS: Pokestop[] = [
  { id: 1, type: 'report', title: 'Dziura w chodniku', description: 'Głęboka dziura przy przejściu, łatwo się potknąć.', author: 'Kasia', lat: 50.0617, lng: 19.9373, votesFor: 12, votesAgainst: 0, myVote: null },
  { id: 2, type: 'report', title: 'Brakuje kosza na śmieci', description: 'Przy ławkach nie ma żadnego kosza, śmieci lądują na trawie.', author: 'Michał', lat: 50.0647, lng: 19.9450, votesFor: 5, votesAgainst: 2, myVote: null },
  { id: 3, type: 'ngo', title: 'Ogród deszczowy na skwerze', description: 'Fundacja Zielone Miasto proponuje ogród deszczowy zamiast betonu. Co o tym myślisz?', author: 'Fundacja Zielone Miasto', lat: 50.0578, lng: 19.9265, votesFor: 40, votesAgainst: 7, myVote: null },
  { id: 4, type: 'consultation', title: 'Nowa ścieżka rowerowa', description: 'Miasto konsultuje przebieg ścieżki rowerowej wzdłuż ulicy. Zagłosuj za lub przeciw.', author: 'Urząd Miasta', lat: 50.0680, lng: 19.9150, votesFor: 88, votesAgainst: 31, myVote: null },
  { id: 5, type: 'report', title: 'Zepsuta latarnia', description: 'Latarnia nie świeci od tygodnia, wieczorem jest tu ciemno.', author: 'Ola', lat: 50.0555, lng: 19.9440, votesFor: 3, votesAgainst: 0, myVote: null },
];

@Injectable({ providedIn: 'root' })
export class PokestopService {
  readonly stops = signal<Pokestop[]>(MOCK_STOPS);

  vote(id: number, vote: 'for' | 'against'): void {
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
  }
}
