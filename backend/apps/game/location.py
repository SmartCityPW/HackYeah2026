"""Weryfikacja pozycji gracza: jedno miejsce dla każdej akcji związanej z miejscem (głos, nowa pinezka, ankieta, wydarzenie, walka, przeciwnicy).

Samo to, że klient podał współrzędne, niczego nie dowodzi, więc serwer sprawdza, czy pozycji można wierzyć:

1. **Źródło:** pozycja oznaczona `simulated` (tryb deweloperski, testy) jest przyjmowana tylko przy `location.allow_simulated: true`
   (lokalnie, demo, testy). W produkcji jest to `false`, więc narzędzia deweloperskie nie pozwolą oszukiwać.
2. **Dokładność:** `accuracyM` jest wymagana (`require_accuracy`) i nie może przekraczać `max_accuracy_m`: przy kółku 50 m odczyt z błędem 300 m
   niczego nie dowodzi.
3. **Aktualność:** `takenAt` (chwila odczytu GPS) jest wymagany (`require_timestamp`), nie starszy niż `max_age_seconds` i nie z przyszłości
   (ponad `max_future_seconds`), więc nie da się użyć dawnego odczytu.
4. **Ruch:** szybsza zmiana miejsca niż `max_speed_mps` względem ostatniej zweryfikowanej pozycji gracza to teleportacja. Szum GPS
   (przesunięcia poniżej `speed_ignore_below_m` plus dokładności obu odczytów) nie jest ruchem. Pozycje symulowane nie podlegają tej kontroli.

Poprawna pozycja zapisuje się jako ostatnia znana (`PlayerLocation`). Odrzucona nie, żeby nie dało się jej "wyprać" kolejnym wywołaniem.
Wszystkie progi pochodzą z YAML (`location`).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework import status as http

from apps.game.models import PlayerLocation
from core.errors import ApiError
from core.geo import distance_m

SOURCES = ('gps', 'simulated')


@dataclass(frozen=True)
class Fix:
    """Odczyt pozycji gracza przysłany przez klienta (`PositionRequest`)."""

    lat: float
    lng: float
    accuracy_m: float | None = None
    taken_at: datetime | None = None
    source: str = 'gps'

    @classmethod
    def from_position(cls, position: dict) -> Fix:
        """Z zwalidowanego słownika `PositionSerializer` (lat, lng, accuracy_m, taken_at, source)."""
        return cls(lat=position['lat'], lng=position['lng'], accuracy_m=position.get('accuracy_m'), taken_at=position.get('taken_at'),
                   source=position.get('source') or 'gps')


class LocationRejected(ApiError):
    """Pozycja odrzucona jako niewiarygodna (422 z konkretnym kodem). `reason` jest czytelnym powodem do zapisu w logu prób."""

    def __init__(self, code: str, message: str):
        super().__init__(http.HTTP_422_UNPROCESSABLE_ENTITY, code, message)
        self.reason = message


def verify(user, fix: Fix, *, now: datetime | None = None) -> Fix:
    """Sprawdza wiarygodność pozycji i zapisuje ją jako ostatnią znaną. Zwraca ten sam odczyt albo rzuca `LocationRejected`."""
    cfg = settings.APP.location
    now = now or timezone.now()

    if fix.source == 'simulated' and not cfg.allow_simulated:
        raise LocationRejected('simulated_location_not_allowed', 'Pozycja symulowana jest tu niedozwolona. Użyj prawdziwego GPS.')

    if fix.accuracy_m is None:
        if cfg.require_accuracy and fix.source != 'simulated':
            raise LocationRejected('accuracy_required', 'Brak dokładności GPS (accuracyM): nie można zweryfikować pozycji')
    elif fix.accuracy_m > cfg.max_accuracy_m:
        raise LocationRejected('gps_inaccurate', f'Dokładność GPS {round(fix.accuracy_m)} m, wymagane najwyżej {round(cfg.max_accuracy_m)} m')

    if fix.taken_at is None:
        if cfg.require_timestamp and fix.source != 'simulated':
            raise LocationRejected('timestamp_required', 'Brak chwili odczytu GPS (takenAt): nie można sprawdzić aktualności pozycji')
    else:
        age = (now - fix.taken_at).total_seconds()
        if age > cfg.max_age_seconds:
            raise LocationRejected('stale_position', f'Odczyt GPS sprzed {round(age)} s jest za stary (najwyżej {round(cfg.max_age_seconds)} s)')
        if age < -cfg.max_future_seconds:
            raise LocationRejected('stale_position', 'Odczyt GPS jest z przyszłości: sprawdź zegar urządzenia')

    previous = PlayerLocation.objects.filter(user=user).first()
    if previous is not None and fix.source != 'simulated' and previous.source != 'simulated':
        seconds = (now - previous.reported_at).total_seconds()
        jump = distance_m(previous.lat, previous.lng, fix.lat, fix.lng)
        noise = cfg.speed_ignore_below_m + (previous.accuracy_m or 0) + (fix.accuracy_m or 0)
        if seconds > 0 and jump > noise and jump / seconds > cfg.max_speed_mps:
            raise LocationRejected('implausible_movement', f'Zbyt szybka zmiana pozycji ({round(jump)} m w {round(seconds)} s)')

    PlayerLocation.objects.update_or_create(
        user=user, defaults={'lat': fix.lat, 'lng': fix.lng, 'accuracy_m': fix.accuracy_m, 'source': fix.source, 'reported_at': now},
    )
    return fix
