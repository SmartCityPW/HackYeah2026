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
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    types = {}
    for row in data['types']:
        obj, _ = PokemonType.objects.update_or_create(code=row['code'], defaults={'name': row['name'], 'emoji': row['emoji']})
        types[obj.code] = obj
    for row in data['characters']:
        defaults = {k: row[k] for k in CHARACTER_FIELDS if k in row}
        defaults['type'] = types[row['type']]
        Character.objects.update_or_create(code=row['code'], defaults=defaults)
    for row in data['enemy_types']:
        defaults = {k: row[k] for k in ENEMY_FIELDS if k in row}
        defaults['type'] = types[row['type']]
        EnemyType.objects.update_or_create(code=row['code'], defaults=defaults)
    return {'types': len(data['types']), 'characters': len(data['characters']), 'enemy_types': len(data['enemy_types'])}
