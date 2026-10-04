"""Wydarzenia "cool thing": rzadki pokemon za obecność na miejscu i w czasie trwania."""
import pytest
from datetime import datetime, timedelta, timezone as tz

from apps.collection.models import Character, Pokemon, PokemonOrigin
from apps.events import services
from apps.events.models import Event, Participation
from tests.conftest import FAR, NEAR, RYNEK, at, client_for

pytestmark = pytest.mark.django_db
URL = '/api/v1/events'
# 10.10.2026 08:00 UTC = 10:00 w Warszawie (CEST, UTC+2).
NOW = datetime(2026, 10, 10, 8, 0, tzinfo=tz.utc)


@pytest.fixture(autouse=True)
def frozen_now(monkeypatch):
    clock = {'now': NOW}
    monkeypatch.setattr(services, '_now', lambda: clock['now'])
    return clock


def iso(moment: datetime) -> str:
    return moment.isoformat()


def payload(**extra) -> dict:
    body = {
        'title': 'Rowerowy piknik na Rynku', 'description': 'Zapraszamy na wspólną jazdę', 'address': 'Rynek Główny 1',
        'lat': RYNEK[0], 'lng': RYNEK[1], 'startsAt': iso(NOW - timedelta(hours=1)), 'endsAt': iso(NOW + timedelta(hours=5)),
        'rewardCharacter': 'gold_bike',
    }
    body.update(extra)
    return body


@pytest.fixture
def event(make_org):
    owner, org = make_org()
    response = client_for(owner).post(URL, payload(), format='json')
    assert response.status_code == 201, response.data
    return owner, org, response.data


def check_in(user, event_id, where=NEAR, **extra):
    return client_for(user).post(f'{URL}/{event_id}/check-in', {'position': {**at(*where), **extra}}, format='json')


# ───────────── tworzenie ─────────────

def test_catalog_has_rare_species_exclusive_to_events():
    exclusive = Character.objects.filter(is_event_exclusive=True, is_active=True)
    assert exclusive.count() >= 6 and {c.type.code for c in exclusive} == {'transport', 'clean', 'green', 'energy', 'air', 'infra'}
    assert all(c.base_power > Character.objects.filter(is_event_exclusive=False).order_by('-base_power').first().base_power for c in exclusive)


def test_verified_org_creates_an_event_with_announcement_fields(event):
    owner, org, data = event
    assert data['organization'] == org.name and data['rewardCharacter'] == 'gold_bike' and data['status'] == 'scheduled'
    assert data['phase'] == 'ongoing' and data['activeNow'] is True and data['mine'] is True
    assert data['participantCount'] == 0 and data['checkedIn'] is False and data['dailyFrom'] is None and data['nextWindowStart'] is None


def test_only_verified_orgs_create_events(make_org, resident, admin):
    pending, _ = make_org(verified=False)
    denied = client_for(pending).post(URL, payload(), format='json')
    assert denied.status_code == 403 and denied.data['code'] == 'organization_not_verified'
    assert client_for(resident).post(URL, payload(), format='json').status_code == 403
    assert client_for(admin).post(URL, payload(), format='json').status_code == 403


@pytest.mark.parametrize('extra, field', [
    ({'rewardCharacter': 'bicycle'}, 'rewardCharacter'),  # zwykły gatunek: nie jest rzadki
    ({'rewardCharacter': 'nie_ma_takiego'}, 'rewardCharacter'),
    ({'startsAt': iso(NOW + timedelta(hours=3)), 'endsAt': iso(NOW + timedelta(hours=2))}, 'endsAt'),
    ({'startsAt': iso(NOW - timedelta(days=2)), 'endsAt': iso(NOW - timedelta(days=1))}, 'endsAt'),  # już po wszystkim
    ({'endsAt': iso(NOW + timedelta(days=40))}, 'endsAt'),  # dłużej niż events.max_duration_days
    ({'dailyFrom': '10:00'}, 'dailyFrom'),
    ({'dailyFrom': '18:00', 'dailyTo': '10:00'}, 'dailyTo'),
    ({'ageMin': 16, 'ageMax': 12}, 'ageMax'),
    ({'title': 'ab'}, 'title'),
    ({'capacity': 0}, 'capacity'),
])
def test_invalid_events_are_rejected(make_org, extra, field):
    owner, _ = make_org()
    bad = client_for(owner).post(URL, payload(**extra), format='json')
    assert bad.status_code == 422 and field in bad.data['fields']
    assert not Event.objects.exists()


# ───────────── lista i szczegóły ─────────────

def test_list_shows_events_in_window_and_area_and_flags_my_checkin(event, resident):
    _, _, data = event
    other = Event.objects.get(pk=data['id'])
    other.pk = None
    other.starts_at, other.ends_at, other.title = NOW + timedelta(days=30), NOW + timedelta(days=31), 'Za miesiąc'
    other.save()
    c = client_for(resident)
    listed = c.get(URL).data
    assert [e['title'] for e in listed['results']] == ['Rowerowy piknik na Rynku']  # okno domyślne: najbliższe 14 dni
    assert c.get(URL, {'to': iso(NOW + timedelta(days=40))}).data['count'] == 2
    assert c.get(URL, {'bbox': '19.9,50.0,20.0,50.1'}).data['count'] == 1
    assert c.get(URL, {'bbox': '10,10,11,11'}).data['count'] == 0
    check_in(resident, data['id'])
    after = c.get(URL).data['results'][0]
    assert after['checkedIn'] is True and after['participantCount'] == 1


def test_detail_is_open_before_the_start_with_the_next_window(make_org, resident):
    owner, _ = make_org()
    future = client_for(owner).post(URL, payload(startsAt=iso(NOW + timedelta(days=1)), endsAt=iso(NOW + timedelta(days=3))), format='json').data
    shown = client_for(resident).get(f'{URL}/{future["id"]}').data
    assert shown['phase'] == 'upcoming' and shown['activeNow'] is False and shown['rewardCharacter'] == 'gold_bike'
    assert shown['nextWindowStart'] == '2026-10-11T10:00:00+02:00'


# ───────────── odbiór nagrody ─────────────

def test_check_in_in_range_and_time_grants_the_rare_pokemon_once(event, resident):
    _, _, data = event
    ok = check_in(resident, data['id'])
    assert ok.status_code == 200, ok.data
    assert ok.data['pokemon']['character'] == 'gold_bike' and ok.data['event']['checkedIn'] is True and ok.data['event']['participantCount'] == 1
    reward = Pokemon.objects.get(pk=ok.data['pokemon']['id'])
    assert reward.user == resident and reward.origin == PokemonOrigin.EVENT
    again = check_in(resident, data['id'])
    assert again.status_code == 409 and again.data['code'] == 'already_checked_in'
    assert Pokemon.objects.filter(user=resident, origin=PokemonOrigin.EVENT).count() == 1


def test_check_in_requires_being_in_the_circle(event, resident):
    _, _, data = event
    far = check_in(resident, data['id'], where=FAR)
    assert far.status_code == 422 and far.data['code'] == 'too_far' and far.data['radiusM'] == 50
    assert not Participation.objects.exists()


def test_check_in_is_refused_before_start_and_after_end(make_org, resident, frozen_now):
    owner, _ = make_org()
    ev = client_for(owner).post(URL, payload(startsAt=iso(NOW + timedelta(hours=2)), endsAt=iso(NOW + timedelta(hours=4))), format='json').data
    early = check_in(resident, ev['id'])
    assert early.status_code == 409 and early.data['code'] == 'outside_time_window' and '10.10 12:00' in early.data['message']
    frozen_now['now'] = NOW + timedelta(hours=3)
    assert check_in(resident, ev['id']).status_code == 200
    late_user = Pokemon.objects.first().user  # inny mieszkaniec nie jest potrzebny: po końcu sprawdzamy ten sam kod
    frozen_now['now'] = NOW + timedelta(hours=5)
    ended = client_for(late_user).get(f'{URL}/{ev["id"]}').data
    assert ended['phase'] == 'ended' and ended['activeNow'] is False and ended['nextWindowStart'] is None


def test_daily_hours_limit_when_the_reward_can_be_collected(make_org, make_resident, frozen_now):
    owner, _ = make_org()
    ev = client_for(owner).post(URL, payload(startsAt=iso(NOW - timedelta(hours=1)), endsAt=iso(NOW + timedelta(days=2, hours=10)),
                                              dailyFrom='10:00', dailyTo='18:00'), format='json').data
    assert ev['dailyFrom'] == '10:00' and ev['dailyTo'] == '18:00' and ev['activeNow'] is True
    first, second = make_resident('pierwszy'), make_resident('drugi')

    frozen_now['now'] = datetime(2026, 10, 10, 17, 0, tzinfo=tz.utc)  # 19:00 w Warszawie: po godzinach
    closed = check_in(first, ev['id'])
    assert closed.status_code == 409 and closed.data['code'] == 'outside_time_window' and '11.10 10:00' in closed.data['message']
    assert client_for(first).get(f'{URL}/{ev["id"]}').data['nextWindowStart'] == '2026-10-11T10:00:00+02:00'

    frozen_now['now'] = datetime(2026, 10, 11, 9, 0, tzinfo=tz.utc)  # drugi dzień, 11:00: w godzinach
    assert check_in(first, ev['id']).status_code == 200
    frozen_now['now'] = datetime(2026, 10, 12, 9, 0, tzinfo=tz.utc)  # trzeci dzień: nowy uczestnik odbiera, ten sam już nie
    assert check_in(second, ev['id']).status_code == 200
    assert check_in(first, ev['id']).data['code'] == 'already_checked_in'


def test_capacity_limits_participants(make_org, make_resident):
    owner, _ = make_org()
    ev = client_for(owner).post(URL, payload(capacity=1), format='json').data
    assert check_in(make_resident('a'), ev['id']).status_code == 200
    full = check_in(make_resident('b'), ev['id'])
    assert full.status_code == 409 and full.data['code'] == 'capacity_reached'


def test_inaccurate_gps_is_refused(event, resident):
    _, _, data = event
    bad = check_in(resident, data['id'], accuracyM=500)
    assert bad.status_code == 422 and bad.data['code'] == 'gps_inaccurate' and not Participation.objects.exists()
    assert check_in(resident, data['id'], accuracyM=8).status_code == 200


def test_only_residents_collect_rewards(event, make_org, admin):
    _, _, data = event
    other_org, _ = make_org()
    assert check_in(event[0], data['id']).status_code == 403
    assert check_in(other_org, data['id']).status_code == 403
    assert check_in(admin, data['id']).status_code == 403


# ───────────── odwoływanie ─────────────

def test_cancelling_hides_the_event_and_blocks_check_in(event, resident, make_org, admin):
    owner, _, data = event
    foreign, _ = make_org()
    assert client_for(resident).patch(f'{URL}/{data["id"]}', {'status': 'cancelled'}, format='json').status_code == 403
    assert client_for(foreign).patch(f'{URL}/{data["id"]}', {'status': 'cancelled'}, format='json').status_code == 403
    done = client_for(owner).patch(f'{URL}/{data["id"]}', {'status': 'cancelled'}, format='json')
    assert done.status_code == 200 and done.data['status'] == 'cancelled' and done.data['phase'] == 'cancelled' and done.data['activeNow'] is False
    assert client_for(owner).patch(f'{URL}/{data["id"]}', {'status': 'cancelled'}, format='json').status_code == 200  # idempotentnie

    cancelled = check_in(resident, data['id'])
    assert cancelled.status_code == 409 and cancelled.data['code'] == 'event_cancelled'
    assert client_for(resident).get(URL).data['count'] == 0 and client_for(resident).get(f'{URL}/{data["id"]}').status_code == 404
    assert client_for(owner).get(URL, {'organizationId': Event.objects.get().organization_id}).data['count'] == 1  # organizator widzi swoje odwołane
    assert client_for(admin).get(f'{URL}/{data["id"]}').status_code == 200


def test_admin_can_cancel_any_event(event, admin):
    _, _, data = event
    assert client_for(admin).patch(f'{URL}/{data["id"]}', {'status': 'cancelled'}, format='json').status_code == 200


def test_events_require_authentication():
    assert client_for().get(URL).status_code == 401


# ───────────── logika czasu ─────────────

@pytest.mark.parametrize('local_hour, active', [(9, False), (10, True), (14, True), (18, True), (19, False)])
def test_daily_window_boundaries_are_inclusive(make_org, local_hour, active):
    owner, org = make_org()
    ev = Event.objects.create(
        organization=org, created_by=owner, title='Targi', lat=50, lng=19, starts_at=NOW - timedelta(days=1), ends_at=NOW + timedelta(days=5),
        daily_from=datetime.strptime('10:00', '%H:%M').time(), daily_to=datetime.strptime('18:00', '%H:%M').time(),
        reward_character=Character.objects.get(code='lantern'),
    )
    moment = datetime(2026, 10, 10, local_hour - 2, 0, tzinfo=tz.utc)
    assert services.is_active_now(ev, moment) is active
    assert services.phase(ev, moment) == 'ongoing'
