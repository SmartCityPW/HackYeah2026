"""Wydarzenia zaufanych podmiotów ("cool thing"): tworzenie, odwoływanie i odbiór rzadkiego pokemona na miejscu i w czasie trwania.

Czas trwania to okno ciągłe `starts_at`-`ends_at` (może obejmować wiele dni) i opcjonalnie godziny dzienne (`daily_from`-`daily_to`,
czas lokalny wg `app.timezone`). Nagrodę można odebrać tylko wtedy, gdy wydarzenie jest aktywne w tej chwili i uczestnik stoi w kółku
interakcji. Jeden pokemon na uczestnika na wydarzenie, także wielodniowe.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status as http

from apps.accounts.models import Role, User
from apps.accounts.services import organization_of
from apps.collection.models import Character, Pokemon, PokemonOrigin
from apps.collection.services import grant_pokemon
from apps.game import location
from apps.game.location import Fix
from apps.events.models import Event, EventStatus, Participation
from core.errors import ApiError, too_far
from core.geo import distance_m

def _now() -> datetime:
    """Jedno źródło czasu (testy je podmieniają)."""
    return timezone.now()


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.APP.app.timezone)


def _invalid(fields: dict[str, str]) -> ApiError:
    return ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', fields)


def _forbidden(code: str, message: str) -> ApiError:
    return ApiError(http.HTTP_403_FORBIDDEN, code, message)


def _not_found() -> ApiError:
    return ApiError(http.HTTP_404_NOT_FOUND, 'not_found', 'Wydarzenie nie istnieje')


# ───────────────────────── czas ─────────────────────────

def phase(event: Event, now: datetime | None = None) -> str:
    """Etap życia wydarzenia: upcoming (przed startem), ongoing (w okresie trwania), ended albo cancelled."""
    now = now or _now()
    if event.status == EventStatus.CANCELLED:
        return 'cancelled'
    if now < event.starts_at:
        return 'upcoming'
    return 'ended' if now > event.ends_at else 'ongoing'


def is_active_now(event: Event, now: datetime | None = None) -> bool:
    """Czy w tej chwili można odebrać nagrodę: w okresie trwania i (gdy są godziny dzienne) w ich ramach."""
    now = now or _now()
    if phase(event, now) != 'ongoing':
        return False
    if event.daily_from is None:
        return True
    return event.daily_from <= now.astimezone(_tz()).time() <= event.daily_to


def next_window_start(event: Event, now: datetime | None = None) -> datetime | None:
    """Kiedy najbliżej można odebrać nagrodę (None: już można albo wydarzenie się skończyło lub zostało odwołane)."""
    now = now or _now()
    current = phase(event, now)
    if current in ('ended', 'cancelled') or is_active_now(event, now):
        return None
    earliest = max(now, event.starts_at)
    if event.daily_from is None:
        return earliest
    tz = _tz()
    day: date = earliest.astimezone(tz).date()
    for _ in range(settings.APP.events.max_duration_days + 2):
        opens = max(datetime.combine(day, event.daily_from, tz), event.starts_at)
        closes = min(datetime.combine(day, event.daily_to, tz), event.ends_at)
        if closes >= earliest and opens <= event.ends_at:
            return max(opens, earliest)
        day += timedelta(days=1)
        if datetime.combine(day, time.min, tz) > event.ends_at:
            return None
    return None


# ───────────────────────── tworzenie i odwoływanie ─────────────────────────

def can_manage(user: User, event: Event) -> bool:
    if user.role == Role.ADMIN:
        return True
    if user.role != Role.ORG:
        return False
    organization = organization_of(user)
    return organization is not None and organization.id == event.organization_id


def create_event(user: User, data: dict) -> Event:
    if user.role != Role.ORG:
        raise _forbidden('forbidden', 'Wydarzenia dodają zaufane podmioty (organizacje i urzędy)')
    organization = organization_of(user)
    if organization is None or not organization.is_verified:
        raise _forbidden('organization_not_verified', 'Organizacja czeka na weryfikację przez administratora')

    cfg = settings.APP.events
    errors: dict[str, str] = {}
    title, description = data['title'].strip(), data.get('description', '').strip()
    if len(title) < 3:
        errors['title'] = 'Tytuł ma mieć co najmniej 3 znaki'
    if len(description) > cfg.description_max_length:
        errors['description'] = f'Maksymalnie {cfg.description_max_length} znaków'
    starts_at, ends_at = data['starts_at'], data['ends_at']
    if ends_at <= starts_at:
        errors['endsAt'] = 'Koniec musi być później niż początek'
    elif ends_at <= _now():
        errors['endsAt'] = 'Wydarzenie nie może być już zakończone'
    elif ends_at - starts_at > timedelta(days=cfg.max_duration_days):
        errors['endsAt'] = f'Wydarzenie może trwać najwyżej {cfg.max_duration_days} dni'
    daily_from, daily_to = data.get('daily_from'), data.get('daily_to')
    if (daily_from is None) != (daily_to is None):
        errors['dailyFrom'] = 'Podaj obie godziny dzienne albo żadnej'
    elif daily_from is not None and daily_from >= daily_to:
        errors['dailyTo'] = 'Godzina końca musi być późniejsza niż początku (wydarzenie nie przechodzi przez północ)'
    age_min, age_max = data.get('age_min'), data.get('age_max')
    if age_min is not None and age_max is not None and age_min > age_max:
        errors['ageMax'] = 'Wiek maksymalny nie może być mniejszy niż minimalny'
    reward = Character.objects.filter(code=data['reward_character'], is_active=True).first()
    if reward is None:
        errors['rewardCharacter'] = 'Nieznany gatunek'
    elif not reward.is_event_exclusive:
        errors['rewardCharacter'] = 'Nagrodą może być tylko rzadki gatunek wyłączny dla wydarzeń'
    if errors:
        raise _invalid(errors)

    return Event.objects.create(
        organization=organization, created_by=user, title=title, description=description, address=(data.get('address') or '').strip() or None,
        lat=data['lat'], lng=data['lng'], starts_at=starts_at, ends_at=ends_at, daily_from=daily_from, daily_to=daily_to,
        reward_character=reward, capacity=data.get('capacity'), age_min=age_min, age_max=age_max,
    )


def cancel_event(user: User, event_id: int) -> Event:
    event = Event.objects.select_related('organization', 'reward_character').filter(pk=event_id).first()
    if event is None:
        raise _not_found()
    if not can_manage(user, event):
        raise _forbidden('forbidden', 'Wydarzenie odwołuje organizator albo administrator')
    if event.status != EventStatus.CANCELLED:
        event.status = EventStatus.CANCELLED
        event.save(update_fields=['status', 'updated_at'])
    return event


# ───────────────────────── odbiór nagrody ─────────────────────────

def check_in(*, user: User, event_id: int, fix: Fix) -> tuple[Event, Pokemon]:
    """Zameldowanie na miejscu i w czasie trwania: nowy pokemon gatunku `reward_character` (jeden na uczestnika)."""
    if user.role != Role.RESIDENT:
        raise _forbidden('forbidden', 'Nagrodę z wydarzeń odbierają mieszkańcy')
    with transaction.atomic():
        event = Event.objects.select_for_update().select_related('organization', 'reward_character').filter(pk=event_id).first()
        if event is None:
            raise _not_found()
        now = _now()
        if event.status == EventStatus.CANCELLED:
            raise ApiError(http.HTTP_409_CONFLICT, 'event_cancelled', 'To wydarzenie zostało odwołane')
        if Participation.objects.filter(event=event, user=user).exists():
            raise ApiError(http.HTTP_409_CONFLICT, 'already_checked_in', 'Już odebrałeś nagrodę z tego wydarzenia')
        if not is_active_now(event, now):
            raise ApiError(http.HTTP_409_CONFLICT, 'outside_time_window', _window_message(event, now))
        verified = location.verify(user, fix, now=now)
        lat, lng = verified.lat, verified.lng
        radius = settings.APP.game.interaction_range_m
        distance = distance_m(lat, lng, event.lat, event.lng)
        if distance > radius:
            raise too_far(distance, radius)
        if event.capacity is not None and event.participations.count() >= event.capacity:
            raise ApiError(http.HTTP_409_CONFLICT, 'capacity_reached', 'Limit miejsc na tym wydarzeniu został wyczerpany')
        try:
            pokemon = grant_pokemon(user, event.reward_character, PokemonOrigin.EVENT)
            Participation.objects.create(event=event, user=user, lat=lat, lng=lng, distance_m=round(distance, 1), reward_pokemon=pokemon)
        except IntegrityError as exc:
            raise ApiError(http.HTTP_409_CONFLICT, 'already_checked_in', 'Już odebrałeś nagrodę z tego wydarzenia') from exc
    return event, pokemon


def _window_message(event: Event, now: datetime) -> str:
    current = phase(event, now)
    if current == 'ended':
        return 'To wydarzenie już się zakończyło'
    opens = next_window_start(event, now)
    if opens is None:
        return 'Nagrodę można odebrać tylko w czasie trwania wydarzenia'
    local = opens.astimezone(_tz())
    return f'Nagrodę odbierzesz od {local:%d.%m %H:%M}'
