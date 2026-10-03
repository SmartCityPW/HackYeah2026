// Generuje z katalogu scenariuszy we frontendzie (src/app/core/scenario.catalog.ts):
//   docs/db/seed_scenarios.sql            (referencyjny DDL)
//   backend/config/seed/scenarios.yaml    (seed backendu Django)
// Uruchomienie: npm run db:seed-scenarios
// Po przejęciu katalogu przez backend ten skrypt przestaje być potrzebny.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

const bundle = await build({
  entryPoints: ['src/app/core/scenario.catalog.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  tsconfigRaw: '{}',
});
const { RESIDENT_SCENARIOS, ORG_SCENARIOS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const q = (v) => (v === undefined || v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
const n = (v) => (v === undefined || v === null ? 'NULL' : String(v));
const scenarioId = (code) => `(SELECT id FROM scenarios_scenario WHERE code = ${q(code)})`;

const lines = [
  '-- WYGENEROWANY PLIK: nie edytować ręcznie. Źródło: frontend/src/app/core/scenario.catalog.ts',
  '-- Odtworzenie: (cd frontend && npm run db:seed-scenarios)',
  '-- Wymaga wcześniej: schema.sql i seed_reference.sql.',
  'BEGIN;',
  '',
];

[...RESIDENT_SCENARIOS, ...ORG_SCENARIOS].forEach((s, index) => {
  lines.push(`-- ${s.label}`);
  lines.push(
    'INSERT INTO scenarios_scenario (code, audience, category, pokestop_type, label, description, emoji, default_character_id, default_title, sort_order) VALUES',
    `  (${q(s.id)}, ${q(s.audience)}, ${q(s.category)}, ${q(s.pokestopType)}, ${q(s.label)}, ${q(s.description)}, ${q(s.emoji)}, (SELECT id FROM collection_character WHERE code = ${q(s.character)}), ${q(s.defaultTitle)}, ${index});`,
  );
  s.sections.forEach((section, si) => {
    lines.push(`INSERT INTO scenarios_section (scenario_id, title, sort_order) VALUES (${scenarioId(s.id)}, ${q(section.title)}, ${si});`);
    const sectionRef = `(SELECT id FROM scenarios_section WHERE scenario_id = ${scenarioId(s.id)} AND sort_order = ${si})`;
    const rows = section.fields.map((f, fi) => {
      const showIf = f.showIf ? [q(f.showIf.key), `${q(JSON.stringify(f.showIf.equals))}::jsonb`] : ['NULL', 'NULL'];
      return `  (${scenarioId(s.id)}, ${sectionRef}, ${q(f.key)}, ${q(f.label)}, ${q(f.type)}, ${f.required ? 'true' : 'false'}, ${q(f.hint)}, ${q(f.placeholder)}, ${q(f.unit)}, ${n(f.min)}, ${n(f.max)}, ${showIf.join(', ')}, ${fi})`;
    });
    lines.push(
      'INSERT INTO scenarios_field (scenario_id, section_id, field_key, label, field_type, required, hint, placeholder, unit, min_value, max_value, show_if_key, show_if_value, sort_order) VALUES',
      `${rows.join(',\n')};`,
    );
    for (const f of section.fields.filter((x) => x.options?.length)) {
      const fieldRef = `(SELECT id FROM scenarios_field WHERE scenario_id = ${scenarioId(s.id)} AND field_key = ${q(f.key)})`;
      const opts = f.options.map((o, oi) => `  (${fieldRef}, ${q(o.value)}, ${q(o.label)}, ${oi})`);
      lines.push('INSERT INTO scenarios_field_option (field_id, value, label, sort_order) VALUES', `${opts.join(',\n')};`);
    }
  });
  lines.push('');
});

lines.push('COMMIT;', '');
writeFileSync('../docs/db/seed_scenarios.sql', lines.join('\n'));

// --- seed YAML dla backendu (skalary w cudzysłowach JSON, pola jako jednowierszowe mapy w stylu flow)
const j = JSON.stringify;
const y = ['# WYGENEROWANY PLIK: nie edytować ręcznie. Źródło: frontend/src/app/core/scenario.catalog.ts', '# Odtworzenie: (cd frontend && npm run db:seed-scenarios)', 'scenarios:'];
[...RESIDENT_SCENARIOS, ...ORG_SCENARIOS].forEach((s, index) => {
  y.push(`  - code: ${j(s.id)}`, `    audience: ${j(s.audience)}`, `    category: ${j(s.category ?? null)}`, `    pokestop_type: ${j(s.pokestopType)}`, `    label: ${j(s.label)}`, `    description: ${j(s.description)}`, `    emoji: ${j(s.emoji)}`, `    character: ${j(s.character)}`, `    default_title: ${j(s.defaultTitle ?? null)}`, `    sort_order: ${index}`, '    sections:');
  for (const section of s.sections) {
    y.push(`      - title: ${j(section.title)}`, '        fields:');
    for (const f of section.fields) {
      const field = { key: f.key, label: f.label, type: f.type, required: !!f.required, hint: f.hint, placeholder: f.placeholder, unit: f.unit, min: f.min, max: f.max, show_if: f.showIf ? { key: f.showIf.key, equals: f.showIf.equals } : undefined, options: f.options };
      y.push(`          - ${j(field)}`);
    }
  }
});
writeFileSync('../backend/config/seed/scenarios.yaml', y.join('\n') + '\n');
console.log(`Zapisano docs/db/seed_scenarios.sql (${RESIDENT_SCENARIOS.length + ORG_SCENARIOS.length} scenariuszy)`);
