"""Weryfikacja pozycji gracza: dokładność, aktualność, teleportacja i źródło symulowane, dla KAŻDEJ akcji związanej z miejscem."""
import pytest
from dataclasses import replace
from datetime import datetime, timedelta, timezone as tz

from django.conf import settings
from django.core.management import call_command
from django.utils import timezone

from apps.game import location, services
from apps.game.location import Fix, LocationRejected
from apps.game.models import Attack, Encounter, EncounterCell, PlayerLocation
from apps.pokestops.models import Pokestop, Vote
from tests.conftest import FAR, NEAR, RYNEK, at, client_for, report_payload
from tests.test_game import LIST, age_attacks, attack_url, make_encounter

pytestmark = pytest.mark.django_db


@pytest.fixture
def strict(monkeypatch):
    """Konfiguracja jak na produkcji: wymagana dokładność i czas odczytu, pozycje symulowane niedozwolone."""

    def set_(**changes):
        cfg = replace(settings.APP.location, require_accuracy=True, require_timestamp=True, allow_simulated=False, **changes)
        monkeypatch.setattr(settings, 'APP', replace(settings.APP, location=cfg))

    set_()
    return set_


def fix(where=NEAR, **extra) -> dict:
    """Poprawny odczyt GPS (dokładny i świeży); `extra` nadpisuje pola."""
    base = {'lat': where[0], 'lng': where[1], 'accuracyM': 8, 'takenAt': timezone.now().isoformat(), 'source': 'gps'}
    base.update(extra)
    return base


def stop_for(author, make_resident):
    created = client_for(author).post('/api/v1/pokestops', report_payload(author, position=fix(RYNEK)), format='json')
    assert created.status_code == 201, created.data
    return created.data


def vote(user, stop_id, position):
    return client_for(user).post(f'/api/v1/pokestops/{stop_id}/vote', {'vote': 'for', 'pokemonId': user.pokemons.first().id, 'position': position}, format='json')


# ───────────── pojedyncze reguły (moduł location) ─────────────

def test_good_fix_is_accepted_and_remembered(strict, resident):
    location.verify(resident, Fix(*RYNEK, accuracy_m=10, taken_at=timezone.now()))
    saved = PlayerLocation.objects.get(user=resident)
    assert (saved.lat, saved.lng, saved.accuracy_m, saved.source) == (RYNEK[0], RYNEK[1], 10, 'gps')


@pytest.mark.parametrize('kwargs, code', [
    ({'accuracy_m': None, 'taken_at': 'now'}, 'accuracy_required'),
    ({'accuracy_m': 51, 'taken_at': 'now'}, 'gps_inaccurate'),
    ({'accuracy_m': 10, 'taken_at': None}, 'timestamp_required'),
    ({'accuracy_m': 10, 'taken_at': 'old'}, 'stale_position'),
    ({'accuracy_m': 10, 'taken_at': 'future'}, 'stale_position'),
    ({'accuracy_m': 10, 'taken_at': 'now', 'source': 'simulated'}, 'simulated_location_not_allowed'),
])
def test_untrustworthy_fixes_are_rejected_with_a_specific_code(strict, resident, kwargs, code):
    now = timezone.now()
    taken = {'now': now, 'old': now - timedelta(seconds=120), 'future': now + timedelta(seconds=60), None: None}[kwargs.pop('taken_at')]
    with pytest.raises(LocationRejected) as caught:
        location.verify(resident, Fix(*RYNEK, taken_at=taken, **kwargs), now=now)
    assert caught.value.code == code
    assert not PlayerLocation.objects.exists()  # odrzucona pozycja nie zostaje zapisana


def test_teleportation_between_actions_is_rejected_but_walking_is_not(strict, resident):
    now = timezone.now()
    location.verify(resident, Fix(*RYNEK, accuracy_m=5, taken_at=now), now=now)
    walk = now + timedelta(seconds=60)
    location.verify(resident, Fix(RYNEK[0] + 0.0004, RYNEK[1], accuracy_m=5, taken_at=walk), now=walk)  # ~45 m w minutę: spacer
    jump = walk + timedelta(seconds=10)
    with pytest.raises(LocationRejected) as caught:
        location.verify(resident, Fix(*FAR, accuracy_m=5, taken_at=jump), now=jump)  # ~1,1 km w 10 s
    assert 'Zbyt szybka' in caught.value.reason
    assert PlayerLocation.objects.get(user=resident).lat == pytest.approx(RYNEK[0] + 0.0004)  # nadal ostatnia dobra


def test_gps_jitter_is_not_movement(strict, resident):
    now = timezone.now()
    location.verify(resident, Fix(*RYNEK, accuracy_m=20, taken_at=now), now=now)
    later = now + timedelta(seconds=1)
    location.verify(resident, Fix(RYNEK[0] + 0.0004, RYNEK[1], accuracy_m=20, taken_at=later), now=later)  # ~45 m w 1 s, ale to szum przy dokładności 20 m


def test_thresholds_come_from_configuration(strict, resident):
    strict(max_accuracy_m=5)
    with pytest.raises(LocationRejected):
        location.verify(resident, Fix(*RYNEK, accuracy_m=8, taken_at=timezone.now()))
    strict(max_accuracy_m=5, max_age_seconds=1000)
    location.verify(resident, Fix(*RYNEK, accuracy_m=4, taken_at=timezone.now() - timedelta(seconds=500)))


def test_simulated_location_is_accepted_only_when_allowed_and_skips_movement_checks(strict, resident, monkeypatch):
    now = timezone.now()
    cfg = replace(settings.APP.location, allow_simulated=True)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, location=cfg))
    location.verify(resident, Fix(*RYNEK, taken_at=now, source='simulated'), now=now)  # bez dokładności: symulacja jej nie ma
    location.verify(resident, Fix(*FAR, taken_at=now, source='simulated'), now=now)  # "teleport" w trybie deweloperskim jest dozwolony
    assert PlayerLocation.objects.get(user=resident).source == 'simulated'


# ───────────── każda akcja związana z miejscem ─────────────

def test_vote_requires_a_trustworthy_position(strict, resident, make_resident):
    other = make_resident()
    stop = stop_for(resident, make_resident)
    assert vote(other, stop['id'], at(*NEAR)).data['code'] == 'accuracy_required'  # sama para współrzędnych nie wystarcza
    assert vote(other, stop['id'], fix(accuracyM=300)).data['code'] == 'gps_inaccurate'
    assert vote(other, stop['id'], fix(takenAt=(timezone.now() - timedelta(minutes=5)).isoformat())).data['code'] == 'stale_position'
    assert vote(other, stop['id'], fix(source='simulated')).data['code'] == 'simulated_location_not_allowed'
    assert not Vote.objects.exists()
    assert vote(other, stop['id'], fix()).status_code == 200


def test_new_pin_requires_a_trustworthy_position(strict, resident):
    bad = client_for(resident).post('/api/v1/pokestops', report_payload(resident, position=at(*RYNEK)), format='json')
    assert bad.status_code == 422 and bad.data['code'] == 'accuracy_required' and not Pokestop.objects.exists()
    assert client_for(resident).post('/api/v1/pokestops', report_payload(resident, position=fix(RYNEK)), format='json').status_code == 201


def test_listing_encounters_requires_a_trustworthy_position(strict, resident):
    base = {'lat': RYNEK[0], 'lng': RYNEK[1], 'radius': 50}
    bad = client_for(resident).get(LIST, base)
    assert bad.status_code == 422 and bad.data['code'] == 'accuracy_required' and not EncounterCell.objects.exists()
    assert client_for(resident).get(LIST, {**base, 'accuracyM': 900, 'takenAt': timezone.now().isoformat()}).data['code'] == 'gps_inaccurate'
    assert client_for(resident).get(LIST, {**base, 'accuracyM': 8, 'takenAt': timezone.now().isoformat()}).status_code == 200


def test_attack_requires_a_trustworthy_position_and_logs_the_rejection(strict, resident):
    enemy = make_encounter(resident, power=10)
    payload = {'lat': NEAR[0], 'lng': NEAR[1], 'pokemonIds': [resident.pokemons.first().id]}
    bad = client_for(resident).post(attack_url(enemy), payload, format='json')
    assert bad.status_code == 422 and bad.data['code'] == 'accuracy_required'
    assert Attack.objects.get().outcome == 'rejected' and Encounter.objects.get(pk=enemy.pk).status == 'active'
    age_attacks(resident)  # odrzucona próba też liczy się do limitu częstotliwości
    good = client_for(resident).post(attack_url(enemy), {**payload, 'accuracyM': 6, 'clientTime': timezone.now().isoformat()}, format='json')
    assert good.status_code == 200 and good.data['outcome'] == 'won'


def test_event_check_in_requires_a_trustworthy_position(strict, make_org, resident, monkeypatch):
    from apps.events import services as events

    now = datetime(2026, 10, 10, 8, 0, tzinfo=tz.utc)
    monkeypatch.setattr(events, '_now', lambda: now)
    owner, _ = make_org()
    ev = client_for(owner).post('/api/v1/events', {
        'title': 'Piknik', 'lat': RYNEK[0], 'lng': RYNEK[1], 'startsAt': (now - timedelta(hours=1)).isoformat(), 'endsAt': (now + timedelta(hours=5)).isoformat(),
        'rewardCharacter': 'gold_bike',
    }, format='json').data
    url = f"/api/v1/events/{ev['id']}/check-in"
    assert client_for(resident).post(url, {'position': at(*NEAR)}, format='json').data['code'] == 'accuracy_required'
    stale = fix(takenAt=(now - timedelta(minutes=5)).isoformat())
    assert client_for(resident).post(url, {'position': stale}, format='json').data['code'] == 'stale_position'
    assert client_for(resident).post(url, {'position': fix(takenAt=now.isoformat())}, format='json').status_code == 200


def test_survey_requires_a_trustworthy_position(strict, make_org, resident):
    owner, _ = make_org()
    payload = {
        'scenarioCode': 'org-tree', 'title': 'Lipy', 'lat': RYNEK[0], 'lng': RYNEK[1], 'position': fix(RYNEK), 'character': 'tree',
        'details': {'plantingType': 'new', 'species': 'linden', 'count': 5, 'rationale': 'Cień', 'contactPerson': 'Anna', 'contactEmail': 'a@b.pl'},
        'questions': [{'key': 'q1', 'label': 'Czy popierasz?', 'type': 'boolean'}],
    }
    stop = client_for(owner).post('/api/v1/pokestops', payload, format='json')
    # organizacja też przechodzi weryfikację pozycji (stawia pinezkę w swoim kółku)
    assert stop.status_code == 201, stop.data
    url = f"/api/v1/pokestops/{stop.data['id']}/survey-responses"
    assert client_for(resident).post(url, {'position': at(*NEAR), 'answers': {'q1': True}}, format='json').data['code'] == 'accuracy_required'
    assert client_for(resident).post(url, {'position': fix(), 'answers': {'q1': True}}, format='json').status_code == 201


def test_teleporting_between_different_actions_is_caught(strict, resident, make_resident):
    other = make_resident()
    stop = stop_for(resident, make_resident)
    assert vote(other, stop['id'], fix()).status_code == 200  # głos w Rynku
    far = client_for(other).get(LIST, {'lat': FAR[0], 'lng': FAR[1], 'accuracyM': 8, 'takenAt': timezone.now().isoformat()})
    assert far.status_code == 422 and far.data['code'] == 'implausible_movement'  # po sekundzie 1,1 km dalej: inna akcja, ta sama kontrola


def test_mocked_location_works_for_tests_when_explicitly_allowed(resident, make_resident):
    """Domyślna konfiguracja testów dopuszcza pozycje symulowane i nie wymaga dokładności: tak mockuje się lokalizację w testach i demo."""
    other = make_resident()
    stop = client_for(resident).post('/api/v1/pokestops', report_payload(resident, position={**at(*RYNEK), 'source': 'simulated'}), format='json').data
    assert vote(other, stop['id'], {**at(*NEAR), 'source': 'simulated'}).status_code == 200


# ───────────── czyszczenie przeciwników ─────────────

def test_prune_removes_old_finished_enemies_but_keeps_those_with_a_fight_trail(resident):
    old = timezone.now() - timedelta(hours=settings.APP.game.encounters.retention_hours + 1)
    gone = make_encounter(resident, power=10)
    kept = make_encounter(resident, power=999)
    fresh = make_encounter(resident, power=10)
    Encounter.objects.filter(pk__in=[gone.pk, kept.pk]).update(status='expired', expires_at=old)
    client_for(resident).post(attack_url(fresh), {'lat': NEAR[0], 'lng': NEAR[1], 'pokemonIds': [resident.pokemons.first().id]}, format='json')
    Attack.objects.create(encounter=kept, user=resident, lat=0, lng=0, distance_m=1, outcome='too_far')
    call_command('prune_encounters')
    remaining = set(Encounter.objects.values_list('pk', flat=True))
    assert gone.pk not in remaining and kept.pk in remaining and fresh.pk in remaining
