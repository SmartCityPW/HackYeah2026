"""Słownik gry z `config/seed/reference.yaml` jako jedyne źródło prawdy o postaciach, typach i przeciwnikach.

Z tego pliku powstają: wiersze w bazie (`seed.load_reference`), odpowiedź `GET /catalog` (z bazy, w tym samym kształcie
co `catalog_from_reference`), katalog dla atrap frontendu i `docs/db/seed_reference.sql` (`manage.py export_reference`).
Testy pilnują, że wygenerowane pliki są aktualne.
"""
from __future__ import annotations

import json
from pathlib import Path

import yaml
from django.conf import settings


def reference_path() -> Path:
    return settings.APP.path(settings.APP.seed.dir) / 'reference.yaml'


def read_reference(path: Path | None = None) -> dict:
    return yaml.safe_load((path or reference_path()).read_text(encoding='utf-8'))


def catalog_character(code: str, label: str, emoji: str, category_label: str, type_code: str, model_path: str | None,
                      is_starter: bool, is_event_exclusive: bool, base_power: int, power_growth: int) -> dict:
    """Jeden wpis `CatalogCharacter` z kontraktu (wspólny kształt dla bazy i YAML-a)."""
    return {
        'code': code, 'label': label, 'emoji': emoji, 'categoryLabel': category_label, 'typeCode': type_code, 'modelPath': model_path,
        'isStarter': is_starter, 'isEventExclusive': is_event_exclusive, 'basePower': base_power, 'powerGrowth': power_growth,
    }


def catalog_from_reference(data: dict) -> dict:
    """`Catalog` z kontraktu policzony wprost z YAML-a (bez bazy): to samo, co zwraca `GET /catalog` po seedzie."""
    return {
        'characters': [
            catalog_character(
                c['code'], c['label'], c['emoji'], c['category_label'], c['type'], c.get('model_path'), c.get('is_starter', False),
                c.get('is_event_exclusive', False), c['base_power'], c.get('power_growth', 5),
            )
            for c in data['characters']
        ],
        'types': [{'code': t['code'], 'name': t['name'], 'emoji': t['emoji']} for t in data['types']],
    }


def catalog_json(data: dict) -> str:
    return json.dumps(catalog_from_reference(data), ensure_ascii=False, indent=2) + '\n'


# ───────────────────────── seed_reference.sql ─────────────────────────

def _sql(value) -> str:
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _type_ref(code: str) -> str:
    return f'(SELECT id FROM collection_type WHERE code = {_sql(code)})'


def _insert(table: str, columns: list[str], rows: list[list[str]]) -> str:
    values = ',\n'.join('    (' + ', '.join(row) + ')' for row in rows)
    return f'INSERT INTO {table} ({", ".join(columns)}) VALUES\n{values};\n'


def reference_sql(data: dict) -> str:
    """`docs/db/seed_reference.sql` dla inicjalizacji bazy samym SQL-em (psql), wygenerowany z YAML-a."""
    char_cols = ['code', 'label', 'emoji', 'category_label', 'model_path', 'type_id', 'base_power', 'power_growth', 'is_starter', 'is_event_exclusive']
    enemy_cols = ['code', 'name', 'emoji', 'description', 'type_id', 'action_kind', 'action_label', 'min_level', 'max_level',
                  'base_power', 'power_growth', 'base_xp', 'spawn_weight']
    parts = [
        '-- WYGENEROWANY PLIK: nie edytować ręcznie. Źródło: backend/config/seed/reference.yaml\n'
        '-- Odtworzenie: (cd backend && python manage.py export_reference)\n'
        '-- Dane słownikowe: typy, postacie i szablony przeciwników. Uruchomić po schema.sql, przed seed_scenarios.sql.\n'
        'BEGIN;\n',
        _insert('collection_type', ['code', 'name', 'emoji'], [[_sql(t['code']), _sql(t['name']), _sql(t['emoji'])] for t in data['types']]),
        _insert('collection_character', char_cols, [[
            _sql(c['code']), _sql(c['label']), _sql(c['emoji']), _sql(c['category_label']), _sql(c.get('model_path')), _type_ref(c['type']),
            _sql(c['base_power']), _sql(c.get('power_growth', 5)), _sql(c.get('is_starter', False)), _sql(c.get('is_event_exclusive', False)),
        ] for c in data['characters']]),
        _insert('game_enemy_type', enemy_cols, [[
            _sql(e['code']), _sql(e['name']), _sql(e['emoji']), _sql(e.get('description', '')), _type_ref(e['type']),
            _sql(e.get('action_kind', 'checkin')), _sql(e['action_label']), _sql(e.get('min_level', 1)), _sql(e.get('max_level', 5)),
            _sql(e['base_power']), _sql(e.get('power_growth', 10)), _sql(e['base_xp']), _sql(e.get('spawn_weight', 1)),
        ] for e in data['enemy_types']]),
        'COMMIT;\n',
    ]
    return '\n'.join(parts)


def generated_files(data: dict) -> dict[Path, str]:
    """Pliki wygenerowane z YAML-a: ścieżka (z konfiguracji `contract`) → oczekiwana treść."""
    c = settings.APP.contract
    return {settings.APP.path(c.frontend_catalog_file): catalog_json(data), settings.APP.path(c.seed_reference_sql_file): reference_sql(data)}
