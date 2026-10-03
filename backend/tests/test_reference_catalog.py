"""Jedno źródło prawdy o postaciach: config/seed/reference.yaml → baza, GET /catalog i pliki generowane z YAML-a."""
import pytest
import yaml

from apps.collection.catalog import catalog_from_reference, generated_files, read_reference
from apps.collection.models import Character
from apps.collection.seed import load_reference
from apps.game.models import EnemyType

pytestmark = pytest.mark.django_db


def test_catalog_endpoint_is_exactly_the_reference_file(anon):
    assert anon.get('/api/v1/catalog').json() == catalog_from_reference(read_reference())


def test_generated_files_are_up_to_date():
    stale = []
    for path, expected in generated_files(read_reference()).items():
        if not path.parent.is_dir():
            pytest.skip(f'brak {path.parent} w tym środowisku (np. obraz Dockera bez frontendu i docs/)')
        if not path.is_file() or path.read_text(encoding='utf-8') != expected:
            stale.append(str(path))
    assert not stale, f'Nieaktualne pliki generowane z reference.yaml: {stale}. Uruchom: python manage.py export_reference'


def test_reference_file_is_consistent():
    data = read_reference()
    types = {t['code'] for t in data['types']}
    characters = [c['code'] for c in data['characters']]
    assert len(characters) == len(set(characters)), 'powtórzony kod postaci'
    assert sum(bool(c.get('is_starter')) for c in data['characters']) == 1, 'dokładnie jedna postać startowa'
    assert not any(c.get('is_starter') and c.get('is_event_exclusive') for c in data['characters'])
    assert {c['type'] for c in data['characters']} | {e['type'] for e in data['enemy_types']} <= types


def test_scenarios_use_only_characters_from_the_reference_file(settings):
    scenarios = yaml.safe_load((settings.APP.path(settings.APP.seed.dir) / 'scenarios.yaml').read_text(encoding='utf-8'))
    codes = {c['code'] for c in read_reference()['characters']}
    rows = scenarios if isinstance(scenarios, list) else scenarios['scenarios']
    unknown = {s['character'] for s in rows} - codes
    assert not unknown, f'scenarios.yaml wskazuje postacie spoza reference.yaml: {unknown}'


def test_replacing_the_set_deactivates_old_characters_and_moves_the_starter(tmp_path, anon, make_resident):
    data = read_reference()
    old = set(Character.objects.filter(is_active=True).values_list('code', flat=True))
    data['characters'] = [
        {'code': 'sprytek', 'label': 'Sprytek', 'emoji': '🦊', 'category_label': 'Test', 'type': 'green', 'base_power': 21, 'is_starter': True},
        {'code': 'iskra', 'label': 'Iskra', 'emoji': '⚡', 'category_label': 'Test', 'type': 'energy', 'base_power': 19},
    ]
    data['enemy_types'] = data['enemy_types'][:1]
    path = tmp_path / 'reference.yaml'
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding='utf-8')

    load_reference(path)
    assert anon.get('/api/v1/catalog').json() == catalog_from_reference(data)
    assert set(Character.objects.filter(is_active=False).values_list('code', flat=True)) == old
    assert EnemyType.objects.filter(is_active=True).count() == 1
    assert make_resident().pokemons.get().character.code == 'sprytek'  # nowe konto dostaje nową postać startową
    load_reference(path)  # ponowne wczytanie niczego nie psuje
    assert Character.objects.filter(is_starter=True).count() == 1
