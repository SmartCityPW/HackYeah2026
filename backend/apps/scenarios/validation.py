"""Walidacja pól formularza względem definicji scenariusza (odpowiednik `scenario.utils.validate` z frontendu).

Zwraca słownik {klucz_pola: komunikat}; pusty = poprawne. Pola bazowe (title, description, photos, character)
trafiają do kolumn pinezki i są walidowane osobno, więc tu ich nie sprawdzamy.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from apps.scenarios.models import FieldType, Scenario

BASE_KEYS = {'title', 'description', 'photos', 'character'}


def _visible(field, values: dict) -> bool:
    return field.show_if_key is None or values.get(field.show_if_key) == field.show_if_value


def _empty(value) -> bool:
    return value in ('', None) or (isinstance(value, (list, tuple)) and len(value) == 0)


def _check_value(field, value, options: set[str]) -> str | None:
    t = field.field_type
    if t in (FieldType.TEXT, FieldType.TEXTAREA):
        return None if isinstance(value, str) else 'Oczekiwano tekstu'
    if t == FieldType.NUMBER:
        try:
            n = Decimal(str(value))
        except Exception:
            return 'Podaj liczbę'
        if field.min_value is not None and n < field.min_value:
            return f'Minimum: {field.min_value.normalize()}'
        if field.max_value is not None and n > field.max_value:
            return f'Maksimum: {field.max_value.normalize()}'
        return None
    if t == FieldType.BOOLEAN:
        return None if isinstance(value, bool) else 'Oczekiwano wartości tak/nie'
    if t in (FieldType.SELECT, FieldType.CHOICE):
        return None if isinstance(value, str) and value in options else 'Niedozwolona opcja'
    if t == FieldType.MULTISELECT:
        ok = isinstance(value, list) and all(isinstance(v, str) and v in options for v in value)
        return None if ok else 'Niedozwolone opcje'
    if t == FieldType.TAGS:
        return None if isinstance(value, list) and all(isinstance(v, str) for v in value) else 'Oczekiwano listy tekstów'
    if t == FieldType.RATING:
        return None if str(value) in {'1', '2', '3', '4', '5'} else 'Ocena od 1 do 5'
    if t == FieldType.DATE:
        try:
            date.fromisoformat(str(value))
            return None
        except ValueError:
            return 'Oczekiwano daty RRRR-MM-DD'
    return None


def validate_details(scenario: Scenario, details: dict) -> dict[str, str]:
    fields = list(scenario.fields.prefetch_related('options'))
    known = {f.field_key for f in fields}
    errors: dict[str, str] = {key: 'Nieznane pole' for key in details if key not in known}
    for field in fields:
        if field.field_key in BASE_KEYS or not _visible(field, details):
            continue
        value = details.get(field.field_key)
        if _empty(value):
            if field.required:
                errors[field.field_key] = 'To pole jest wymagane'
            continue
        options = {o.value for o in field.options.all()}
        message = _check_value(field, value, options)
        if message:
            errors[field.field_key] = message
    return errors
