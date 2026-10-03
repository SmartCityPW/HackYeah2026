import { ORG_SCENARIOS, RESIDENT_SCENARIOS } from './scenario.catalog';
import { describeDetails, initialValues, isVisible, parseTags, toReport, validate } from './scenario.utils';

const busStop = ORG_SCENARIOS.find((s) => s.id === 'org-bus-stop')!;

describe('scenario utils', () => {
  it('hides conditional fields until the condition is met', () => {
    const size = busStop.sections.flatMap((s) => s.fields).find((f) => f.key === 'shelterSize')!;
    expect(isVisible(size, { shelter: false })).toBe(false);
    expect(isVisible(size, { shelter: true })).toBe(true);
  });

  it('requires only visible required fields', () => {
    const values = { ...initialValues(busStop), title: 'Przystanek', description: 'x', contactPerson: 'A', contactEmail: 'a@b.pl', rationale: 'y' };
    expect(validate(busStop, values)).toEqual({});
    expect(validate(busStop, { ...values, shelter: true })['shelterSize']).toBeDefined();
  });

  it('validates numeric ranges', () => {
    const values = { ...initialValues(busStop), shelter: true, shelterSize: 'small', shelterLength: 99 };
    expect(validate(busStop, values)['shelterLength']).toContain('Maksimum');
  });

  it('parses tags', () => {
    expect(parseTags('192, 502;  ,  N1')).toEqual(['192', '502', 'N1']);
  });

  it('builds a report and describes details, skipping hidden fields', () => {
    const values = { ...initialValues(busStop), title: ' Przystanek ', shelter: false, shelterSize: 'large', linesNew: ['192'] };
    const report = toReport(busStop, values, 'Fundacja');
    expect(report.type).toBe('ngo');
    expect(report.title).toBe('Przystanek');
    expect('shelterSize' in report.details).toBe(false);
    const rows = describeDetails(busStop, report.details);
    expect(rows.find((r) => r.label.includes('uruchomione'))?.text).toBe('192');
    expect(rows.find((r) => r.label === 'Wiata przystankowa')?.text).toBe('Nie');
  });

  it('resident problem scenarios only ask for title, description and photos', () => {
    for (const s of RESIDENT_SCENARIOS.filter((x) => x.category === 'problem')) {
      expect(s.sections.flatMap((x) => x.fields).map((f) => f.key)).toEqual(['title', 'description', 'photos']);
    }
  });

  it('every resident scenario belongs to a category and maps to the matching pin type', () => {
    const expected = { problem: 'report', initiative: 'idea', place: 'place' };
    for (const s of RESIDENT_SCENARIOS) expect(s.pokestopType).toBe(expected[s.category!]);
  });

  it('cool place scenarios require rating and cost and render stars', () => {
    const place = RESIDENT_SCENARIOS.find((s) => s.id === 'place-food')!;
    const base = { ...initialValues(place), title: 'Kawiarnia' };
    expect(Object.keys(validate(place, base)).sort()).toEqual(['cost', 'rating']);
    const values = { ...base, rating: '4', cost: 'cheap' };
    expect(validate(place, values)).toEqual({});
    const rows = describeDetails(place, toReport(place, values, null).details);
    expect(rows.find((r) => r.label === 'Ocena')?.text).toBe('★★★★☆');
    expect(rows.find((r) => r.label.startsWith('Ile kosztuje'))?.text).toBe('Tanio (do 20 zł)');
  });
});
