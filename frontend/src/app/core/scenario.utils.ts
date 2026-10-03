import { CharacterId, NewReport, CHARACTERS } from './pokestop.model';
import { BASE_KEYS, FieldDef, FieldValues, Scenario } from './scenario.model';

export function allFields(scenario: Scenario): FieldDef[] {
  return scenario.sections.flatMap((s) => s.fields);
}

export function initialValues(scenario: Scenario): FieldValues {
  const values: FieldValues = {};
  for (const f of allFields(scenario)) {
    if (f.type === 'boolean') values[f.key] = false;
    else if (f.type === 'multiselect' || f.type === 'tags' || f.type === 'photos') values[f.key] = [];
    else if (f.type === 'character') values[f.key] = scenario.character;
    else if (f.key === 'title') values[f.key] = scenario.defaultTitle ?? '';
    else values[f.key] = '';
  }
  return values;
}

export function isVisible(field: FieldDef, values: FieldValues): boolean {
  return !field.showIf || values[field.showIf.key] === field.showIf.equals;
}

export function isEmpty(value: unknown): boolean {
  return value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

/** Zwraca błędy dla widocznych pól: klucz -> komunikat. Pusty obiekt = formularz poprawny. */
export function validate(scenario: Scenario, values: FieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of allFields(scenario)) {
    if (!isVisible(f, values)) continue;
    const v = values[f.key];
    if (f.required && isEmpty(v)) errors[f.key] = 'To pole jest wymagane';
    else if (f.key === 'title' && typeof v === 'string' && v.trim().length < 3) errors[f.key] = 'Min. 3 znaki';
    else if (f.type === 'number' && !isEmpty(v)) {
      const n = Number(v);
      if (Number.isNaN(n)) errors[f.key] = 'Podaj liczbę';
      else if (f.min !== undefined && n < f.min) errors[f.key] = `Minimum: ${f.min}`;
      else if (f.max !== undefined && n > f.max) errors[f.key] = `Maksimum: ${f.max}`;
    }
  }
  return errors;
}

export function parseTags(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Składa dane formularza w zgłoszenie (bez współrzędnych, które dodaje mapa). */
export function toReport(scenario: Scenario, values: FieldValues, organization: string | null): Omit<NewReport, 'lat' | 'lng'> {
  const details: Record<string, unknown> = {};
  for (const f of allFields(scenario)) {
    if (!isVisible(f, values) || (BASE_KEYS as readonly string[]).includes(f.key)) continue;
    details[f.key] = values[f.key];
  }
  return {
    scenarioId: scenario.id,
    icon: scenario.emoji,
    type: scenario.pokestopType,
    organization: organization ?? undefined,
    title: String(values['title'] ?? '').trim(),
    description: String(values['description'] ?? '').trim(),
    photos: (values['photos'] as string[] | undefined) ?? [],
    character: (values['character'] as CharacterId | undefined) ?? scenario.character,
    details,
  };
}

export interface DetailRow {
  label: string;
  text: string;
}

/** Zamienia zapisane `details` na czytelne wiersze (etykieta + tekst) wg definicji scenariusza. */
export function describeDetails(scenario: Scenario, details: Record<string, unknown>): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const f of allFields(scenario)) {
    if ((BASE_KEYS as readonly string[]).includes(f.key) || !(f.key in details)) continue;
    const v = details[f.key];
    if (isEmpty(v)) continue;
    let text: string;
    if (f.type === 'boolean') text = v ? 'Tak' : 'Nie';
    else if (f.type === 'rating') text = '★'.repeat(Number(v)) + '☆'.repeat(5 - Number(v));
    else if (Array.isArray(v)) text = v.map((x) => f.options?.find((o) => o.value === x)?.label ?? String(x)).join(', ');
    else if (f.type === 'select' || f.type === 'choice') text = f.options?.find((o) => o.value === v)?.label ?? String(v);
    else text = f.unit ? `${v} ${f.unit}` : String(v);
    rows.push({ label: f.label, text });
  }
  return rows;
}

export function characterLabel(id: CharacterId): string {
  return `${CHARACTERS[id].emoji} ${CHARACTERS[id].label}`;
}
