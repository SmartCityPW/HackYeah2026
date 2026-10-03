"""Losy inicjatywy: wpisy organizatora, pola własne i zmiany statusu widziane przez mieszkańców jako jedna oś czasu.

Kto może zarządzać: administrator (każdą pinezką, ale tylko statusem i wpisami na osi czasu) oraz członek zweryfikowanej
organizacji, która jest autorem inicjatywy (też jej treścią i polami własnymi). Organizacja nie odrzuca inicjatyw: to robi administrator.
"""
from __future__ import annotations

from django.conf import settings
from django.db import transaction
from rest_framework import status as http

from apps.accounts.models import Role, User
from apps.accounts.services import organization_of
from apps.pokestops import services
from apps.pokestops.models import ORG_TYPES, Pokestop, Status, Update
from core.errors import ApiError

ORG_STATUSES = (Status.OPEN, Status.IN_PROGRESS, Status.RESOLVED)


def owns(user: User, stop: Pokestop) -> bool:
    """Członek zweryfikowanej organizacji, która opublikowała tę inicjatywę."""
    if user.role != Role.ORG or stop.organization_id is None:
        return False
    organization = organization_of(user)
    return organization is not None and organization.is_verified and organization.id == stop.organization_id


def can_manage(user: User, stop: Pokestop) -> bool:
    return user.role == Role.ADMIN or owns(user, stop)


def _stop_for(user: User, pokestop_id: int, *, lock: bool = False) -> Pokestop:
    qs = Pokestop.objects.select_related('organization')
    stop = (qs.select_for_update() if lock else qs).filter(pk=pokestop_id).first()
    if stop is None or (stop.status == Status.REJECTED and user.role != Role.ADMIN):
        raise services._not_found()
    if not can_manage(user, stop):
        raise services._forbidden('forbidden', 'Tylko organizator inicjatywy i administrator mogą ją prowadzić')
    return stop


def _voice(stop: Pokestop, user: User | None) -> str:
    """Kto "mówi" we wpisie: organizacja (głos urzędowy), administrator albo system."""
    if user is None:
        return 'System'
    if user.role == Role.ADMIN:
        return 'Administrator'
    return stop.organization.name if stop.organization_id else user.display_name


# ───────────────────────── odczyt osi czasu ─────────────────────────

def timeline(viewer: User, pokestop_id: int) -> list[dict]:
    """Najnowsze pierwsze: wpisy organizatora, zmiany statusu i narodziny inicjatywy."""
    stop = Pokestop.objects.select_related('organization', 'author').filter(pk=pokestop_id).first()
    if stop is None or (stop.status == Status.REJECTED and viewer.role != Role.ADMIN and stop.author_id != viewer.id):
        raise services._not_found()
    editable = can_manage(viewer, stop)
    items = [
        {
            'kind': 'created', 'id': 0, 'title': 'Inicjatywa dodana', 'body': '',
            'author': stop.organization.name if stop.organization_id else stop.author.display_name,
            'createdAt': stop.created_at, 'updatedAt': None, 'editable': False,
        }
    ]
    for u in stop.updates.select_related('author'):
        items.append({
            'kind': 'update', 'id': u.id, 'title': u.title, 'body': u.body, 'author': _voice(stop, u.author),
            'createdAt': u.created_at, 'updatedAt': u.updated_at if u.updated_at > u.created_at else None, 'editable': editable,
        })
    for c in stop.status_changes.select_related('changed_by'):
        items.append({
            'kind': 'status', 'id': c.id, 'fromStatus': c.from_status, 'toStatus': c.to_status, 'title': '', 'body': c.note or '',
            'author': _voice(stop, c.changed_by), 'createdAt': c.created_at, 'updatedAt': None, 'editable': False,
        })
    return sorted(items, key=lambda i: (i['createdAt'], i['id']), reverse=True)


# ───────────────────────── wpisy organizatora ─────────────────────────

def _clean_update(title: str, body: str) -> tuple[str, str]:
    cfg = settings.APP.pokestops.timeline
    title, body = title.strip(), body.strip()
    errors = {}
    if not title:
        errors['title'] = 'Tytuł jest wymagany'
    elif len(title) > cfg.title_max_length:
        errors['title'] = f'Maksymalnie {cfg.title_max_length} znaków'
    if len(body) > cfg.body_max_length:
        errors['body'] = f'Maksymalnie {cfg.body_max_length} znaków'
    if errors:
        raise services._invalid(errors)
    return title, body


def add_update(user: User, pokestop_id: int, title: str, body: str) -> Update:
    title, body = _clean_update(title, body)
    with transaction.atomic():
        stop = _stop_for(user, pokestop_id, lock=True)
        if stop.updates.count() >= settings.APP.pokestops.timeline.max_updates_per_pokestop:
            raise ApiError(http.HTTP_409_CONFLICT, 'conflict', 'Ta inicjatywa ma już maksymalną liczbę wpisów')
        return Update.objects.create(pokestop=stop, author=user, title=title, body=body)


def _update_of(user: User, pokestop_id: int, update_id: int) -> tuple[Pokestop, Update]:
    stop = _stop_for(user, pokestop_id)
    update = stop.updates.filter(pk=update_id).first()
    if update is None:
        raise services._not_found('Wpis')
    return stop, update


def edit_update(user: User, pokestop_id: int, update_id: int, title: str | None, body: str | None) -> Update:
    _, update = _update_of(user, pokestop_id, update_id)
    update.title, update.body = _clean_update(update.title if title is None else title, update.body if body is None else body)
    update.save(update_fields=['title', 'body', 'updated_at'])
    return update


def delete_update(user: User, pokestop_id: int, update_id: int) -> None:
    _, update = _update_of(user, pokestop_id, update_id)
    update.delete()


# ───────────────────────── prowadzenie inicjatywy ─────────────────────────

def clean_custom_fields(items: list[dict]) -> list[dict]:
    cfg = settings.APP.pokestops.timeline
    if len(items) > cfg.max_custom_fields:
        raise services._invalid({'customFields': f'Maksymalnie {cfg.max_custom_fields} pól'})
    cleaned, seen = [], set()
    for index, item in enumerate(items):
        label, value = item['label'].strip(), item['value'].strip()
        key = f'customFields.{index}'
        if not label or not value:
            raise services._invalid({key: 'Etykieta i wartość są wymagane'})
        if len(label) > cfg.custom_field_label_max_length or len(value) > cfg.custom_field_value_max_length:
            raise services._invalid({key: 'Za długa etykieta lub wartość'})
        if label.lower() in seen:
            raise services._invalid({key: 'Etykiety pól nie mogą się powtarzać'})
        seen.add(label.lower())
        cleaned.append({'label': label, 'value': value})
    return cleaned


def manage(user: User, pokestop_id: int, data: dict) -> Pokestop:
    """PATCH /pokestops/{id}: status (z notatką), a dla organizatora także tytuł, opis i pola własne."""
    stop = _stop_for(user, pokestop_id)
    is_admin = user.role == Role.ADMIN
    content = {k for k in ('title', 'description', 'custom_fields') if k in data}
    if content and (is_admin or stop.type not in ORG_TYPES):
        raise services._forbidden('forbidden', 'Treść inicjatywy edytuje tylko organizacja, która ją opublikowała')
    new_status = data.get('status')
    if new_status == Status.REJECTED and not is_admin:
        raise services._forbidden('forbidden', 'Odrzucić inicjatywę może tylko administrator')
    if new_status is not None and new_status not in ORG_STATUSES + (Status.REJECTED,):
        raise services._invalid({'status': 'Nieznany status'})
    if stop.status == Status.REJECTED and not is_admin:
        raise services._not_found()

    updates = {}
    if 'title' in data:
        title = data['title'].strip()
        if len(title) < 3 or len(title) > 80:
            raise services._invalid({'title': 'Tytuł ma mieć od 3 do 80 znaków'})
        updates['title'] = title
    if 'description' in data:
        updates['description'] = data['description'].strip()
    if 'custom_fields' in data:
        updates['custom_fields'] = clean_custom_fields(data['custom_fields'])

    if updates:
        for field, value in updates.items():
            setattr(stop, field, value)
        stop.save(update_fields=[*updates, 'updated_at'])
    if new_status is not None:
        services.set_status(user, pokestop_id, new_status, data.get('note') or None)
    return stop
