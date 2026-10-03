import { Pokestop } from '../pokestop.model';

/**
 * Pinezki atrap wokół TAURON Areny Kraków (miejsce HackYeah; domyślny widok mapy i symulowany GPS z app-config.yaml).
 * Konto demo ma w nich swoje zgłoszenia (`mine`), oddane głosy (`myVote`) i komentarze, więc "Moje inicjatywy" i profil
 * nie są puste. Postać zgłoszenia/pomysłu = gatunek zastawionego Spryciaka (zastawy: MockPlayerState).
 */
export const MOCK_STOPS: Pokestop[] = [
  // ~20 m od symulowanego GPS: da się zagłosować bez chodzenia.
  { id: 1, character: 'bench', type: 'report', status: 'open', icon: '🪑', title: 'Połamana ławka przy wejściu na Arenę', description: 'Dwie deski oparcia są złamane, ktoś może się skaleczyć. Ławka stoi przy głównym wejściu.', author: 'Marek', lat: 50.06775, lng: 19.99185, votesFor: 6, votesAgainst: 0, myVote: null,
    comments: [{ id: 1, author: 'Ola', text: 'Widziałam to wczoraj po koncercie, faktycznie groźnie.', mine: false }] },
  { id: 2, character: 'trash_can', type: 'report', status: 'open', icon: '🗑️', title: 'Przepełnione kosze po wydarzeniach', description: 'Po każdym koncercie kosze przy przystanku są pełne, a śmieci rozwiewa wiatr. Przydałyby się większe kosze albo częstszy odbiór.', author: 'Zosia', mine: true, lat: 50.06835, lng: 19.99305, votesFor: 14, votesAgainst: 1, myVote: null,
    comments: [{ id: 2, author: 'Kuba', text: 'Popieram, w weekend było tragicznie.', mine: false }, { id: 3, author: 'Zosia', text: 'Dzięki! Zgłoszę też do zarządu zieleni.', mine: true }] },
  { id: 3, character: 'potted_tree', type: 'idea', status: 'open', icon: '🌿', scenarioId: 'idea-greenery', title: 'Donice z drzewkami przed Areną', description: 'Plac przed wejściem to sam beton i w lecie robi się tu patelnia. Kilka dużych donic z drzewkami dałoby cień i miejsce do siedzenia.', author: 'Zosia', mine: true, lat: 50.06725, lng: 19.99115, votesFor: 23, votesAgainst: 4, myVote: null,
    comments: [] },
  { id: 4, character: 'floor_hole', type: 'report', status: 'resolved', icon: '🕳️', title: 'Dziura na przejściu dla pieszych', description: 'Wyrwa w asfalcie tuż przy krawężniku, łatwo skręcić kostkę przy wychodzeniu z tramwaju.', author: 'Kasia', lat: 50.06690, lng: 19.99050, votesFor: 31, votesAgainst: 0, myVote: 'for',
    comments: [{ id: 4, author: 'Zosia', text: 'Załatane, dzięki za szybką reakcję!', mine: true }] },
  { id: 5, character: 'billboard', type: 'report', status: 'in_progress', icon: '💡', title: 'Nie świecą latarnie na parkingu', description: 'Na części parkingu od strony ulicy wieczorem jest całkiem ciemno. Zgłoszone do zarządu dróg, czekamy na naprawę.', author: 'Ola', lat: 50.06590, lng: 19.99250, votesFor: 18, votesAgainst: 0, myVote: 'for', comments: [] },
  { id: 6, character: 'bicycle', type: 'consultation', status: 'open', icon: '🚲', title: 'Konsultacje: droga rowerowa do Areny', description: 'Miasto pyta, którędy poprowadzić nową drogę rowerową od al. Pokoju do Areny. Zagłosuj, czy popierasz projekt.', author: 'Urząd Miasta Krakowa', organization: 'Urząd Miasta Krakowa', lat: 50.06620, lng: 19.99400, votesFor: 112, votesAgainst: 27, myVote: 'for', comments: [] },
  { id: 7, character: 'tree', type: 'ngo', status: 'open', icon: '🌳', title: 'Szpaler lip wzdłuż ulicy Lema', description: 'Fundacja Zielone Miasto proponuje posadzenie 20 lip wzdłuż chodnika prowadzącego do Areny. Drzewa dadzą cień i ograniczą hałas.', author: 'Fundacja Zielone Miasto', organization: 'Fundacja Zielone Miasto', lat: 50.06900, lng: 19.98960, votesFor: 57, votesAgainst: 6, myVote: null,
    comments: [{ id: 5, author: 'Ania', text: 'Super, tylko niech nie zasłonią przejścia.', mine: false }] },
  { id: 8, character: 'cone', type: 'consultation', status: 'resolved', icon: '🚏', title: 'Konsultacje: nowy przystanek tramwajowy', description: 'Zakończone konsultacje w sprawie przeniesienia przystanku bliżej wejścia na Arenę. Projekt przyjęty do realizacji.', author: 'Urząd Miasta Krakowa', organization: 'Urząd Miasta Krakowa', lat: 50.06640, lng: 19.98980, votesFor: 204, votesAgainst: 41, myVote: 'for', comments: [] },
  { id: 9, character: 'bench', type: 'place', status: 'open', icon: '☕', scenarioId: 'place-food', title: 'Food trucki przy wejściu', description: 'W dni wydarzeń stoi tu kilka food trucków. Najlepsze zapiekanki w okolicy, jest też opcja wege.', author: 'Marta', lat: 50.06790, lng: 19.99100, votesFor: 26, votesAgainst: 2, myVote: null,
    details: { rating: '4', cost: 'cheap', vibes: ['friends'], bestTime: ['evening', 'weekend'], accessible: true, offer: 'streetfood', vegan: true, wifi: false, tips: 'Przyjdź przed koncertem, potem są kolejki.' }, comments: [] },
  { id: 10, character: 'sports_car', type: 'place', status: 'open', icon: '🏀', scenarioId: 'place-fun', title: 'Boisko do kosza za Areną', description: 'Ogólnodostępne boisko z dobrymi koszami i oświetleniem. Wieczorami gra tu stała ekipa, łatwo dołączyć.', author: 'Kuba', lat: 50.06880, lng: 19.99450, votesFor: 19, votesAgainst: 1, myVote: null,
    details: { rating: '5', cost: 'free', vibes: ['friends'], bestTime: ['afternoon', 'evening'], accessible: true, activity: 'court', ownGear: true, tips: 'Weź własną piłkę.' }, comments: [] },
  { id: 11, character: 'car', type: 'report', status: 'open', icon: '🚗', title: 'Auta parkują na chodniku', description: 'W dni koncertów samochody stoją na całej szerokości chodnika, z wózkiem trzeba schodzić na jezdnię.', author: 'Pani Halina', lat: 50.06560, lng: 19.99050, votesFor: 9, votesAgainst: 3, myVote: null, comments: [] },
  { id: 12, character: 'van', type: 'idea', status: 'open', icon: '🥕', scenarioId: 'idea-shop', title: 'Warzywniak na pobliskim osiedlu', description: 'Na osiedlu za Areną nie ma żadnego warzywniaka, a do najbliższego sklepu trzeba jechać tramwajem.', author: 'Pani Halina', lat: 50.06960, lng: 19.99300, votesFor: 32, votesAgainst: 3, myVote: null,
    details: { shopKind: 'veg', whoBenefits: ['seniors', 'parents'] }, comments: [] },
];
