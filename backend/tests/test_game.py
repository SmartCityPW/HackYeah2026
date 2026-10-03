from dataclasses import replace
from datetime import timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.collection.models import Pokemon, PokemonOrigin
from apps.game import services
from apps.game.models import Attack, AttackPokemon, Encounter, EncounterCell, EncounterStatus, EnemyType, PlayerProgress
from tests.conftest import FAR, NEAR, RYNEK, client_for

pytestmark = pytest.mark.django_db
LIST = '/api/v1/encounters'


def attack_url(encounter: Encounter) -> str:
    return f'{LIST}/{encounter.id}/attack'


def make_encounter(power: int = 10, at=RYNEK, enemy: str = 'trash_beast', **extra) -> Encounter:
    return Encounter.objects.create(
        enemy_type=EnemyType.objects.get(code=enemy), level=1, power=power, xp_reward=25, lat=at[0], lng=at[1],
        expires_at=timezone.now() + timedelta(minutes=30), **extra,
    )


def body(user, at=NEAR, **extra) -> dict:
    return {'lat': at[0], 'lng': at[1], 'pokemonIds': [user.pokemons.first().id], **extra}


def age_attacks(user, seconds: int = 3600) -> None:
    """Przesuwa zapisane próby w przeszłość, żeby kolejna nie wpadła w limit częstotliwości ani kontrolę tempa."""
    Attack.objects.filter(user=user).update(created_at=timezone.now() - timedelta(seconds=seconds))


@pytest.fixture
def game_config(monkeypatch):
    def set_(**sections):
        game = settings.APP.game
        for name, values in sections.items():
            game = replace(game, **{name: replace(getattr(game, name), **values)})
        monkeypatch.setattr(settings, 'APP', replace(settings.APP, game=game))

    return set_


# ───────────── przeciwnicy w okolicy ─────────────

def test_encounters_are_tied_to_places_and_shared_between_players(resident, make_resident, game_config):
    game_config(encounters={'max_per_cell': 6})
    services.rng.seed(1)
    first = client_for(resident).get(LIST, {'lat': RYNEK[0], 'lng': RYNEK[1], 'radius': 50})
    assert first.status_code == 200, first.data
    assert EncounterCell.objects.exists() and Encounter.objects.filter(cell__isnull=False).exists()
    again = client_for(make_resident()).get(LIST, {'lat': RYNEK[0], 'lng': RYNEK[1], 'radius': 50}).data
    assert [e['id'] for e in again] == [e['id'] for e in first.data]  # ci sami przeciwnicy dla innego gracza
    for e in first.data:
        assert set(e) == {'id', 'name', 'emoji', 'level', 'typeCode', 'power', 'description', 'actionLabel', 'xpReward', 'lat', 'lng', 'expiresAt'}


def test_response_is_limited_to_nearest_in_radius(resident, game_config):
    game_config(encounters={'max_in_response': 2})
    services.rng.seed(2)
    data = client_for(resident).get(LIST, {'lat': RYNEK[0], 'lng': RYNEK[1], 'radius': 500}).data
    assert len(data) <= 2
    in_radius = [e for e in Encounter.objects.filter(status='active') if services.distance_m(*RYNEK, e.lat, e.lng) <= 500]
    nearest = sorted(in_radius, key=lambda e: services.distance_m(*RYNEK, e.lat, e.lng))[:2]
    assert [e['id'] for e in data] == [e.id for e in nearest]


def test_cleared_cell_respawns_only_after_configured_delay(resident, game_config):
    game_config(encounters={'respawn_seconds': 60})
    services.rng.seed(3)
    params = {'lat': RYNEK[0], 'lng': RYNEK[1], 'radius': 1}  # jeden kwadrat
    client_for(resident).get(LIST, params)
    cell = EncounterCell.objects.get()
    Encounter.objects.filter(cell=cell).update(status=EncounterStatus.EXPIRED)
    assert client_for(resident).get(LIST, params).data == []
    cell.refresh_from_db()
    assert cell.refill_at is not None
    spawned = Encounter.objects.count()
    client_for(resident).get(LIST, params)
    assert Encounter.objects.count() == spawned  # przed upływem czasu nic nowego
    EncounterCell.objects.filter(pk=cell.pk).update(refill_at=timezone.now() - timedelta(seconds=1))
    services.rng.seed(4)
    client_for(resident).get(LIST, params)
    cell.refresh_from_db()
    assert cell.refill_at is None  # zasiedlony na nowo (losowanie może dać 0 przeciwników)


def test_expired_encounters_are_hidden_and_marked(resident):
    old = make_encounter()
    Encounter.objects.filter(pk=old.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    client_for(resident).get(LIST, {'lat': RYNEK[0], 'lng': RYNEK[1]})
    assert Encounter.objects.get(pk=old.pk).status == EncounterStatus.EXPIRED


def test_encounter_query_is_validated(resident):
    r = client_for(resident).get(LIST, {'lat': 'abc'})
    assert r.status_code == 422 and {'lat', 'lng'} <= set(r.data['fields'])
    assert client_for().get(LIST, {'lat': 50, 'lng': 19}).status_code == 401


# ───────────── walka ─────────────

def test_win_rewards_team_player_and_collection(resident):
    enemy = make_encounter(power=10)
    starter = resident.pokemons.first()
    r = client_for(resident).post(attack_url(enemy), body(resident, accuracyM=5), format='json')
    assert r.status_code == 200, r.data
    assert r.data['outcome'] == 'won' and r.data['enemyPower'] == 10 and r.data['pokemonPowerTotal'] == 20
    assert r.data['pokemons'] == [{'pokemonId': starter.id, 'powerUsed': 20, 'typeMultiplierApplied': 1.0, 'expGained': 25}]
    assert r.data['xpGained'] == 25 and r.data['progress']['xp'] == 25
    starter.refresh_from_db()
    assert starter.exp == 25
    reward = Pokemon.objects.get(user=resident, origin=PokemonOrigin.ENCOUNTER)
    assert reward.character.code == r.data['awardedCharacter'] and not reward.character.is_event_exclusive
    enemy.refresh_from_db()
    assert enemy.status == EncounterStatus.DEFEATED and enemy.defeated_by_id == resident.id
    attempt = Attack.objects.get()
    assert attempt.outcome == 'won' and attempt.reward_pokemon_id == reward.id and float(attempt.distance_m) > 0
    assert PlayerProgress.objects.get(user=resident).xp == 25


def test_defeated_encounter_cannot_be_won_twice(resident, make_resident):
    enemy = make_encounter(power=10)
    assert client_for(resident).post(attack_url(enemy), body(resident), format='json').data['outcome'] == 'won'
    other = make_resident()
    r = client_for(other).post(attack_url(enemy), body(other), format='json')
    assert r.status_code == 409 and r.data['code'] == 'encounter_defeated'


def test_loss_is_recorded_and_enemy_stays(resident):
    enemy = make_encounter(power=20)  # remis to porażka: suma musi być większa
    r = client_for(resident).post(attack_url(enemy), body(resident), format='json')
    assert r.data['outcome'] == 'lost' and r.data['pokemonPowerTotal'] == 20 and 'expGained' not in r.data['pokemons'][0]
    assert Encounter.objects.get(pk=enemy.pk).status == EncounterStatus.ACTIVE
    assert resident.pokemons.first().exp == 0 and not PlayerProgress.objects.filter(user=resident).exists()
    assert AttackPokemon.objects.get().exp_gained == 0 and Attack.objects.get().outcome == 'lost'


def test_same_type_multiplier_comes_from_configuration(resident, monkeypatch):
    enemy = make_encounter(power=23, enemy='traffic_jam')  # transport, jak startowy Rowerzysta
    r = client_for(resident).post(attack_url(enemy), body(resident), format='json')
    assert r.data['outcome'] == 'won' and r.data['pokemonPowerTotal'] == 24 and r.data['pokemons'][0]['typeMultiplierApplied'] == 1.2

    monkeypatch.setattr(settings, 'APP', replace(settings.APP, game=replace(settings.APP.game, same_type_multiplier=1.0)))
    age_attacks(resident)
    second = make_encounter(power=23, enemy='traffic_jam')
    assert client_for(resident).post(attack_url(second), body(resident), format='json').data['pokemonPowerTotal'] == 20


def test_too_far_is_recorded_without_fight(resident):
    enemy = make_encounter(power=1)
    r = client_for(resident).post(attack_url(enemy), body(resident, at=FAR), format='json')
    assert r.status_code == 200 and r.data['outcome'] == 'too_far' and r.data['distanceM'] > 1000
    attempt = Attack.objects.get()
    assert attempt.outcome == 'too_far' and attempt.pokemon_power_total is None
    assert Encounter.objects.get(pk=enemy.pk).status == EncounterStatus.ACTIVE


def test_team_is_validated(resident, make_resident):
    from apps.collection.models import Character
    from apps.collection.services import grant_pokemon

    enemy = make_encounter()
    client = client_for(resident)
    starter = resident.pokemons.first()
    extra = [grant_pokemon(resident, Character.objects.get(code='bin'), PokemonOrigin.ENCOUNTER) for _ in range(3)]
    other = make_resident().pokemons.first()
    cases = [[], [starter.id, starter.id], [starter.id] + [p.id for p in extra], [other.id]]
    for ids in cases:
        r = client.post(attack_url(enemy), {**body(resident), 'pokemonIds': ids}, format='json')
        assert r.status_code == 422 and 'pokemonIds' in r.data['fields'], ids
    Pokemon.objects.filter(pk=starter.pk).update(is_staked=True)
    r = client.post(attack_url(enemy), body(resident), format='json')
    assert r.status_code == 422 and 'pokemonIds' in r.data['fields']
    assert Attack.objects.count() == 0


def test_party_of_three_sums_power(resident):
    from apps.collection.models import Character
    from apps.collection.services import grant_pokemon

    team = [resident.pokemons.first()] + [grant_pokemon(resident, Character.objects.get(code='bin'), PokemonOrigin.ENCOUNTER) for _ in range(2)]
    enemy = make_encounter(power=55)  # Śmieciowy Potwór (clean)
    r = client_for(resident).post(attack_url(enemy), {**body(resident), 'pokemonIds': [p.id for p in team]}, format='json')
    assert r.data['outcome'] == 'won' and r.data['pokemonPowerTotal'] == 20 + 18 + 18  # Kosz (clean) = typ przeciwnika: 15 * 1.2


# ───────────── antyoszustwo ─────────────

def test_poor_gps_accuracy_is_rejected_and_logged(resident):
    enemy = make_encounter()
    r = client_for(resident).post(attack_url(enemy), body(resident, accuracyM=500), format='json')
    assert r.status_code == 422 and r.data['code'] == 'position_unreliable'
    attempt = Attack.objects.get()
    assert attempt.outcome == 'rejected' and 'GPS' in attempt.reason
    assert Encounter.objects.get(pk=enemy.pk).status == EncounterStatus.ACTIVE


def test_teleporting_between_attempts_is_rejected(resident):
    far_enemy = make_encounter(power=999, at=FAR)
    client_for(resident).post(attack_url(far_enemy), body(resident, at=FAR), format='json')  # porażka przy FAR
    age_attacks(resident, seconds=10)  # ~1,1 km w 10 s = ~110 m/s
    r = client_for(resident).post(attack_url(make_encounter()), body(resident), format='json')
    assert r.status_code == 422 and r.data['code'] == 'position_unreliable'
    assert Attack.objects.filter(outcome='rejected').count() == 1


def test_attack_rate_limits_come_from_configuration(resident, game_config):
    enemy = make_encounter(power=999)
    client = client_for(resident)
    assert client.post(attack_url(enemy), body(resident), format='json').data['outcome'] == 'lost'
    quick = client.post(attack_url(enemy), body(resident), format='json')
    assert quick.status_code == 429 and quick.data['code'] == 'too_many_requests'

    game_config(anti_cheat={'min_seconds_between_attacks': 0, 'max_attacks_per_hour': 2})
    assert client.post(attack_url(enemy), body(resident), format='json').status_code == 200
    assert client.post(attack_url(enemy), body(resident), format='json').status_code == 429
    assert Attack.objects.count() == 2  # odrzucone limitem próby się nie zapisują


def test_admin_cannot_attack_and_unknown_encounter_is_404(resident, admin):
    enemy = make_encounter()
    assert client_for(admin).post(attack_url(enemy), {'lat': NEAR[0], 'lng': NEAR[1], 'pokemonIds': [1]}, format='json').status_code == 403
    assert client_for(resident).post(f'{LIST}/999999/attack', body(resident), format='json').status_code == 404


def test_expired_encounter_cannot_be_attacked(resident):
    enemy = make_encounter()
    Encounter.objects.filter(pk=enemy.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    r = client_for(resident).post(attack_url(enemy), body(resident), format='json')
    assert r.status_code == 409 and r.data['code'] == 'encounter_expired'
