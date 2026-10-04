"""Ankiety przy inicjatywach organizacji: odpowiedzi, nagroda (nowy pokemon) i zbiorcze wyniki dla organizatora.

Odpowiedzi walidujemy względem pytań (`Question`): wymagane, typ, zakres i dozwolone opcje. Błędy wracają pod kluczem pytania.
Ankieta zamyka się, gdy organizator ustawi inicjatywie status `resolved`.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework import status as http

from apps.accounts.models import Role, User
from apps.collection.models import Pokemon, PokemonOrigin
from apps.collection.services import grant_pokemon
from apps.game import location
from apps.game.location import Fix
from apps.pokestops import services, timeline
from apps.pokestops.models import ORG_TYPES, Pokestop, Question, Status, SurveyAnswer, SurveyResponse
from apps.scenarios.models import FieldType
from core.errors import ApiError, too_far
from core.geo import distance_m

RATING_RANGE = (1, 5)
TEXTS_IN_RESULTS = 50


def _empty(value) -> bool:
    return value in ('', None) or (isinstance(value, list) and len(value) == 0)


def _option_values(question: Question) -> set[str]:
    return {o['value'] for o in (question.options or [])}


def _check(question: Question, value) -> tuple[object, str | None]:
    """Zwraca (znormalizowana wartość, komunikat błędu)."""
    t = question.field_type
    if t in (FieldType.TEXT, FieldType.TEXTAREA):
        if not isinstance(value, str):
            return value, 'Oczekiwano tekstu'
        value = value.strip()
        limit = settings.APP.pokestops.survey.text_max_length
        if len(value) > limit:
            return value, f'Maksymalnie {limit} znaków'
        from apps.moderation.rules import inspect_text
        return value, ('Odpowiedź nie spełnia zasad serwisu' if inspect_text(value) else None)
    if t == FieldType.NUMBER:
        if isinstance(value, bool):
            return value, 'Podaj liczbę'
        try:
            n = Decimal(str(value))
        except Exception:
            return value, 'Podaj liczbę'
        if question.min_value is not None and n < question.min_value:
            return value, f'Minimum: {question.min_value.normalize()}'
        if question.max_value is not None and n > question.max_value:
            return value, f'Maksimum: {question.max_value.normalize()}'
        return float(n), None
    if t == FieldType.BOOLEAN:
        return value, None if isinstance(value, bool) else 'Oczekiwano wartości tak/nie'
    if t in (FieldType.SELECT, FieldType.CHOICE):
        return value, None if isinstance(value, str) and value in _option_values(question) else 'Niedozwolona opcja'
    if t == FieldType.MULTISELECT:
        ok = isinstance(value, list) and all(isinstance(v, str) and v in _option_values(question) for v in value)
        return value, None if ok else 'Niedozwolone opcje'
    if t == FieldType.RATING:
        low = int(question.min_value) if question.min_value is not None else RATING_RANGE[0]
        high = int(question.max_value) if question.max_value is not None else RATING_RANGE[1]
        try:
            rating = int(value) if not isinstance(value, bool) and float(value) == int(value) else None
        except (TypeError, ValueError):
            rating = None
        return rating, None if rating is not None and low <= rating <= high else f'Ocena od {low} do {high}'
    return value, 'Nieobsługiwany typ pytania'


def validate_answers(questions: list[Question], answers: dict) -> tuple[dict, dict[str, str]]:
    known = {q.question_key for q in questions}
    errors = {key: 'Nieznane pytanie' for key in answers if key not in known}
    clean = {}
    for q in questions:
        value = answers.get(q.question_key)
        if _empty(value):
            if q.required:
                errors[q.question_key] = 'To pole jest wymagane'
            continue
        normalized, message = _check(q, value)
        if message:
            errors[q.question_key] = message
        else:
            clean[q.question_key] = normalized
    return clean, errors


def _survey_stop(pokestop_id: int) -> Pokestop:
    stop = Pokestop.objects.select_related('character', 'organization').filter(pk=pokestop_id).exclude(status=Status.REJECTED).first()
    if stop is None or stop.type not in ORG_TYPES or not stop.questions.exists():
        raise services._not_found('Ankieta')
    return stop


def answer_survey(*, user: User, pokestop_id: int, fix: Fix, answers: dict, verify_location: bool = True) -> tuple[Pokestop, Pokemon]:
    """Odpowiedź na ankietę z bliska. `verify_location=False` tylko dla danych demo (`seed_demo`), reszta reguł działa jak w grze."""
    if user.role != Role.RESIDENT:
        raise services._forbidden('forbidden', 'Ankiety wypełniają mieszkańcy')
    stop = _survey_stop(pokestop_id)
    if stop.status == Status.RESOLVED:
        raise ApiError(http.HTTP_409_CONFLICT, 'survey_closed', 'Ta ankieta jest już zamknięta')
    if SurveyResponse.objects.filter(pokestop=stop, user=user).exists():
        raise ApiError(http.HTTP_409_CONFLICT, 'already_answered', 'Już wypełniłeś tę ankietę')
    verified = location.verify(user, fix) if verify_location else fix
    lat, lng = verified.lat, verified.lng
    radius = settings.APP.game.interaction_range_m
    distance = distance_m(lat, lng, stop.lat, stop.lng)
    if distance > radius:
        raise too_far(distance, radius)
    questions = list(stop.questions.all())
    clean, errors = validate_answers(questions, answers)
    if errors:
        raise services._invalid(errors)

    try:
        with transaction.atomic():
            pokemon = grant_pokemon(user, stop.character, PokemonOrigin.SURVEY)
            response = SurveyResponse.objects.create(
                pokestop=stop, user=user, lat=lat, lng=lng, distance_m=round(distance, 1), reward_pokemon=pokemon,
            )
            by_key = {q.question_key: q for q in questions}
            SurveyAnswer.objects.bulk_create([SurveyAnswer(response=response, question=by_key[k], value=v) for k, v in clean.items()])
    except IntegrityError as exc:
        raise ApiError(http.HTTP_409_CONFLICT, 'already_answered', 'Już wypełniłeś tę ankietę') from exc
    return stop, pokemon


def results(user: User, pokestop_id: int) -> dict:
    stop = _survey_stop(pokestop_id)
    if not timeline.can_manage(user, stop):
        raise services._forbidden('forbidden', 'Wyniki widzi organizator ankiety i administrator')
    out = []
    for q in stop.questions.all():
        answers = SurveyAnswer.objects.filter(question=q)
        values = list(answers.order_by('-response__submitted_at').values_list('value', flat=True))
        item = {'questionId': q.id, 'key': q.question_key, 'label': q.label, 'type': q.field_type, 'answered': len(values)}
        if q.field_type in (FieldType.SELECT, FieldType.CHOICE, FieldType.MULTISELECT):
            counts = {o['value']: 0 for o in (q.options or [])}
            for v in values:
                for picked in v if isinstance(v, list) else [v]:
                    counts[picked] = counts.get(picked, 0) + 1
            item['counts'] = counts
        elif q.field_type == FieldType.BOOLEAN:
            item['counts'] = {'true': sum(1 for v in values if v is True), 'false': sum(1 for v in values if v is False)}
        elif q.field_type in (FieldType.NUMBER, FieldType.RATING):
            numbers = [float(v) for v in values]
            item['average'] = round(sum(numbers) / len(numbers), 2) if numbers else None
        else:
            item['texts'] = [v for v in values[:TEXTS_IN_RESULTS] if v]
        out.append(item)
    return {'responseCount': stop.survey_responses.count(), 'questions': out}
