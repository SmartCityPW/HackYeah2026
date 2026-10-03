"""Reguły domenowe pinezek. Widoki tylko tłumaczą HTTP na te funkcje, a każda zmiana stanu dzieje się w jednej transakcji.

Stałe gry (zasięg, exp, premie) pochodzą z konfiguracji YAML (`settings.APP`), nie z kodu.
"""
from __future__ import annotations

import time
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status as http

from apps.accounts.models import Role, User
from apps.accounts.services import organization_of
from apps.collection.models import Character, Pokemon
from apps.collection.services import add_exp
from apps.moderation.agent import ModerationUnavailable, get_agent
from apps.pokestops.models import (
    ORG_TYPES,
    STAKE_TYPES,
    Comment,
    ModerationLog,
    Photo,
    Pokestop,
    Question,
    Status,
    StatusChange,
    Verdict,
    Vote,
)
from apps.scenarios.models import Audience, Scenario
from apps.scenarios.validation import validate_details
from core.errors import ApiError, too_far
from core.geo import distance_m


def _invalid(fields: dict[str, str]) -> ApiError:
    return ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', fields)


def _forbidden(code: str, message: str) -> ApiError:
    return ApiError(http.HTTP_403_FORBIDDEN, code, message)


def _not_found(what: str = 'Pinezka') -> ApiError:
    return ApiError(http.HTTP_404_NOT_FOUND, 'not_found', f'{what} nie istnieje')


# ───────────────────────── zastaw pokemona ─────────────────────────

def release_stake(stop: Pokestop, bonus_exp: int) -> None:
    """Zwraca zastawionego pokemona autorowi (z premią exp albo bez). Wywoływać w transakcji, raz na pinezkę."""
    if stop.staked_pokemon_id is None or stop.stake_released_at is not None:
        return
    pokemon = Pokemon.objects.select_for_update().get(pk=stop.staked_pokemon_id)
    pokemon.is_staked = False
    pokemon.save(update_fields=['is_staked', 'updated_at'])
    if bonus_exp:
        add_exp(pokemon, bonus_exp)
    stop.stake_released_at = timezone.now()
    stop.stake_bonus_exp = bonus_exp
    stop.save(update_fields=['stake_released_at', 'stake_bonus_exp', 'updated_at'])


# ───────────────────────── tworzenie ─────────────────────────

def _moderate(author: User, scenario: Scenario, data: dict) -> None:
    """Pyta agenta AI (tylko zgłoszenia mieszkańców). Odrzucenie i awaria zapisują się w logu, a zgłoszenie nie powstaje."""
    submission = {'scenario': scenario.code, 'title': data['title'], 'description': data.get('description', ''), 'details': data.get('details', {})}
    started = time.monotonic()
    try:
        review = get_agent().review(submission)
    except ModerationUnavailable as exc:
        ModerationLog.objects.create(author=author, scenario=scenario, submitted=submission, verdict=Verdict.ERROR, reason=str(exc),
                                     latency_ms=int((time.monotonic() - started) * 1000))
        raise ApiError(http.HTTP_503_SERVICE_UNAVAILABLE, 'moderation_unavailable', 'Nie udało się sprawdzić zgłoszenia, spróbuj ponownie') from exc
    latency = int((time.monotonic() - started) * 1000)
    if not review.approved:
        ModerationLog.objects.create(author=author, scenario=scenario, submitted=submission, verdict=Verdict.REJECTED, model=review.model, latency_ms=latency)
        raise ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'moderation_rejected', 'Zgłoszenie nie spełnia zasad serwisu i nie zostało opublikowane')
    data['_review'] = (review.model, latency)  # zapis do logu po utworzeniu pinezki (w tej samej transakcji)


def create_pokestop(user: User, data: dict) -> Pokestop:
    if user.role == Role.ADMIN:
        raise _forbidden('forbidden', 'Administrator nie dodaje zgłoszeń')
    scenario = Scenario.objects.select_related('default_character').filter(code=data['scenario_code'], is_active=True).first()
    if scenario is None:
        raise _invalid({'scenarioCode': 'Nieznany scenariusz'})
    is_org = user.role == Role.ORG
    if (scenario.audience == Audience.ORG) != is_org:
        raise _forbidden('forbidden', 'Ten scenariusz nie jest dostępny dla Twojej roli')

    organization = None
    if is_org:
        organization = organization_of(user)
        if organization is None or not organization.is_verified:
            raise _forbidden('organization_not_verified', 'Organizacja czeka na weryfikację przez administratora')
        if data.get('organization_id') and data['organization_id'] != organization.id:
            raise _forbidden('forbidden', 'Nie należysz do wskazanej organizacji')

    errors = validate_details(scenario, data.get('details', {}))
    if errors:
        raise _invalid(errors)
    # Pinezkę można postawić tylko w kółku interakcji gracza (sprawdzamy przed moderacją, żeby nie płacić za wywołanie agenta).
    player = data['position']
    distance = distance_m(player['lat'], player['lng'], data['lat'], data['lng'])
    if distance > settings.APP.game.interaction_range_m:
        raise too_far(distance, settings.APP.game.interaction_range_m)
    if data.get('questions') and scenario.pokestop_type not in ORG_TYPES:
        raise _invalid({'questions': 'Ankietę można dodać tylko do inicjatywy organizacji'})

    needs_stake = scenario.pokestop_type in STAKE_TYPES
    stake = None
    if needs_stake:
        if not data.get('staked_pokemon_id'):
            raise _invalid({'stakedPokemonId': 'To pole jest wymagane'})
        stake = Pokemon.objects.select_related('character').filter(pk=data['staked_pokemon_id'], user=user).first()
        if stake is None:
            raise _invalid({'stakedPokemonId': 'To nie jest Twój pokemon'})
        if stake.is_staked:
            raise ApiError(http.HTTP_409_CONFLICT, 'pokemon_unavailable', 'Ten pokemon jest już zastawiony')

    if scenario.audience == Audience.RESIDENT:
        _moderate(user, scenario, data)

    character = stake.character if stake else (Character.objects.filter(code=data.get('character')).first() or scenario.default_character)
    photos = _claim_photos(user, data.get('photo_ids') or [])

    with transaction.atomic():
        if stake is not None:
            stake = Pokemon.objects.select_for_update().get(pk=stake.pk)
            if stake.is_staked:
                raise ApiError(http.HTTP_409_CONFLICT, 'pokemon_unavailable', 'Ten pokemon jest już zastawiony')
            stake.is_staked = True
            stake.save(update_fields=['is_staked', 'updated_at'])
        stop = Pokestop.objects.create(
            type=scenario.pokestop_type, scenario=scenario, scenario_version=scenario.version, character=character, author=user,
            organization=organization, title=data['title'].strip(), description=data.get('description', '').strip(),
            lat=data['lat'], lng=data['lng'], details=data.get('details', {}), votes_required=scenario.votes_required,
            staked_pokemon=stake,
        )
        for index, photo in enumerate(photos):
            photo.pokestop, photo.sort_order = stop, index
            photo.save(update_fields=['pokestop', 'sort_order'])
        for index, q in enumerate(data.get('questions') or []):
            Question.objects.create(
                pokestop=stop, question_key=q['key'], label=q['label'], field_type=q['type'], required=q.get('required', True),
                options=q.get('options'), min_value=q.get('min'), max_value=q.get('max'), sort_order=index,
            )
        review = data.get('_review')
        if review:
            ModerationLog.objects.create(
                author=user, scenario=scenario, pokestop=stop, verdict=Verdict.APPROVED, model=review[0], latency_ms=review[1],
                submitted={'scenario': scenario.code, 'title': data['title'], 'description': data.get('description', ''), 'details': data.get('details', {})},
            )
    return stop


def _claim_photos(user: User, ids: list[int]) -> list[Photo]:
    limit = settings.APP.pokestops.photos.max_per_pokestop
    if len(ids) > limit:
        raise _invalid({'photoIds': f'Maksymalnie {limit} zdjęcia'})
    photos = list(Photo.objects.filter(pk__in=ids, uploaded_by=user, pokestop__isnull=True))
    if len(photos) != len(set(ids)):
        raise _invalid({'photoIds': 'Nieznane lub już użyte zdjęcie'})
    return sorted(photos, key=lambda p: ids.index(p.pk))


# ───────────────────────── głosowanie ─────────────────────────

def vote(*, user: User, pokestop_id: int, value: str, pokemon_id: int, lat: float, lng: float) -> tuple[Pokestop, Pokemon]:
    cfg = settings.APP.game
    if user.role == Role.ADMIN:
        raise _forbidden('forbidden', 'Administrator nie głosuje')
    with transaction.atomic():
        stop = Pokestop.objects.select_for_update().filter(pk=pokestop_id).exclude(status=Status.REJECTED).first()
        if stop is None:
            raise _not_found()
        if stop.author_id == user.id:
            raise _forbidden('own_pokestop', 'Nie możesz głosować na własną pinezkę')
        if Vote.objects.filter(pokestop=stop, user=user).exists():
            raise ApiError(http.HTTP_409_CONFLICT, 'already_voted', 'Już oddano głos na tę pinezkę')
        distance = distance_m(lat, lng, stop.lat, stop.lng)
        if distance > cfg.interaction_range_m:
            raise too_far(distance, cfg.interaction_range_m)
        pokemon = Pokemon.objects.select_for_update().filter(pk=pokemon_id, user=user).first()
        if pokemon is None:
            raise _invalid({'pokemonId': 'To nie jest Twój pokemon'})
        try:
            Vote.objects.create(
                pokestop=stop, user=user, vote=value, rewarded_pokemon=pokemon, exp_granted=cfg.exp.per_vote,
                lat=lat, lng=lng, distance_m=Decimal(str(round(distance, 1))),
            )
        except IntegrityError as exc:
            raise ApiError(http.HTTP_409_CONFLICT, 'already_voted', 'Już oddano głos na tę pinezkę') from exc
        add_exp(pokemon, cfg.exp.per_vote)
        counter = 'votes_for' if value == 'for' else 'votes_against'
        Pokestop.objects.filter(pk=stop.pk).update(**{counter: F(counter) + 1})
        stop.refresh_from_db()
        if stop.staked_pokemon_id and stop.stake_released_at is None and stop.votes_for >= stop.votes_required:
            release_stake(stop, cfg.exp.stake_release_bonus)
            pokemon.refresh_from_db()
    return stop, pokemon


# ───────────────────────── zmiany statusu ─────────────────────────

def _record(stop: Pokestop, to_status: str, by: User, note: str | None) -> None:
    StatusChange.objects.create(pokestop=stop, from_status=stop.status, to_status=to_status, changed_by=by, note=note)


def set_status(admin: User, pokestop_id: int, new_status: str, note: str | None) -> Pokestop:
    """Moderacja: `resolved` zwraca zastaw z premią, `rejected` bez premii (powód wymagany)."""
    if new_status == Status.REJECTED and not note:
        raise _invalid({'note': 'Powód jest wymagany przy odrzuceniu'})
    with transaction.atomic():
        stop = Pokestop.objects.select_for_update().filter(pk=pokestop_id).first()
        if stop is None:
            raise _not_found()
        if stop.status != new_status:
            _record(stop, new_status, admin, note)
            stop.status = new_status
            stop.rejection_reason = note if new_status == Status.REJECTED else None
            stop.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        if new_status == Status.RESOLVED:
            release_stake(stop, settings.APP.game.exp.stake_release_bonus)
        elif new_status == Status.REJECTED:
            release_stake(stop, 0)
    return stop


def withdraw(user: User, pokestop_id: int) -> Pokestop:
    """Autor wycofuje własne zgłoszenie (report/idea). Zastaw wraca bez premii."""
    with transaction.atomic():
        stop = Pokestop.objects.select_for_update().filter(pk=pokestop_id).first()
        if stop is None:
            raise _not_found()
        if stop.author_id != user.id or stop.type not in STAKE_TYPES:
            raise _forbidden('forbidden', 'Wycofać można tylko własne zgłoszenie lub pomysł')
        if stop.status not in (Status.OPEN, Status.IN_PROGRESS):
            raise ApiError(http.HTTP_409_CONFLICT, 'conflict', 'To zgłoszenie jest już zamknięte')
        _record(stop, Status.REJECTED, user, settings.APP.pokestops.withdraw_reason)
        stop.status = Status.REJECTED
        stop.rejection_reason = settings.APP.pokestops.withdraw_reason
        stop.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        release_stake(stop, 0)
    return stop


# ───────────────────────── komentarze ─────────────────────────

def add_comment(user: User, pokestop_id: int, text: str, parent_id: int | None) -> Comment:
    if user.role == Role.ADMIN:
        raise _forbidden('forbidden', 'Administrator nie komentuje')
    stop = Pokestop.objects.filter(pk=pokestop_id).exclude(status=Status.REJECTED).first()
    if stop is None:
        raise _not_found()
    parent = None
    if parent_id is not None:
        parent = Comment.objects.filter(pk=parent_id, pokestop=stop, parent__isnull=True, hidden_at__isnull=True).first()
        if parent is None:
            raise _invalid({'parentCommentId': 'Odpowiadać można tylko na komentarz nadrzędny tej pinezki'})
    return Comment.objects.create(pokestop=stop, author=user, parent=parent, body=text.strip())
