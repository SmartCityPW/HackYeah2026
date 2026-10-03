"""Losy inicjatywy: oś czasu, wpisy organizatora, pola własne i prowadzenie statusu."""
import pytest
from dataclasses import replace

from django.conf import settings

from apps.pokestops.models import Pokestop
from tests.conftest import RYNEK, at, client_for, report_payload

pytestmark = pytest.mark.django_db
URL = '/api/v1/pokestops'
ORG_PAYLOAD = {
    'scenarioCode': 'org-tree', 'title': 'Nasadzenie lip', 'lat': RYNEK[0], 'lng': RYNEK[1], 'position': at(*RYNEK), 'character': 'tree',
    'details': {'plantingType': 'new', 'species': 'linden', 'count': 5, 'rationale': 'Cień', 'contactPerson': 'Anna', 'contactEmail': 'a@b.pl'},
}


@pytest.fixture
def initiative(make_org):
    owner, org = make_org()
    stop = client_for(owner).post(URL, ORG_PAYLOAD, format='json').data
    return owner, org, stop


def entries(user, stop_id):
    response = client_for(user).get(f'{URL}/{stop_id}/timeline')
    assert response.status_code == 200
    return response.data['results']


def test_new_initiative_starts_its_timeline_with_a_created_entry(initiative, resident):
    owner, org, stop = initiative
    items = entries(resident, stop['id'])
    assert [i['kind'] for i in items] == ['created'] and items[0]['author'] == org.name
    assert stop['customFields'] == [] and stop['updateCount'] == 0


def test_owner_adds_edits_and_deletes_updates(initiative, resident):
    owner, org, stop = initiative
    c = client_for(owner)
    created = c.post(f'{URL}/{stop["id"]}/updates', {'title': 'Dziś rada miasta zajęła się sprawą', 'body': 'Radni poparli projekt'}, format='json')
    assert created.status_code == 201 and created.data['kind'] == 'update' and created.data['author'] == org.name and created.data['editable'] is True
    uid = created.data['id']
    assert client_for(resident).get(f'{URL}/{stop["id"]}').data['updateCount'] == 1
    seen = entries(resident, stop['id'])
    assert [i['kind'] for i in seen] == ['update', 'created'] and seen[0]['editable'] is False  # mieszkaniec nie edytuje

    edited = c.patch(f'{URL}/{stop["id"]}/updates/{uid}', {'title': 'Jutro sadzimy pierwsze drzewko'}, format='json')
    assert edited.status_code == 200 and edited.data['title'] == 'Jutro sadzimy pierwsze drzewko' and edited.data['body'] == 'Radni poparli projekt'
    assert c.delete(f'{URL}/{stop["id"]}/updates/{uid}').status_code == 204
    assert [i['kind'] for i in entries(resident, stop['id'])] == ['created']


def test_residents_and_foreign_orgs_cannot_manage(initiative, resident, make_org):
    owner, org, stop = initiative
    other, _ = make_org()
    for user in (resident, other):
        c = client_for(user)
        assert c.post(f'{URL}/{stop["id"]}/updates', {'title': 'Wpis'}, format='json').status_code == 403
        assert c.patch(f'{URL}/{stop["id"]}', {'status': 'in_progress'}, format='json').status_code == 403
        assert c.patch(f'{URL}/{stop["id"]}', {'title': 'Przejęta'}, format='json').status_code == 403


def test_suspended_organization_cannot_manage(initiative):
    owner, org, stop = initiative
    org.verification_status, org.verified_at = 'suspended', None
    org.save()
    assert client_for(owner).post(f'{URL}/{stop["id"]}/updates', {'title': 'Wpis'}, format='json').status_code == 403


def test_update_validation_and_limits_come_from_config(initiative, monkeypatch):
    owner, _, stop = initiative
    c = client_for(owner)
    assert c.post(f'{URL}/{stop["id"]}/updates', {'title': '   '}, format='json').status_code == 422
    too_long = c.post(f'{URL}/{stop["id"]}/updates', {'title': 'x' * 121}, format='json')
    assert too_long.status_code == 422 and 'title' in too_long.data['fields']
    timeline = replace(settings.APP.pokestops.timeline, max_updates_per_pokestop=1)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, pokestops=replace(settings.APP.pokestops, timeline=timeline)))
    assert c.post(f'{URL}/{stop["id"]}/updates', {'title': 'Pierwszy'}, format='json').status_code == 201
    assert c.post(f'{URL}/{stop["id"]}/updates', {'title': 'Drugi'}, format='json').status_code == 409


def test_owner_sets_status_with_a_note_and_residents_see_it_in_the_log(initiative, resident):
    owner, org, stop = initiative
    c = client_for(owner)
    assert c.patch(f'{URL}/{stop["id"]}', {'status': 'in_progress', 'note': 'Przetarg rozstrzygnięty'}, format='json').data['status'] == 'in_progress'
    assert c.patch(f'{URL}/{stop["id"]}', {'status': 'resolved'}, format='json').data['status'] == 'resolved'
    items = entries(resident, stop['id'])
    changes = [i for i in items if i['kind'] == 'status']
    assert [(i['fromStatus'], i['toStatus']) for i in changes] == [('in_progress', 'resolved'), ('open', 'in_progress')]
    assert changes[1]['body'] == 'Przetarg rozstrzygnięty' and changes[1]['author'] == org.name


def test_only_admin_rejects_and_admin_appears_as_administrator(initiative, admin, resident):
    owner, _, stop = initiative
    assert client_for(owner).patch(f'{URL}/{stop["id"]}', {'status': 'rejected', 'note': 'Nie'}, format='json').status_code == 403
    assert client_for(admin).patch(f'{URL}/{stop["id"]}', {'status': 'in_progress'}, format='json').status_code == 200
    assert entries(resident, stop['id'])[0]['author'] == 'Administrator'
    assert client_for(admin).post(f'{URL}/{stop["id"]}/updates', {'title': 'Wyjaśnienie'}, format='json').status_code == 201


def test_owner_edits_content_and_custom_fields(initiative, resident):
    owner, _, stop = initiative
    fields = [{'label': 'Budżet', 'value': '12 000 zł'}, {'label': 'Termin', 'value': 'jesień 2026'}]
    ok = client_for(owner).patch(f'{URL}/{stop["id"]}', {'title': 'Nasadzenie lip przy Rynku', 'description': 'Opis', 'customFields': fields}, format='json')
    assert ok.status_code == 200 and ok.data['title'] == 'Nasadzenie lip przy Rynku' and ok.data['customFields'] == fields
    assert client_for(resident).get(f'{URL}/{stop["id"]}').data['customFields'] == fields
    cleared = client_for(owner).patch(f'{URL}/{stop["id"]}', {'customFields': []}, format='json')
    assert cleared.data['customFields'] == []


@pytest.mark.parametrize('fields', [
    [{'label': '', 'value': 'x'}],
    [{'label': 'A', 'value': 'x'}, {'label': 'a', 'value': 'y'}],
    [{'label': 'A' * 41, 'value': 'x'}],
    [{'label': f'E{i}', 'value': 'x'} for i in range(11)],
])
def test_invalid_custom_fields_are_rejected(initiative, fields):
    owner, _, stop = initiative
    assert client_for(owner).patch(f'{URL}/{stop["id"]}', {'customFields': fields}, format='json').status_code == 422


def test_resident_report_content_is_not_editable_even_by_admin(resident, admin):
    created = client_for(resident).post(URL, report_payload(resident), format='json').data
    assert client_for(admin).patch(f'{URL}/{created["id"]}', {'title': 'Zmieniony'}, format='json').status_code == 403
    assert client_for(admin).post(f'{URL}/{created["id"]}/updates', {'title': 'Urząd zajął się sprawą'}, format='json').status_code == 201


def test_empty_patch_and_rejected_initiative_visibility(initiative, resident, admin):
    owner, _, stop = initiative
    assert client_for(owner).patch(f'{URL}/{stop["id"]}', {}, format='json').status_code == 422
    client_for(admin).patch(f'{URL}/{stop["id"]}', {'status': 'rejected', 'note': 'Spam'}, format='json')
    assert client_for(resident).get(f'{URL}/{stop["id"]}/timeline').status_code == 404
    assert client_for(owner).post(f'{URL}/{stop["id"]}/updates', {'title': 'Wpis'}, format='json').status_code == 404
    assert Pokestop.objects.get(pk=stop['id']).status == 'rejected'
