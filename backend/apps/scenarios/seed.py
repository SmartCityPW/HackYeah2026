"""Ładowanie katalogu scenariuszy z YAML (idempotentnie: scenariusz po `code`, jego pola odtwarzane od zera)."""
from pathlib import Path

import yaml
from django.db import transaction

from apps.collection.models import Character
from apps.scenarios.models import Field, FieldOption, Scenario, Section


@transaction.atomic
def load_scenarios(path: Path) -> int:
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    for index, row in enumerate(data['scenarios']):
        scenario, created = Scenario.objects.update_or_create(
            code=row['code'],
            defaults={
                'audience': row['audience'],
                'category': row.get('category'),
                'pokestop_type': row['pokestop_type'],
                'label': row['label'],
                'description': row.get('description', ''),
                'emoji': row['emoji'],
                'default_character': Character.objects.get(code=row['character']),
                'default_title': row.get('default_title'),
                'sort_order': row.get('sort_order', index),
            },
        )
        if not created:
            scenario.sections.all().delete()  # pola odtwarzamy z pliku (kaskadowo usuwa też opcje)
        for si, section_row in enumerate(row['sections']):
            section = Section.objects.create(scenario=scenario, title=section_row['title'], sort_order=si)
            for fi, f in enumerate(section_row['fields']):
                show_if = f.get('show_if')
                field = Field.objects.create(
                    scenario=scenario, section=section, field_key=f['key'], label=f['label'], field_type=f['type'],
                    required=f.get('required', False), hint=f.get('hint'), placeholder=f.get('placeholder'), unit=f.get('unit'),
                    min_value=f.get('min'), max_value=f.get('max'),
                    show_if_key=show_if['key'] if show_if else None, show_if_value=show_if['equals'] if show_if else None,
                    sort_order=fi,
                )
                FieldOption.objects.bulk_create(
                    FieldOption(field=field, value=o['value'], label=o['label'], sort_order=oi) for oi, o in enumerate(f.get('options', []))
                )
    return len(data['scenarios'])
