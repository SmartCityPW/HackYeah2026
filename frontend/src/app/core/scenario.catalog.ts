import { FieldDef, FieldOption, Scenario, ScenarioCategory, ScenarioSection } from './scenario.model';
import { Role } from './session.service';

const yes = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: 'boolean', ...extra });
const opts = (...pairs: [string, string][]): FieldOption[] => pairs.map(([value, label]) => ({ value, label }));

// ───────────── Mieszkańcy: kategorie menu "Zgłoś" ─────────────

export const RESIDENT_CATEGORIES: { id: ScenarioCategory; label: string; emoji: string; description: string }[] = [
  { id: 'problem', label: 'Zgłoś problem', emoji: '🚧', description: 'Coś w mieście nie działa: dziura, ciemna latarnia, brak kosza.' },
  { id: 'initiative', label: 'Zgłoś inicjatywę miejską', emoji: '✨', description: 'Masz pomysł, co mogłoby się tu pojawić: przystanek, sklep, plac zabaw.' },
  { id: 'place', label: 'Zgłoś cool miejsce', emoji: '😎', description: 'Podziel się miejscem, które warto znać, i oceń je jak w Mapach.' },
];

const photoField = (): FieldDef => ({ key: 'photos', label: 'Zdjęcie', type: 'photos', hint: 'Do 3 zdjęć' });

const simpleSection = (titlePlaceholder: string, extra: FieldDef[] = []): ScenarioSection[] => [
  {
    title: 'Zgłoszenie',
    fields: [
      { key: 'title', label: 'Tytuł', type: 'text', required: true, placeholder: titlePlaceholder },
      { key: 'description', label: 'Opis (opcjonalnie)', type: 'textarea' },
      ...extra,
      photoField(),
    ],
  },
];

interface ResidentSpec {
  id: string;
  category: ScenarioCategory;
  pokestopType: Scenario['pokestopType'];
  label: string;
  emoji: string;
  character: Scenario['character'];
  description: string;
  defaultTitle: string;
  sections?: ScenarioSection[];
}

const resident = (spec: ResidentSpec): Scenario => ({
  audience: 'resident',
  sections: simpleSection(spec.defaultTitle),
  ...spec,
});

// Problemy: tytuł, opis, zdjęcie, ikona.
const problem = (id: string, label: string, emoji: string, character: Scenario['character'], description: string, defaultTitle: string): Scenario =>
  resident({ id, category: 'problem', pokestopType: 'report', label, emoji, character, description, defaultTitle });

// Inicjatywy: pomysł + dla kogo i ewentualne doprecyzowanie.
const beneficiaries = (): FieldDef => ({
  key: 'whoBenefits',
  label: 'Kto by na tym skorzystał',
  type: 'multiselect',
  options: opts(['kids', 'Dzieci'], ['teens', 'Młodzież'], ['seniors', 'Seniorzy'], ['parents', 'Rodzice z wózkami'], ['bikers', 'Rowerzyści'], ['disabled', 'Osoby z niepełnosprawnościami'], ['all', 'Wszyscy']),
});

const initiative = (id: string, label: string, emoji: string, character: Scenario['character'], description: string, defaultTitle: string, extra: FieldDef[] = []): Scenario =>
  resident({ id, category: 'initiative', pokestopType: 'idea', label, emoji, character, description, defaultTitle, sections: simpleSection(defaultTitle, [...extra, beneficiaries()]) });

// Cool miejsca: kwestionariusz w stylu opinii z map (ocena, koszt, klimat, pora, dostępność).
const costField = (): FieldDef => ({
  key: 'cost',
  label: 'Ile kosztuje skorzystanie',
  type: 'choice',
  required: true,
  options: opts(['free', 'Za darmo'], ['cheap', 'Tanio (do 20 zł)'], ['medium', 'Średnio (20–60 zł)'], ['expensive', 'Drogo (60 zł i więcej)']),
});

const placeSections = (titlePlaceholder: string, extra: FieldDef[]): ScenarioSection[] => [
  {
    title: 'O miejscu',
    fields: [
      { key: 'title', label: 'Nazwa miejsca', type: 'text', required: true, placeholder: titlePlaceholder },
      { key: 'description', label: 'Co tu jest fajnego?', type: 'textarea' },
      photoField(),
    ],
  },
  {
    title: 'Twoja opinia',
    fields: [
      { key: 'rating', label: 'Ocena', type: 'rating', required: true },
      costField(),
      {
        key: 'vibes',
        label: 'Jaki jest klimat',
        type: 'multiselect',
        options: opts(['calm', 'Spokojnie'], ['loud', 'Głośno'], ['friends', 'Z ekipą'], ['date', 'Na randkę'], ['solo', 'Samemu'], ['kids', 'Z dzieckiem'], ['photo', 'Instagramowe'], ['dogs', 'Z psem']),
      },
      {
        key: 'bestTime',
        label: 'Kiedy najlepiej wpaść',
        type: 'multiselect',
        options: opts(['morning', 'Rano'], ['afternoon', 'Popołudnie'], ['evening', 'Wieczór'], ['night', 'Noc'], ['weekend', 'Weekend']),
      },
      yes('accessible', 'Dostępne dla wózków i osób z niepełnosprawnościami'),
      ...extra,
      { key: 'tips', label: 'Wskazówka dla innych', type: 'textarea', placeholder: 'np. wejdź od podwórka, najlepsze miejsca przy oknie' },
    ],
  },
];

const place = (id: string, label: string, emoji: string, character: Scenario['character'], description: string, titlePlaceholder: string, extra: FieldDef[]): Scenario =>
  resident({ id, category: 'place', pokestopType: 'place', label, emoji, character, description, defaultTitle: '', sections: placeSections(titlePlaceholder, extra) });

export const RESIDENT_SCENARIOS: Scenario[] = [
  problem('res-pothole', 'Dziura lub uszkodzony chodnik', '🕳️', 'floor_hole', 'Dziura, wyrwa, zapadnięta kostka.', 'Dziura w chodniku'),
  problem('res-bin', 'Brak kosza na śmieci', '🗑️', 'trash_can', 'Brakuje kosza albo jest przepełniony.', 'Brakuje kosza na śmieci'),
  problem('res-lamp', 'Zepsuta latarnia', '💡', 'billboard', 'Ciemno, latarnia nie świeci.', 'Zepsuta latarnia'),
  problem('res-green', 'Zaniedbana zieleń', '🌳', 'tree', 'Zarośnięty skwer, chore drzewo, brak trawnika.', 'Zaniedbana zieleń'),
  problem('res-transport', 'Problem z komunikacją', '🚆', 'car', 'Przystanek, rozkład, korek, niebezpieczne przejście.', 'Problem z komunikacją'),
  problem('res-bike', 'Problem dla rowerzystów', '🚴', 'bicycle', 'Brak ścieżki, zepsuty stojak, niebezpieczny odcinek.', 'Problem dla rowerzystów'),

  initiative('idea-bus-stop', 'Przystanek autobusowy', '🚏', 'small_car', 'Tu przydałby się nowy przystanek.', 'Nowy przystanek'),
  initiative('idea-shop', 'Sklep lub usługa na osiedlu', '🥕', 'van', 'Warzywniak, piekarnia, apteka, punkt usługowy.', 'Sklep warzywny na osiedlu', [
    { key: 'shopKind', label: 'Czego brakuje', type: 'choice', options: opts(['veg', 'Warzywniak'], ['bakery', 'Piekarnia'], ['pharmacy', 'Apteka'], ['grocery', 'Sklep spożywczy'], ['service', 'Punkt usługowy'], ['other', 'Coś innego']) },
  ]),
  initiative('idea-playground', 'Plac zabaw lub boisko', '🛝', 'bench', 'Miejsce do zabawy i sportu.', 'Nowy plac zabaw'),
  initiative('idea-greenery', 'Zieleń, drzewa, skwer', '🌿', 'potted_tree', 'Tu mogłoby być zielono.', 'Więcej zieleni'),
  initiative('idea-bike', 'Rowery: stojaki, ścieżka', '🚲', 'bicycle', 'Infrastruktura dla rowerzystów.', 'Stojaki lub ścieżka rowerowa'),
  initiative('idea-other', 'Inny pomysł', '💭', 'cone', 'Coś, czego tu brakuje.', 'Mój pomysł dla miasta'),

  place('place-food', 'Jedzenie i kawa', '☕', 'bench', 'Kawiarnia, street food, bar, cukiernia.', 'np. Kawiarnia pod żyrandolem', [
    { key: 'offer', label: 'Co tu zjesz i wypijesz', type: 'choice', options: opts(['coffee', 'Kawa i desery'], ['streetfood', 'Street food'], ['fast', 'Fast food'], ['restaurant', 'Restauracja'], ['bar', 'Bar'], ['bakery', 'Piekarnia']) },
    yes('vegan', 'Są opcje wegetariańskie lub wegańskie'),
    yes('wifi', 'Jest Wi-Fi'),
  ]),
  place('place-chill', 'Zieleń i chillout', '🌇', 'flower_pot', 'Park, skwer, widok, miejsce nad wodą.', 'np. Skwer z hamakami', [
    { key: 'spotType', label: 'Rodzaj miejsca', type: 'choice', options: opts(['park', 'Park'], ['square', 'Skwer'], ['view', 'Punkt widokowy'], ['water', 'Nad wodą'], ['bench', 'Ławka z klimatem']) },
    yes('shade', 'Jest cień'),
    yes('dogsOk', 'Można z psem'),
  ]),
  place('place-fun', 'Rozrywka i sport', '🛹', 'sports_car', 'Skatepark, boisko, arcade, tor rowerowy.', 'np. Skatepark pod mostem', [
    { key: 'activity', label: 'Co tu robisz', type: 'choice', options: opts(['skate', 'Skatepark'], ['court', 'Boisko'], ['gym', 'Siłownia plenerowa'], ['arcade', 'Salon gier'], ['trampoline', 'Trampoliny'], ['other', 'Coś innego']) },
    yes('ownGear', 'Trzeba mieć własny sprzęt'),
  ]),
  place('place-culture', 'Kultura i hobby', '🎨', 'billboard', 'Mural, galeria, biblioteka, księgarnia, koncerty.', 'np. Mural na starej kamienicy', [
    { key: 'cultureKind', label: 'Rodzaj miejsca', type: 'choice', options: opts(['mural', 'Mural / street art'], ['gallery', 'Galeria'], ['library', 'Biblioteka'], ['bookshop', 'Księgarnia'], ['museum', 'Muzeum'], ['concerts', 'Koncerty']) },
    yes('ticket', 'Potrzebny bilet'),
  ]),
];

// ───────────── Organizacje zaufane: szczegółowe scenariusze ─────────────

const characterField = (): FieldDef => ({
  key: 'character',
  label: 'Postać na mapie',
  type: 'character',
  hint: 'Jak ta inicjatywa wyświetli się mieszkańcom',
});

const contactSection = (): ScenarioSection => ({
  title: 'Kontakt i odpowiedzialność',
  fields: [
    { key: 'contactPerson', label: 'Osoba kontaktowa', type: 'text', required: true },
    { key: 'contactEmail', label: 'E-mail kontaktowy', type: 'text', required: true, placeholder: 'osoba@organizacja.pl' },
    { key: 'contactPhone', label: 'Telefon', type: 'text' },
    { key: 'rationale', label: 'Uzasadnienie i korzyści dla mieszkańców', type: 'textarea', required: true },
  ],
});

const basics = (defaultTitle: string): ScenarioSection => ({
  title: 'Podstawowe informacje',
  fields: [
    characterField(),
    { key: 'title', label: 'Tytuł inicjatywy', type: 'text', required: true, placeholder: defaultTitle },
    { key: 'description', label: 'Krótki opis dla mieszkańców', type: 'textarea', required: true },
    { key: 'photos', label: 'Zdjęcia, wizualizacje', type: 'photos', hint: 'Do 3 zdjęć' },
  ],
});

export const ORG_SCENARIOS: Scenario[] = [
  {
    id: 'org-bus-stop',
    audience: 'org',
    pokestopType: 'ngo',
    label: 'Nowy przystanek autobusowy',
    emoji: '🚏',
    description: 'Propozycja nowego przystanku wraz ze zmianami w liniach.',
    character: 'small_car',
    defaultTitle: 'Nowy przystanek autobusowy',
    sections: [
      basics('Nowy przystanek autobusowy'),
      {
        title: 'Linie komunikacyjne',
        fields: [
          { key: 'linesNew', label: 'Linie uruchomione od zera', type: 'tags', hint: 'Numery oddzielone przecinkami, np. 192, 502' },
          { key: 'linesRerouted', label: 'Linie przekierowane przez ten przystanek', type: 'tags' },
          { key: 'linesRemoved', label: 'Linie wycofane z tego miejsca', type: 'tags' },
          { key: 'direction', label: 'Kierunek / kierunki', type: 'text', placeholder: 'np. w stronę Dworca Głównego' },
          yes('onDemand', 'Przystanek na żądanie'),
          { key: 'frequency', label: 'Planowana częstotliwość kursów', type: 'select', options: opts(['10', 'Co 10 min lub częściej'], ['20', 'Co 20 min'], ['30', 'Co 30 min'], ['60', 'Co godzinę lub rzadziej']) },
        ],
      },
      {
        title: 'Wyposażenie przystanku',
        fields: [
          yes('shelter', 'Wiata przystankowa'),
          { key: 'shelterSize', label: 'Rozmiar wiaty', type: 'select', required: true, showIf: { key: 'shelter', equals: true }, options: opts(['small', 'Mała (do 2 m)'], ['medium', 'Średnia (3–4 m)'], ['large', 'Duża (5 m i więcej)']) },
          { key: 'shelterLength', label: 'Długość wiaty', type: 'number', unit: 'm', min: 1, max: 20, showIf: { key: 'shelter', equals: true } },
          yes('bench', 'Ławka'),
          yes('infoBoard', 'Tablica z rozkładem jazdy'),
          yes('realTimeDisplay', 'Tablica czasu rzeczywistego'),
          yes('lighting', 'Oświetlenie'),
          yes('raisedKerb', 'Podwyższony krawężnik (dostępność)'),
          yes('tactilePaving', 'Pas prowadzący dla osób niewidomych'),
          yes('bikeRack', 'Stojak rowerowy w pobliżu'),
        ],
      },
      {
        title: 'Plan realizacji',
        fields: [
          { key: 'plannedDate', label: 'Planowany termin uruchomienia', type: 'date' },
          { key: 'estimatedCost', label: 'Szacowany koszt', type: 'number', unit: 'zł', min: 0 },
        ],
      },
      contactSection(),
    ],
  },
  {
    id: 'org-tree',
    audience: 'org',
    pokestopType: 'ngo',
    label: 'Nowe drzewo w danym miejscu',
    emoji: '🌳',
    description: 'Propozycja nasadzenia drzewa lub grupy drzew.',
    character: 'tree',
    defaultTitle: 'Nowe nasadzenie drzew',
    sections: [
      basics('Nowe nasadzenie drzew'),
      {
        title: 'Nasadzenie',
        fields: [
          { key: 'plantingType', label: 'Rodzaj nasadzenia', type: 'select', required: true, options: opts(['new', 'Nowe nasadzenie'], ['replace', 'Odtworzenie po wycince'], ['grove', 'Kępa / mini-las']) },
          { key: 'species', label: 'Gatunek', type: 'select', required: true, options: opts(['linden', 'Lipa drobnolistna'], ['maple', 'Klon'], ['oak', 'Dąb szypułkowy'], ['hornbeam', 'Grab'], ['rowan', 'Jarząb'], ['other', 'Inny']) },
          { key: 'speciesOther', label: 'Jaki gatunek?', type: 'text', required: true, showIf: { key: 'species', equals: 'other' } },
          { key: 'count', label: 'Liczba sztuk', type: 'number', required: true, min: 1, max: 500 },
          { key: 'seedlingHeight', label: 'Wysokość sadzonki', type: 'select', options: opts(['s', 'Do 1,5 m'], ['m', '1,5–2,5 m'], ['l', 'Powyżej 2,5 m']) },
        ],
      },
      {
        title: 'Zgody i utrzymanie',
        fields: [
          yes('landConsent', 'Mamy zgodę zarządcy terenu'),
          { key: 'landOwner', label: 'Zarządca terenu', type: 'text', required: true, showIf: { key: 'landConsent', equals: true } },
          { key: 'maintenanceBy', label: 'Kto zajmie się pielęgnacją', type: 'select', options: opts(['org', 'Nasza organizacja'], ['city', 'Zarząd Zieleni Miejskiej'], ['residents', 'Mieszkańcy / wolontariusze']) },
          { key: 'wateringPlan', label: 'Plan podlewania', type: 'textarea' },
          { key: 'plannedDate', label: 'Planowany termin nasadzenia', type: 'date' },
        ],
      },
      contactSection(),
    ],
  },
  {
    id: 'org-small-architecture',
    audience: 'org',
    pokestopType: 'ngo',
    label: 'Uszkodzona mała architektura',
    emoji: '🪑',
    description: 'Zgłoszenie uszkodzonej ławki, kosza, placu zabaw, wiaty itp.',
    character: 'bench',
    defaultTitle: 'Uszkodzona mała architektura',
    sections: [
      basics('Uszkodzona mała architektura'),
      {
        title: 'Uszkodzony obiekt',
        fields: [
          { key: 'objectType', label: 'Rodzaj obiektu', type: 'select', required: true, options: opts(['bench', 'Ławka'], ['bin', 'Kosz na śmieci'], ['playground', 'Plac zabaw'], ['gym', 'Siłownia plenerowa'], ['fountain', 'Fontanna / poidełko'], ['shelter', 'Wiata'], ['bollard', 'Słupek / bariera'], ['board', 'Tablica informacyjna'], ['other', 'Inny']) },
          { key: 'damageLevel', label: 'Stopień uszkodzenia', type: 'select', required: true, options: opts(['minor', 'Drobne'], ['medium', 'Średnie'], ['serious', 'Poważne'], ['destroyed', 'Całkowite zniszczenie']) },
          { key: 'cause', label: 'Prawdopodobna przyczyna', type: 'select', options: opts(['vandalism', 'Wandalizm'], ['wear', 'Zużycie'], ['weather', 'Pogoda'], ['accident', 'Wypadek'], ['unknown', 'Nieznana']) },
          yes('safetyRisk', 'Obiekt stwarza zagrożenie dla bezpieczeństwa'),
          { key: 'safetyDescription', label: 'Opisz zagrożenie', type: 'textarea', required: true, showIf: { key: 'safetyRisk', equals: true } },
          { key: 'urgency', label: 'Pilność naprawy', type: 'select', options: opts(['low', 'Niska'], ['normal', 'Zwykła'], ['high', 'Wysoka'], ['immediate', 'Natychmiastowa']) },
          { key: 'manager', label: 'Zarządca obiektu (jeśli znany)', type: 'text' },
          { key: 'estimatedCost', label: 'Szacowany koszt naprawy', type: 'number', unit: 'zł', min: 0 },
        ],
      },
      contactSection(),
    ],
  },
  {
    id: 'org-surface-damage',
    audience: 'org',
    pokestopType: 'ngo',
    label: 'Szkoda na powierzchni',
    emoji: '🚧',
    description: 'Dziury, zapadnięcia i uszkodzenia nawierzchni.',
    character: 'cone',
    defaultTitle: 'Uszkodzenie nawierzchni',
    sections: [
      basics('Uszkodzenie nawierzchni'),
      {
        title: 'Charakter szkody',
        fields: [
          { key: 'surfaceType', label: 'Rodzaj nawierzchni', type: 'select', required: true, options: opts(['asphalt', 'Asfalt'], ['paving', 'Kostka brukowa'], ['slabs', 'Płyty chodnikowe'], ['concrete', 'Beton'], ['ground', 'Grunt / trawnik']) },
          { key: 'damageType', label: 'Rodzaj szkody', type: 'select', required: true, options: opts(['pothole', 'Dziura'], ['subsidence', 'Zapadnięcie'], ['crack', 'Pęknięcie'], ['rut', 'Koleiny'], ['kerb', 'Uszkodzony krawężnik'], ['washout', 'Podmycie']) },
          { key: 'areaM2', label: 'Powierzchnia uszkodzenia', type: 'number', unit: 'm²', min: 0 },
          { key: 'depthCm', label: 'Głębokość', type: 'number', unit: 'cm', min: 0 },
          yes('blocksPassage', 'Szkoda blokuje przejście lub przejazd'),
          { key: 'affected', label: 'Kogo to dotyczy', type: 'multiselect', options: opts(['pedestrians', 'Piesi'], ['wheelchairs', 'Wózki i osoby z niepełnosprawnościami'], ['visually', 'Osoby niewidome'], ['bikes', 'Rowerzyści'], ['cars', 'Kierowcy']) },
        ],
      },
      contactSection(),
    ],
  },
];

/** Katalog scenariuszy dostępny dla roli (administrator niczego nie zgłasza). */
export function scenariosFor(role: Role): Scenario[] {
  if (role === 'org') return ORG_SCENARIOS;
  return role === 'resident' ? RESIDENT_SCENARIOS : [];
}

export function scenariosInCategory(category: ScenarioCategory): Scenario[] {
  return RESIDENT_SCENARIOS.filter((s) => s.category === category);
}

export function findScenario(id: string | undefined): Scenario | undefined {
  return id ? [...RESIDENT_SCENARIOS, ...ORG_SCENARIOS].find((s) => s.id === id) : undefined;
}
