"""Ładowanie słowników gry z YAML (idempotentnie: update_or_create po `code`)."""
from pathlib import Path

import yaml
from django.db import transaction

from apps.collection.models import Character, PokemonType
from apps.game.models import EnemyType

CHARACTER_FIELDS = ('label', 'emoji', 'category_label', 'model_path', 'base_power', 'power_growth', 'is_starter', 'is_event_exclusive')
ENEMY_FIELDS = ('name', 'emoji', 'description', 'action_kind', 'action_label', 'min_level', 'max_level', 'base_power', 'power_growth', 'base_xp', 'spawn_weight')


@transaction.atomic
def load_reference(path: Path) -> dict[str, int]:
    """Słownik w bazie ma odpowiadać plikowi: wpisy spoza pliku zostają wyłączone (`is_active=False`), a nie usunięte,
    bo wskazują na nie posiadane pokemony i historia walk."""
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    codes = [c['code'] for c in data['characters']]
    starters = [c['code'] for c in data['characters'] if c.get('is_starter')]
    # Najpierw zdejmujemy flagę startowej z pozostałych postaci: w bazie może być tylko jedna (unikalny indeks).
    Character.objects.exclude(code__in=starters).update(is_starter=False)
    Character.objects.exclude(code__in=codes).update(is_active=False)
    EnemyType.objects.exclude(code__in=[e['code'] for e in data['enemy_types']]).update(is_active=False)
    types = {}
    for row in data['types']:
        obj, _ = PokemonType.objects.update_or_create(code=row['code'], defaults={'name': row['name'], 'emoji': row['emoji']})
        types[obj.code] = obj
    for row in data['characters']:
        defaults = {k: row[k] for k in CHARACTER_FIELDS if k in row}
        defaults.update(type=types[row['type']], is_active=True)
        Character.objects.update_or_create(code=row['code'], defaults=defaults)
    for row in data['enemy_types']:
        defaults = {k: row[k] for k in ENEMY_FIELDS if k in row}
        defaults.update(type=types[row['type']], is_active=True)
        EnemyType.objects.update_or_create(code=row['code'], defaults=defaults)
    return {'types': len(data['types']), 'characters': len(data['characters']), 'enemy_types': len(data['enemy_types'])}
