import pytest
from django.conf import settings

from apps.collection.models import Pokemon
from apps.moderation.agent import ModerationUnavailable
from apps.pokestops.models import Comment, ModerationLog, Pokestop, StatusChange, Vote
from tests.conftest import FAR, NEAR, RYNEK, at, client_for, report_payload

pytestmark = pytest.mark.django_db
URL = '/api/v1/pokestops'


def create(user, **extra):
    return client_for(user).post(URL, report_payload(user, **extra), format='json')


def vote_body(user, value='for', at=NEAR):
    return {'vote': value, 'pokemonId': user.pokemons.first().id, 'position': {'lat': at[0], 'lng': at[1], 'accuracyM': 5}}


# ───────────── tworzenie ─────────────

def test_resident_creates_report_and_pokemon_is_staked(resident):
    r = create(resident)
    assert r.status_code == 201, r.data
    assert r.data['type'] == 'report' and r.data['mine'] is True and r.data['status'] == 'open'
    assert r.data['character'] == 'cyclist'  # gatunek zastawionego pokemona (startowy), a nie pole scenariusza
    assert r.data['icon'] == '🕳️' and r.data['scenarioCode'] == 'res-pothole'
    assert Pokemon.objects.get(pk=r.data['stakedPokemonId']).is_staked is True
    assert ModerationLog.objects.filter(verdict='approved', pokestop_id=r.data['id']).count() == 1


def test_stake_is_required_and_cannot_be_reused(resident):
    missing = client_for(resident).post(URL, {k: v for k, v in report_payload(resident).items() if k != 'stakedPokemonId'}, format='json')
    assert missing.status_code == 422 and 'stakedPokemonId' in missing.data['fields']
    assert create(resident).status_code == 201
    again = create(resident)
    assert again.status_code == 409 and again.data['code'] == 'pokemon_unavailable'


def test_foreign_pokemon_cannot_be_staked(resident, make_resident):
    other = make_resident()
    r = client_for(resident).post(URL, report_payload(resident, stakedPokemonId=other.pokemons.first().id), format='json')
    assert r.status_code == 422 and 'stakedPokemonId' in r.data['fields']


def test_details_are_validated_against_the_scenario(resident):
    r = create(resident, details={'nieznane': 1})
    assert r.status_code == 422 and r.data['fields']['nieznane'] == 'Nieznane pole'


def test_cool_place_requires_rating_and_cost_and_needs_no_stake(resident):
    base = {'scenarioCode': 'place-food', 'title': 'Kawiarnia pod żyrandolem', 'lat': RYNEK[0], 'lng': RYNEK[1], 'position': at(*NEAR)}
    bad = client_for(resident).post(URL, {**base, 'details': {}}, format='json')
    assert bad.status_code == 422 and set(bad.data['fields']) == {'rating', 'cost'}
    ok = client_for(resident).post(URL, {**base, 'details': {'rating': '5', 'cost': 'cheap', 'vibes': ['calm']}}, format='json')
    assert ok.status_code == 201 and ok.data['type'] == 'place' and ok.data['stakedPokemonId'] is None
    assert ok.data['character'] == 'bin'  # domyślna postać scenariusza


def test_new_pin_must_be_inside_interaction_circle_and_skips_moderation_when_too_far(resident, monkeypatch):
    def must_not_be_called():
        raise AssertionError('za daleko: agent nie powinien być wołany')

    monkeypatch.setattr('apps.pokestops.services.get_agent', must_not_be_called)
    r = create(resident, position=at(*FAR))
    assert r.status_code == 422 and r.data['code'] == 'too_far' and r.data['distanceM'] > 1000
    assert Pokestop.objects.count() == 0 and Pokemon.objects.get(user=resident).is_staked is False
    missing = client_for(resident).post(URL, {k: v for k, v in report_payload(resident).items() if k != 'position'}, format='json')
    assert missing.status_code == 422 and 'position' in missing.data['fields']


def test_moderation_rejection_blocks_creation_and_is_logged(resident):
    marker = settings.APP.moderation.stub.reject_marker
    r = create(resident, title=f'Test {marker}')
    assert r.status_code == 422 and r.data['code'] == 'moderation_rejected'
    assert 'fields' not in r.data  # agent zwraca tylko tak/nie, więc bez powodu
    assert Pokestop.objects.count() == 0
    assert Pokemon.objects.get(user=resident).is_staked is False  # pokemon nie zastawiony
    log = ModerationLog.objects.get()
    assert log.verdict == 'rejected' and log.pokestop is None


def test_moderation_outage_fails_closed(resident, monkeypatch):
    class Down:
        def review(self, submission):
            raise ModerationUnavailable('timeout')

    monkeypatch.setattr('apps.pokestops.services.get_agent', lambda: Down())
    r = create(resident)
    assert r.status_code == 503 and r.data['code'] == 'moderation_unavailable'
    assert Pokestop.objects.count() == 0 and ModerationLog.objects.get().verdict == 'error'


def test_org_must_be_verified_and_skips_moderation(make_org, monkeypatch):
    org_payload = {'scenarioCode': 'org-tree', 'title': 'Nasadzenie lip', 'lat': RYNEK[0], 'lng': RYNEK[1], 'position': at(*RYNEK),
                   'details': {'plantingType': 'new', 'species': 'linden', 'count': 5, 'rationale': 'Cień'}}
    pending, _ = make_org(verified=False)
    denied = client_for(pending).post(URL, org_payload, format='json')
    assert denied.status_code == 403 and denied.data['code'] == 'organization_not_verified'

    def must_not_be_called():
        raise AssertionError('organizacje nie przechodzą przez agenta')

    monkeypatch.setattr('apps.pokestops.services.get_agent', must_not_be_called)
    verified, org = make_org()
    org_payload['details'].update({'contactPerson': 'Anna', 'contactEmail': 'a@b.pl'})
    ok = client_for(verified).post(URL, {**org_payload, 'character': 'tree',
        'questions': [{'key': 'q1', 'label': 'Czy popierasz?', 'type': 'boolean'},
                      {'key': 'q2', 'label': 'Gdzie?', 'type': 'choice', 'options': [{'value': 'a', 'label': 'A'}]}]}, format='json')
    assert ok.status_code == 201, ok.data
    assert ok.data['type'] == 'ngo' and ok.data['organization'] == org.name and ok.data['author'] == org.name
    assert [q['key'] for q in ok.data['questions']] == ['q1', 'q2']


def test_roles_cannot_use_foreign_scenarios(resident, make_org, admin):
    org_user, _ = make_org()
    assert client_for(resident).post(URL, {'scenarioCode': 'org-tree', 'title': 'Test', 'lat': 50, 'lng': 19, 'position': at(50, 19)}, format='json').status_code == 403
    assert client_for(org_user).post(URL, {'scenarioCode': 'res-pothole', 'title': 'Test', 'lat': 50, 'lng': 19, 'position': at(50, 19)}, format='json').status_code == 403
    assert client_for(admin).post(URL, {'scenarioCode': 'res-pothole', 'title': 'Test', 'lat': 50, 'lng': 19, 'position': at(50, 19)}, format='json').status_code == 403


# ───────────── lista ─────────────

def test_list_filters_by_bbox_and_hides_rejected(resident, make_resident, admin):
    create(resident)
    second = make_resident()
    create(second, lat=51.0, lng=21.0, title='Daleko')
    near = client_for(resident).get(URL, {'bbox': '19.9,50.0,20.0,50.1'}).data
    assert near['count'] == 1 and near['results'][0]['title'] == 'Dziura w chodniku'
    bad = client_for(resident).get(URL, {'bbox': 'abc'})
    assert bad.status_code == 422 and 'bbox' in bad.data['fields']

    stop = Pokestop.objects.get(title='Daleko')
    client_for(admin).patch(f'{URL}/{stop.id}', {'status': 'rejected', 'note': 'Spam'}, format='json')
    assert client_for(resident).get(URL).data['count'] == 1
    assert client_for(admin).get(URL, {'status': 'rejected'}).data['count'] == 1


def test_list_is_paginated_with_camel_case_params(resident, make_resident):
    for _ in range(3):
        create(make_resident())
    page = client_for(resident).get(URL, {'page': 2, 'pageSize': 2}).data
    assert page['count'] == 3 and len(page['results']) == 1


# ───────────── głosowanie ─────────────

def test_vote_in_range_gives_exp_to_chosen_pokemon_and_counts(resident, make_resident):
    stop_id = create(resident).data['id']
    voter = make_resident()
    r = client_for(voter).post(f'{URL}/{stop_id}/vote', vote_body(voter), format='json')
    assert r.status_code == 200, r.data
    assert r.data['pokemon']['exp'] == settings.APP.game.exp.per_vote
    assert r.data['stop']['votesFor'] == 1 and r.data['stop']['myVote'] == 'for'
    vote = Vote.objects.get()
    assert vote.exp_granted == 10 and 0 < float(vote.distance_m) < 50


def test_vote_requires_proximity(resident, make_resident):
    stop_id = create(resident).data['id']
    voter = make_resident()
    r = client_for(voter).post(f'{URL}/{stop_id}/vote', vote_body(voter, at=FAR), format='json')
    assert r.status_code == 422 and r.data['code'] == 'too_far'
    assert r.data['radiusM'] == settings.APP.game.interaction_range_m and r.data['distanceM'] > 1000
    assert Vote.objects.count() == 0 and Pokemon.objects.get(user=voter).exp == 0


def test_range_comes_from_configuration(resident, make_resident, monkeypatch):
    from dataclasses import replace

    stop_id = create(resident).data['id']
    voter = make_resident()
    tight = replace(settings.APP, game=replace(settings.APP.game, interaction_range_m=1.0))
    monkeypatch.setattr(settings, 'APP', tight)
    r = client_for(voter).post(f'{URL}/{stop_id}/vote', vote_body(voter), format='json')  # ~11 m > 1 m
    assert r.status_code == 422 and r.data['code'] == 'too_far' and r.data['radiusM'] == 1


def test_one_vote_per_user_and_no_vote_on_own_pin(resident, make_resident):
    stop_id = create(resident).data['id']
    own = client_for(resident).post(f'{URL}/{stop_id}/vote', vote_body(resident), format='json')
    assert own.status_code == 403 and own.data['code'] == 'own_pokestop'
    voter = make_resident()
    assert client_for(voter).post(f'{URL}/{stop_id}/vote', vote_body(voter), format='json').status_code == 200
    again = client_for(voter).post(f'{URL}/{stop_id}/vote', vote_body(voter, 'against'), format='json')
    assert again.status_code == 409 and again.data['code'] == 'already_voted'
    assert Pokemon.objects.get(user=voter).exp == 10  # exp tylko raz


def test_admin_cannot_vote_and_foreign_pokemon_is_rejected(resident, make_resident, admin):
    stop_id = create(resident).data['id']
    assert client_for(admin).post(f'{URL}/{stop_id}/vote', {'vote': 'for', 'pokemonId': 1, 'position': at(*NEAR)}, format='json').status_code == 403
    voter, other = make_resident(), make_resident()
    body = {**vote_body(voter), 'pokemonId': other.pokemons.first().id}
    assert client_for(voter).post(f'{URL}/{stop_id}/vote', body, format='json').status_code == 422


def test_threshold_returns_stake_with_bonus_in_same_transaction(resident, make_resident):
    created = create(resident).data
    Pokestop.objects.filter(pk=created['id']).update(votes_required=2)
    for _ in range(2):
        voter = make_resident()
        r = client_for(voter).post(f'{URL}/{created["id"]}/vote', vote_body(voter), format='json')
        assert r.status_code == 200
    pokemon = Pokemon.objects.get(user=resident)
    assert pokemon.is_staked is False and pokemon.exp == settings.APP.game.exp.stake_release_bonus
    stop = Pokestop.objects.get(pk=created['id'])
    assert stop.stake_released_at is not None and stop.stake_bonus_exp == 50
    assert r.data['stop']['stakeReleasedAt'] is not None


def test_stake_is_released_only_once(resident, make_resident):
    created = create(resident).data
    Pokestop.objects.filter(pk=created['id']).update(votes_required=1)
    for _ in range(3):
        voter = make_resident()
        client_for(voter).post(f'{URL}/{created["id"]}/vote', vote_body(voter), format='json')
    assert Pokemon.objects.get(user=resident).exp == 50  # jedna premia, nie trzy


# ───────────── status, wycofanie ─────────────

def test_withdraw_releases_pokemon_without_bonus(resident):
    created = create(resident).data
    r = client_for(resident).post(f'{URL}/{created["id"]}/withdraw')
    assert r.status_code == 200 and r.data['status'] == 'rejected'
    pokemon = Pokemon.objects.get(user=resident)
    assert pokemon.is_staked is False and pokemon.exp == 0
    assert Pokestop.objects.get().stake_bonus_exp == 0
    assert StatusChange.objects.get().changed_by_id == resident.id
    assert client_for(resident).post(f'{URL}/{created["id"]}/withdraw').status_code == 409  # już zamknięte


def test_only_the_author_can_withdraw(resident, make_resident):
    created = create(resident).data
    assert client_for(make_resident()).post(f'{URL}/{created["id"]}/withdraw').status_code == 403


def test_admin_resolve_gives_bonus_and_reject_requires_reason(resident, admin):
    created = create(resident).data
    no_reason = client_for(admin).patch(f'{URL}/{created["id"]}', {'status': 'rejected'}, format='json')
    assert no_reason.status_code == 422 and 'note' in no_reason.data['fields']
    ok = client_for(admin).patch(f'{URL}/{created["id"]}', {'status': 'resolved'}, format='json')
    assert ok.status_code == 200 and ok.data['status'] == 'resolved'
    assert Pokemon.objects.get(user=resident).exp == 50
    assert client_for(resident).patch(f'{URL}/{created["id"]}', {'status': 'resolved'}, format='json').status_code == 403


def test_admin_reject_releases_without_bonus(resident, admin):
    created = create(resident).data
    client_for(admin).patch(f'{URL}/{created["id"]}', {'status': 'rejected', 'note': 'Spam'}, format='json')
    pokemon = Pokemon.objects.get(user=resident)
    assert pokemon.is_staked is False and pokemon.exp == 0
    assert Pokestop.objects.get().rejection_reason == 'Spam'


# ───────────── komentarze ─────────────

def test_comments_are_paginated_by_parent_with_replies(resident, make_resident):
    stop_id = create(resident).data['id']
    other = make_resident()
    ids = []
    for i in range(3):
        r = client_for(other).post(f'{URL}/{stop_id}/comments', {'text': f'Komentarz {i}'}, format='json')
        assert r.status_code == 201
        ids.append(r.data['id'])
    reply = client_for(resident).post(f'{URL}/{stop_id}/comments', {'text': 'Odpowiedź', 'parentCommentId': ids[0]}, format='json')
    assert reply.status_code == 201 and reply.data['parentCommentId'] == ids[0]

    page1 = client_for(resident).get(f'{URL}/{stop_id}/comments', {'pageSize': 2}).data
    assert page1['count'] == 3 and len(page1['results']) == 2
    assert page1['results'][0]['text'] == 'Komentarz 2'  # najnowsze pierwsze
    page2 = client_for(resident).get(f'{URL}/{stop_id}/comments', {'pageSize': 2, 'page': 2}).data
    assert page2['results'][0]['replies'][0]['text'] == 'Odpowiedź' and page2['results'][0]['replies'][0]['mine'] is True


def test_replies_are_one_level_and_hidden_comments_disappear(resident, make_resident, admin):
    stop_id = create(resident).data['id']
    other = make_resident()
    top = client_for(other).post(f'{URL}/{stop_id}/comments', {'text': 'Nadrzędny'}, format='json').data
    reply = client_for(resident).post(f'{URL}/{stop_id}/comments', {'text': 'Odp', 'parentCommentId': top['id']}, format='json').data
    nested = client_for(other).post(f'{URL}/{stop_id}/comments', {'text': 'Odp2', 'parentCommentId': reply['id']}, format='json')
    assert nested.status_code == 422 and 'parentCommentId' in nested.data['fields']
    Comment.objects.filter(pk=top['id']).update(hidden_at='2026-01-01T00:00:00Z')
    assert client_for(resident).get(f'{URL}/{stop_id}/comments').data['count'] == 0
    assert client_for(resident).get(f'{URL}/{stop_id}').data['commentCount'] == 1  # tylko widoczna odpowiedź


def test_comment_length_limit_comes_from_config(resident):
    stop_id = create(resident).data['id']
    too_long = 'x' * (settings.APP.pokestops.comment_max_length + 1)
    r = client_for(resident).post(f'{URL}/{stop_id}/comments', {'text': too_long}, format='json')
    assert r.status_code == 422 and 'text' in r.data['fields']


# ───────────── interakcje ─────────────

def test_my_interactions_cover_authored_voted_and_commented(resident, make_resident):
    mine = create(resident).data['id']
    other = make_resident()
    voted = create(other).data['id']
    commented = create(make_resident()).data['id']
    ignored = create(make_resident()).data['id']
    client_for(resident).post(f'{URL}/{voted}/vote', vote_body(resident), format='json')
    client_for(resident).post(f'{URL}/{commented}/comments', {'text': 'Hej'}, format='json')
    result = client_for(resident).get('/api/v1/me/interactions').data
    assert {r['id'] for r in result['results']} == {mine, voted, commented} and ignored not in {r['id'] for r in result['results']}
    assert result['count'] == 3


def test_detail_hides_rejected_from_strangers(resident, make_resident, admin):
    stop_id = create(resident).data['id']
    client_for(admin).patch(f'{URL}/{stop_id}', {'status': 'rejected', 'note': 'x'}, format='json')
    assert client_for(make_resident()).get(f'{URL}/{stop_id}').status_code == 404
    assert client_for(resident).get(f'{URL}/{stop_id}').status_code == 200  # autor widzi


# ───────────── kolekcja i postęp ─────────────

def test_pokemons_collection_and_progress_endpoints(resident):
    pokemons = client_for(resident).get('/api/v1/me/pokemons').data
    assert len(pokemons) == 1 and pokemons[0]['level'] == 1 and pokemons[0]['power'] == 20 and pokemons[0]['typeCode'] == 'transport'
    create(resident)
    assert client_for(resident).get('/api/v1/me/pokemons', {'availableOnly': 'true'}).data == []
    collection = client_for(resident).get('/api/v1/me/collection').data
    assert collection['cyclist'] == 1 and collection['bin'] == 0
    progress = client_for(resident).get('/api/v1/me/progress').data
    assert progress == {'level': 1, 'xp': 0, 'xpIntoLevel': 0, 'xpForNextLevel': 100}
