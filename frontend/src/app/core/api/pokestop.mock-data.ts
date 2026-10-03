import { CharacterId, Pokestop } from '../pokestop.model';

export const MOCK_STOPS: Pokestop[] = [
  { id: 1, character: 'cyclist', type: 'report', status: 'resolved', icon: '🕳️', title: 'Dziura w chodniku', description: 'Głęboka dziura przy przejściu, łatwo się potknąć.', author: 'Kasia', lat: 50.0617, lng: 19.9373, votesFor: 12, votesAgainst: 0, myVote: 'for',
    comments: [{ id: 1, author: 'Tomek', text: 'Potwierdzam, wczoraj prawie się potknąłem.', mine: false }, { id: 2, author: 'Ty', text: 'Dziękuję za naprawę!', mine: true }] },
  { id: 2, character: 'bin', type: 'report', status: 'open', icon: '🗑️', title: 'Brakuje kosza na śmieci', description: 'Przy ławkach nie ma żadnego kosza, śmieci lądują na trawie.', author: 'Ty', mine: true, lat: 50.0647, lng: 19.9450, votesFor: 5, votesAgainst: 2, myVote: null, comments: [] },
  { id: 3, character: 'tree', type: 'ngo', status: 'open', icon: '🌳', title: 'Ogród deszczowy na skwerze', description: 'Fundacja Zielone Miasto proponuje ogród deszczowy zamiast betonu. Co o tym myślisz?', author: 'Fundacja Zielone Miasto', organization: 'Fundacja Zielone Miasto', lat: 50.0578, lng: 19.9265, votesFor: 40, votesAgainst: 7, myVote: null,
    comments: [{ id: 3, author: 'Ania', text: 'Super pomysł, przy upałach to się przyda.', mine: false }] },
  { id: 4, character: 'train', type: 'consultation', status: 'open', icon: '🚆', title: 'Nowa ścieżka rowerowa', description: 'Miasto konsultuje przebieg ścieżki rowerowej wzdłuż ulicy. Zagłosuj za lub przeciw.', author: 'Urząd Miasta', organization: 'Urząd Miasta', lat: 50.0680, lng: 19.9150, votesFor: 88, votesAgainst: 31, myVote: null, comments: [] },
  { id: 5, character: 'lamp', type: 'report', status: 'in_progress', icon: '💡', title: 'Zepsuta latarnia', description: 'Latarnia nie świeci od tygodnia, wieczorem jest tu ciemno.', author: 'Ola', lat: 50.0555, lng: 19.9440, votesFor: 3, votesAgainst: 0, myVote: 'for', comments: [] },
  { id: 6, character: 'cyclist', type: 'place', status: 'open', icon: '🛹', scenarioId: 'place-fun', title: 'Skatepark pod mostem', description: 'Betonowy skatepark z widokiem na rzekę, wieczorem świetne światło.', author: 'Kuba', lat: 50.0590, lng: 19.9330, votesFor: 21, votesAgainst: 1, myVote: null,
    details: { rating: '5', cost: 'free', vibes: ['friends', 'photo'], bestTime: ['afternoon', 'evening'], accessible: false, activity: 'skate', ownGear: true, tips: 'Wpadnij przed zachodem słońca.' }, comments: [] },
  { id: 7, character: 'bin', type: 'place', status: 'open', icon: '☕', scenarioId: 'place-food', title: 'Kawiarnia pod żyrandolem', description: 'Mała kawiarnia z najlepszymi ciastami w okolicy.', author: 'Marta', lat: 50.0630, lng: 19.9395, votesFor: 14, votesAgainst: 0, myVote: null,
    details: { rating: '4', cost: 'medium', vibes: ['calm', 'date'], bestTime: ['morning', 'weekend'], accessible: true, offer: 'coffee', vegan: true, wifi: true, tips: 'Zapytaj o ciasto dnia.' }, comments: [] },
  { id: 8, character: 'train', type: 'idea', status: 'open', icon: '🥕', scenarioId: 'idea-shop', title: 'Sklep warzywny na osiedlu', description: 'Na osiedlu nie ma żadnego warzywniaka, a do najbliższego trzeba jechać autobusem.', author: 'Pani Halina', lat: 50.0598, lng: 19.9470, votesFor: 32, votesAgainst: 3, myVote: null,
    details: { shopKind: 'veg', whoBenefits: ['seniors', 'parents'] }, comments: [] },
];

/** Postacie zdobyte przez zalogowanego użytkownika (zgodne z drużyną STARTING_POKEMONS w game.api.mock.ts). */
export const MOCK_COLLECTION: Record<CharacterId, number> = { cyclist: 1, bin: 0, tree: 1, train: 0, lamp: 1 };
