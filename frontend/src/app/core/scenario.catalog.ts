import { FieldDef, FieldOption, Scenario, ScenarioSection } from './scenario.model';
import { Role } from './session.service';

const yes = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: 'boolean', ...extra });
const opts = (...pairs: [string, string][]): FieldOption[] => pairs.map(([value, label]) => ({ value, label }));

// ───────────── Mieszkańcy: prosty formularz (tytuł, opis, zdjęcie) + ikona ─────────────

const residentSection = (titlePlaceholder: string): ScenarioSection[] => [
  {
    title: 'Zgłoszenie',
    fields: [
      { key: 'title', label: 'Tytuł', type: 'text', required: true, placeholder: titlePlaceholder },
      { key: 'description', label: 'Opis (opcjonalnie)', type: 'textarea' },
      { key: 'photos', label: 'Zdjęcie', type: 'photos', hint: 'Do 3 zdjęć' },
    ],
  },
];

const resident = (id: string, label: string, emoji: string, character: Scenario['character'], description: string, defaultTitle: string): Scenario => ({
  id,
  audience: 'resident',
  label,
  emoji,
  description,
  character,
  defaultTitle,
  sections: residentSection(defaultTitle),
});

export const RESIDENT_SCENARIOS: Scenario[] = [
  resident('res-pothole', 'Dziura lub uszkodzony chodnik', '🕳️', 'cyclist', 'Dziura, wyrwa, zapadnięta kostka.', 'Dziura w chodniku'),
  resident('res-bin', 'Brak kosza na śmieci', '🗑️', 'bin', 'Brakuje kosza albo jest przepełniony.', 'Brakuje kosza na śmieci'),
  resident('res-lamp', 'Zepsuta latarnia', '💡', 'lamp', 'Ciemno, latarnia nie świeci.', 'Zepsuta latarnia'),
  resident('res-green', 'Zieleń do posadzenia lub zadbania', '🌳', 'tree', 'Tu przydałoby się drzewo lub zadbany skwer.', 'Potrzeba zieleni'),
  resident('res-transport', 'Problem z komunikacją', '🚆', 'train', 'Przystanek, rozkład, korek, niebezpieczne przejście.', 'Problem z komunikacją'),
  resident('res-bike', 'Rowery i ścieżki', '🚴', 'cyclist', 'Brak ścieżki, stojaków, niebezpieczny odcinek.', 'Potrzeba infrastruktury rowerowej'),
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
    label: 'Nowy przystanek autobusowy',
    emoji: '🚏',
    description: 'Propozycja nowego przystanku wraz ze zmianami w liniach.',
    character: 'train',
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
    label: 'Uszkodzona mała architektura',
    emoji: '🪑',
    description: 'Zgłoszenie uszkodzonej ławki, kosza, placu zabaw, wiaty itp.',
    character: 'bin',
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
    label: 'Szkoda na powierzchni',
    emoji: '🚧',
    description: 'Dziury, zapadnięcia i uszkodzenia nawierzchni.',
    character: 'cyclist',
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

export function findScenario(id: string | undefined): Scenario | undefined {
  return id ? [...RESIDENT_SCENARIOS, ...ORG_SCENARIOS].find((s) => s.id === id) : undefined;
}
