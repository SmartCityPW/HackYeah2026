import pytest

from tests.conftest import client_for

pytestmark = pytest.mark.django_db


def test_catalog_is_public_and_complete(anon):
    r = anon.get('/api/v1/catalog')
    assert r.status_code == 200
    assert sum(c['isStarter'] for c in r.data['characters']) == 1
    assert {t['code'] for t in r.data['types']} == {'transport', 'clean', 'green', 'energy', 'air', 'infra'}


def test_residents_and_orgs_get_their_own_catalogs(resident, make_org):
    user, _ = make_org()
    residents = client_for(resident).get('/api/v1/scenarios').data
    orgs = client_for(user).get('/api/v1/scenarios').data
    assert {s['audience'] for s in residents} == {'resident'} and len(residents) == 16
    assert {s['audience'] for s in orgs} == {'org'} and len(orgs) == 4


def test_category_filter_and_nested_field_shape(resident):
    places = client_for(resident).get('/api/v1/scenarios', {'category': 'place'}).data
    assert len(places) == 4 and all(s['pokestopType'] == 'place' for s in places)
    food = next(s for s in places if s['code'] == 'place-food')
    fields = {f['key']: f for s in food['sections'] for f in s['fields']}
    assert fields['rating']['type'] == 'rating' and fields['rating']['required'] is True
    assert [o['value'] for o in fields['cost']['options']] == ['free', 'cheap', 'medium', 'expensive']
    assert fields['shelter']['showIf'] if 'shelter' in fields else True


def test_conditional_fields_expose_show_if(make_org):
    user, _ = make_org()
    bus = next(s for s in client_for(user).get('/api/v1/scenarios').data if s['code'] == 'org-bus-stop')
    fields = {f['key']: f for s in bus['sections'] for f in s['fields']}
    assert fields['shelterSize']['showIf'] == {'key': 'shelter', 'equals': True}
    assert fields['shelterLength']['max'] == 20.0


def test_seeding_is_idempotent(resident):
    from apps.scenarios.models import Field, Scenario
    from apps.scenarios.seed import load_scenarios
    from django.conf import settings

    before = (Scenario.objects.count(), Field.objects.count())
    load_scenarios(settings.APP.path(settings.APP.seed.dir) / 'scenarios.yaml')
    assert (Scenario.objects.count(), Field.objects.count()) == before
