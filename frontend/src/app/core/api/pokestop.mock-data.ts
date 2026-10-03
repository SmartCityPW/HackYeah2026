import { Pokestop, SurveyAnswers, SurveyQuestion, TimelineEntry } from '../pokestop.model';

/**
 * Pinezki atrap wokół TAURON Areny Kraków (miejsce HackYeah; domyślny widok mapy i symulowany GPS z app-config.yaml).
 * Konto demo ma w nich swoje zgłoszenia (`mine`), oddane głosy (`myVote`) i komentarze, więc "Moje inicjatywy" i profil
 * nie są puste. Postać zgłoszenia/pomysłu = gatunek zastawionego Spryciaka (zastawy: MockPlayerState).
 */
const q = (id: number, key: string, label: string, type: SurveyQuestion['type'], extra: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id, key, label, type, required: true, options: [], min: null, max: null, ...extra,
});

/** Ankieta konsultacji (id pytań 6xx) i ankieta fundacji (7xx) w atrapach. */
const BIKE_SURVEY: SurveyQuestion[] = [
  q(601, 'support', 'Czy popierasz budowę drogi rowerowej do Areny?', 'boolean'),
  q(602, 'route', 'Który wariant trasy wolisz?', 'choice', { options: [{ value: 'park', label: 'Przez park' }, { value: 'street', label: 'Wzdłuż ulicy' }, { value: 'tram', label: 'Obok torowiska' }] }),
  q(603, 'frequency', 'Jak często jeździsz rowerem po mieście?', 'rating', { min: 1, max: 5 }),
  q(604, 'remarks', 'Uwagi do projektu', 'textarea', { required: false }),
];
const TREE_SURVEY: SurveyQuestion[] = [
  q(701, 'support', 'Czy chcesz więcej drzew przy ulicy Lema?', 'boolean'),
  q(702, 'priorities', 'Co jest dla Ciebie najważniejsze?', 'multiselect', { options: [{ value: 'shade', label: 'Cień' }, { value: 'noise', label: 'Mniej hałasu' }, { value: 'air', label: 'Czystsze powietrze' }], required: false }),
  q(703, 'volunteer', 'Ile godzin możesz pomóc przy sadzeniu?', 'number', { min: 0, max: 40, required: false }),
];

/** Odpowiedzi innych mieszkańców, żeby wyniki ankiet w atrapach nie były puste. */
export const MOCK_SURVEY_RESPONSES: Record<number, SurveyAnswers[]> = {
  6: [{ support: true, route: 'park', frequency: 4 }, { support: true, route: 'street', frequency: 5, remarks: 'Potrzebne oświetlenie.' }, { support: false, route: 'tram', frequency: 2 }],
  7: [{ support: true, priorities: ['shade', 'air'], volunteer: 3 }, { support: true, priorities: ['noise'] }],
};

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
  { id: 6, character: 'bicycle', type: 'consultation', status: 'open', icon: '🚲', title: 'Konsultacje: droga rowerowa do Areny', description: 'Miasto pyta, którędy poprowadzić nową drogę rowerową od al. Pokoju do Areny. Zagłosuj, czy popierasz projekt.', author: 'Urząd Miasta Krakowa', organization: 'Urząd Miasta Krakowa', questions: BIKE_SURVEY, surveyAnswered: false, customFields: [{ label: 'Długość trasy', value: '2,4 km' }, { label: 'Szacowany koszt', value: '3,1 mln zł' }, { label: 'Planowany start', value: 'wiosna 2027' }], lat: 50.06620, lng: 19.99400, votesFor: 112, votesAgainst: 27, myVote: 'for', comments: [] },
  { id: 7, character: 'tree', type: 'ngo', status: 'open', icon: '🌳', title: 'Szpaler lip wzdłuż ulicy Lema', description: 'Fundacja Zielone Miasto proponuje posadzenie 20 lip wzdłuż chodnika prowadzącego do Areny. Drzewa dadzą cień i ograniczą hałas.', author: 'Fundacja Zielone Miasto', organization: 'Fundacja Zielone Miasto', questions: TREE_SURVEY, surveyAnswered: false, customFields: [{ label: 'Liczba drzew', value: '20 lip' }, { label: 'Budżet', value: '18 000 zł (grant dzielnicy)' }], lat: 50.06900, lng: 19.98960, votesFor: 57, votesAgainst: 6, myVote: null,
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

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3_600_000).toISOString();
let nextEntryId = 1000;
const update = (title: string, body: string, author: string, days: number, hours = 0): TimelineEntry => ({
  kind: 'update', id: nextEntryId++, title, body, author, createdAt: ago(days, hours), updatedAt: null, editable: true,
});
const change = (fromStatus: TimelineEntry['fromStatus'], toStatus: TimelineEntry['toStatus'], body: string, author: string, days: number): TimelineEntry => ({
  kind: 'status', id: nextEntryId++, title: '', body, fromStatus, toStatus, author, createdAt: ago(days), updatedAt: null, editable: false,
});

/** Losy inicjatyw atrap (bez wpisu `created`, ten dodaje atrapa). Inicjatywy bez wpisów mają tylko narodziny. */
export const MOCK_TIMELINES: Record<number, TimelineEntry[]> = {
  4: [change('open', 'in_progress', 'Zgłoszone do Zarządu Dróg Miasta Krakowa', 'Administrator', 14), change('in_progress', 'resolved', 'Wyrwa załatana, odbiór robót 12 października', 'Administrator', 3)],
  5: [change('open', 'in_progress', 'Zarząd Dróg zlecił przegląd oświetlenia', 'Administrator', 5), update('Ekipa sprawdziła zasilanie', 'Usterka jest w skrzynce zasilającej. Czekamy na wymianę bezpiecznika.', 'Administrator', 2)],
  6: [update('Spotkanie konsultacyjne w Arenie', 'W czwartek o 18:00 omówimy przebieg trasy z mieszkańcami. Wstęp wolny, można zadawać pytania.', 'Urząd Miasta Krakowa', 0, 6), update('Opublikowaliśmy wstępny przebieg trasy', 'Mapa z wariantami jest dostępna na stronie urzędu. Czekamy na Wasze uwagi.', 'Urząd Miasta Krakowa', 9)],
  7: [update('Jutro sadzimy pierwsze drzewko', 'Spotkajmy się o 10:00 przy ul. Lema. Sadzonki dostarczy dzielnica, łopaty mamy my.', 'Fundacja Zielone Miasto', 0, 5), update('Dziś rada dzielnicy zajęła się sprawą', 'Radni jednogłośnie poparli projekt i przyznali grant na zakup sadzonek.', 'Fundacja Zielone Miasto', 2)],
  8: [change('open', 'in_progress', 'Konsultacje zakończone, analizujemy wyniki', 'Urząd Miasta Krakowa', 40), change('in_progress', 'resolved', 'Projekt przyjęty uchwałą rady miasta', 'Urząd Miasta Krakowa', 20), update('Przystanek zostanie przeniesiony w 2027 r.', 'Prace ruszą po zakończeniu sezonu koncertowego. O terminie poinformujemy na tej osi czasu.', 'Urząd Miasta Krakowa', 20)],
};
