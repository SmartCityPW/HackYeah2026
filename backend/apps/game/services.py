"""Reguły gry: przeciwnicy generowani indywidualnie dla każdego gracza i rozstrzyganie walk. Serwer jest źródłem prawdy.

Teren dzieli się na kwadraty, ale zasiedlenie jest **osobne dla każdego gracza**: dwie osoby w tym samym miejscu widzą różnych przeciwników,
a każdy sam odnawia swoje kwadraty po pokonaniu przeciwników. Pozycję gracza weryfikuje `apps.game.location` przed każdą akcją.

Stałe (kwadrat, liczba przeciwników, odnowienie, zasięg, mnożnik typu, limity walk, wiarygodność pozycji) pochodzą z konfiguracji YAML
(`settings.APP.game` i `settings.APP.location`), nie z kodu.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status as http

from apps.accounts.models import Role, User
from apps.collection.models import Character, Pokemon, PokemonOrigin
from apps.collection.services import add_exp, grant_pokemon, power_for
from apps.game import location
from apps.game.location import Fix, LocationRejected
from apps.game.models import Attack, AttackOutcome, AttackPokemon, Encounter, EncounterCell, EncounterStatus, EnemyType, PlayerProgress
from core.errors import ApiError
from core.geo import distance_m

METERS_PER_DEG_LAT = 111_320

# Źródło losowości (do podmiany w testach).
rng = random.Random()


def progress_payload(user) -> dict:
    """Poziom wyliczany z xp wzorem z konfiguracji (xp_per_player_level), baza trzyma tylko xp."""
    per_level = settings.APP.game.levels.xp_per_player_level
    xp = PlayerProgress.objects.filter(user=user).values_list('xp', flat=True).first() or 0
    return {'level': 1 + xp // per_level, 'xp': xp, 'xpIntoLevel': xp % per_level, 'xpForNextLevel': per_level}


# ───────────────────────── kwadraty terenu ─────────────────────────
# Siatka jak w atrapie frontendu (`game.api.mock.ts`): rząd z szerokości geograficznej, kolumna z długości liczonej
# w metrach dla środka rzędu, więc kwadrat ma stałe granice niezależnie od tego, kto i skąd pyta.

def _meters_per_deg_lng(row: int, cell_m: float) -> float:
    lat = (row + 0.5) * cell_m / METERS_PER_DEG_LAT
    return METERS_PER_DEG_LAT * math.cos(math.radians(lat))


def cells_around(lat: float, lng: float, radius_m: float) -> list[tuple[int, int]]:
    """Kwadraty (row, col), które zahaczają o kółko o promieniu `radius_m` wokół punktu."""
    cell_m = settings.APP.game.encounters.cell_size_m
    north_m = lat * METERS_PER_DEG_LAT
    out = []
    for row in range(math.floor((north_m - radius_m) / cell_m), math.floor((north_m + radius_m) / cell_m) + 1):
        east_m = lng * _meters_per_deg_lng(row, cell_m)
        for col in range(math.floor((east_m - radius_m) / cell_m), math.floor((east_m + radius_m) / cell_m) + 1):
            out.append((row, col))
    return out


def _random_point_in(cell: EncounterCell) -> tuple[float, float]:
    cell_m = settings.APP.game.encounters.cell_size_m
    lat = (cell.row + rng.random()) * cell_m / METERS_PER_DEG_LAT
    lng = (cell.col + rng.random()) * cell_m / _meters_per_deg_lng(cell.row, cell_m)
    return lat, lng


def _pick_enemy_type(types: list[EnemyType], avoid: EnemyType | None = None) -> EnemyType:
    """Losuje typ przeciwnika z wagami; gdy jest z czego wybierać, nie powtarza typu `avoid` (poprzedni przeciwnik tego gracza)."""
    pool = [t for t in types if avoid is None or t.pk != avoid.pk] or types
    return rng.choices(pool, weights=[t.spawn_weight for t in pool], k=1)[0]


def _spawn(cell: EncounterCell, enemy: EnemyType, now: datetime) -> Encounter:
    level = rng.randint(enemy.min_level, enemy.max_level)
    lat, lng = _random_point_in(cell)
    return Encounter(
        user=cell.user, cell=cell, enemy_type=enemy, level=level, power=enemy.base_power + enemy.power_growth * (level - 1),
        xp_reward=enemy.base_xp, lat=lat, lng=lng,
        expires_at=now + timedelta(minutes=settings.APP.game.encounters.lifetime_minutes),
    )


def _settle(cell: EncounterCell, types: list[EnemyType], now: datetime) -> None:
    """Zasiedla kwadrat gracza: nowy od razu, wyczyszczony (pokonani lub wygaśli) dopiero po `respawn_seconds`.

    Typy kolejnych przeciwników się nie powtarzają (także względem ostatniego przeciwnika tego gracza), więc nie widzi w kółko tego samego.
    Wywoływać w transakcji z blokadą wiersza kwadratu, żeby dwa równoległe zapytania nie zasiedliły go dwa razy.
    """
    cfg = settings.APP.game.encounters
    if Encounter.objects.filter(cell=cell, status=EncounterStatus.ACTIVE, expires_at__gt=now).exists():
        return
    if cell.populated_at is not None and cell.refill_at is None:
        cell.refill_at = now + timedelta(seconds=cfg.respawn_seconds)
        cell.save(update_fields=['refill_at'])
        return
    if cell.refill_at is not None and now < cell.refill_at:
        return
    count = rng.randint(0, cfg.max_per_cell) if types else 0
    last = Encounter.objects.filter(user=cell.user).select_related('enemy_type').order_by('-spawned_at', '-id').first()
    previous = last.enemy_type if last else None
    spawned = []
    for _ in range(count):
        previous = _pick_enemy_type(types, previous)
        spawned.append(_spawn(cell, previous, now))
    Encounter.objects.bulk_create(spawned)
    cell.populated_at, cell.refill_at = now, None
    cell.save(update_fields=['populated_at', 'refill_at'])


def _expire(now: datetime) -> None:
    Encounter.objects.filter(status=EncounterStatus.ACTIVE, expires_at__lte=now).update(status=EncounterStatus.EXPIRED)


def encounters_near(user: User, fix: Fix, radius_m: float) -> list[Encounter]:
    """Najbliżsi aktywni przeciwnicy TEGO gracza w promieniu (najwyżej `max_in_response`). Leniwie zasiedla jego kwadraty w kółku.

    Najpierw weryfikuje pozycję (`apps.game.location`): przeciwnicy są losowani dla miejsca, w którym gracz faktycznie jest.
    """
    cfg = settings.APP.game.encounters
    if user.role == Role.ADMIN:
        return []
    verified = location.verify(user, fix)
    lat, lng = verified.lat, verified.lng
    now = timezone.now()
    _expire(now)
    types = list(EnemyType.objects.filter(is_active=True))
    cells = []
    for row, col in cells_around(lat, lng, radius_m):
        with transaction.atomic():
            cell, _ = EncounterCell.objects.get_or_create(user=user, row=row, col=col)
            cell = EncounterCell.objects.select_for_update().get(pk=cell.pk)
            _settle(cell, types, now)
        cells.append(cell)

    candidates = Encounter.objects.select_related('enemy_type__type').filter(user=user, status=EncounterStatus.ACTIVE, expires_at__gt=now, cell__in=cells)
    nearby = [(d, e) for e in candidates if (d := distance_m(lat, lng, e.lat, e.lng)) <= radius_m]
    nearby.sort(key=lambda pair: pair[0])
    return [e for _, e in nearby[: cfg.max_in_response]]


# ───────────────────────── walka ─────────────────────────

def _invalid(fields: dict[str, str]) -> ApiError:
    return ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', fields)


@dataclass(frozen=True)
class AttackRequest:
    fix: Fix
    pokemon_ids: list[int]


def _check_rate(user: User, now: datetime) -> None:
    """Limity częstotliwości (`anti_cheat`): jedna próba na N sekund i M na godzinę. Liczą się wszystkie zapisane próby."""
    cfg = settings.APP.game.anti_cheat
    recent = Attack.objects.filter(user=user, created_at__gt=now - timedelta(hours=1))
    if recent.filter(created_at__gt=now - timedelta(seconds=cfg.min_seconds_between_attacks)).exists():
        raise ApiError(http.HTTP_429_TOO_MANY_REQUESTS, 'too_many_requests', f'Odczekaj {cfg.min_seconds_between_attacks} s przed kolejną próbą')
    if recent.count() >= cfg.max_attacks_per_hour:
        raise ApiError(http.HTTP_429_TOO_MANY_REQUESTS, 'too_many_requests', 'Limit prób walki na godzinę wyczerpany, wróć później')


def _team(user: User, ids: list[int]) -> list[Pokemon]:
    max_size = settings.APP.game.max_party_size
    if not 1 <= len(ids) <= max_size or len(set(ids)) != len(ids):
        raise _invalid({'pokemonIds': f'Wybierz od 1 do {max_size} różnych pokemonów'})
    team = list(Pokemon.objects.select_for_update().select_related('character__type').filter(pk__in=ids, user=user))
    if len(team) != len(ids):
        raise _invalid({'pokemonIds': 'To nie są Twoje pokemony'})
    if any(p.is_staked for p in team):
        raise _invalid({'pokemonIds': 'Zastawiony pokemon czeka na zgłoszeniu i nie może walczyć'})
    return sorted(team, key=lambda p: ids.index(p.pk))


def _log(encounter: Encounter, user: User, req: AttackRequest, distance: float, outcome: str, **extra) -> Attack:
    fix = req.fix
    return Attack.objects.create(
        encounter=encounter, user=user, lat=fix.lat, lng=fix.lng, distance_m=Decimal(str(round(distance, 1))),
        accuracy_m=None if fix.accuracy_m is None else Decimal(str(round(fix.accuracy_m, 1))), client_time=fix.taken_at,
        outcome=outcome, **extra,
    )


def _award_character() -> Character:
    """Nowa postać za wygraną: losowana z aktywnych, poza unikalnymi za wydarzenia."""
    pool = list(Character.objects.filter(is_active=True, is_event_exclusive=False))
    if not pool:
        raise ImproperlyConfigured('Brak postaci do nagrody w słowniku (uruchom seed_reference)')
    return rng.choice(pool)


def attack(*, user: User, encounter_id: int, req: AttackRequest) -> dict:
    """Rozstrzyga próbę walki i zwraca `AttackResult` z kontraktu (won / lost / too_far).

    Kolejność: limity → przeciwnik gracza (404/409) → drużyna (422) → wiarygodność pozycji (422, zapisana jako `rejected`)
    → odległość (`too_far`, zapisana) → walka. Zwycięstwo jest atomowe: blokada wiersza przeciwnika i unikalny indeks
    na `game_attack (encounter_id) WHERE outcome='won'`.
    """
    cfg = settings.APP.game
    if user.role == Role.ADMIN:
        raise ApiError(http.HTTP_403_FORBIDDEN, 'forbidden', 'Administrator nie walczy')
    now = timezone.now()
    _check_rate(user, now)
    rejection = None
    with transaction.atomic():
        encounter = Encounter.objects.select_for_update().select_related('enemy_type__type').filter(pk=encounter_id, user=user).first()
        if encounter is None:
            raise ApiError(http.HTTP_404_NOT_FOUND, 'not_found', 'Ten przeciwnik nie istnieje')
        if encounter.status == EncounterStatus.ACTIVE and encounter.expires_at <= now:
            encounter.status = EncounterStatus.EXPIRED
            encounter.save(update_fields=['status'])
        if encounter.status == EncounterStatus.DEFEATED:
            raise ApiError(http.HTTP_409_CONFLICT, 'encounter_defeated', 'Ten przeciwnik został już pokonany')
        if encounter.status == EncounterStatus.EXPIRED:
            raise ApiError(http.HTTP_409_CONFLICT, 'encounter_expired', 'Ten przeciwnik już zniknął')
        team = _team(user, req.pokemon_ids)
        distance = distance_m(req.fix.lat, req.fix.lng, encounter.lat, encounter.lng)

        try:
            location.verify(user, req.fix, now=now)
        except LocationRejected as exc:
            _log(encounter, user, req, distance, AttackOutcome.REJECTED, reason=exc.reason)
            rejection = exc  # zapis próby zostaje (transakcja kończy się normalnie), a błąd idzie po wyjściu z bloku
        else:
            if distance > cfg.interaction_range_m:
                _log(encounter, user, req, distance, AttackOutcome.TOO_FAR)
                return {'outcome': 'too_far', 'distanceM': round(distance)}
            return _fight(user, encounter, team, req, distance, now)
    raise rejection


def _fight(user: User, encounter: Encounter, team: list[Pokemon], req: AttackRequest, distance: float, now: datetime) -> dict:
    cfg = settings.APP.game
    enemy_type_id = encounter.enemy_type.type_id
    used = []
    for p in team:
        multiplier = Decimal(str(cfg.same_type_multiplier)) if p.character.type_id == enemy_type_id else Decimal('1')
        used.append((p, power_for(p.character, p.exp), multiplier))
    total = round(sum(power * float(m) for _, power, m in used))
    won = total > encounter.power

    reward = grant_pokemon(user, _award_character(), PokemonOrigin.ENCOUNTER) if won else None
    try:
        with transaction.atomic():
            attempt = _log(encounter, user, req, distance, AttackOutcome.WON if won else AttackOutcome.LOST, pokemon_power_total=total, reward_pokemon=reward)
    except IntegrityError as exc:  # ktoś inny wygrał w tej samej chwili (unikalny indeks zwycięstwa)
        raise ApiError(http.HTTP_409_CONFLICT, 'encounter_defeated', 'Ten przeciwnik został już pokonany') from exc
    exp = encounter.xp_reward if won else 0
    AttackPokemon.objects.bulk_create([
        AttackPokemon(attack=attempt, pokemon=p, power_used=power, type_multiplier_applied=m, exp_gained=exp) for p, power, m in used
    ])
    pokemons = [
        {'pokemonId': p.id, 'powerUsed': power, 'typeMultiplierApplied': float(m), **({'expGained': exp} if exp else {})}
        for p, power, m in used
    ]
    if not won:
        return {'outcome': 'lost', 'enemyPower': encounter.power, 'pokemonPowerTotal': total, 'pokemons': pokemons}

    for p, _, _ in used:
        add_exp(p, exp)
    encounter.status, encounter.defeated_by, encounter.defeated_at = EncounterStatus.DEFEATED, user, now
    encounter.save(update_fields=['status', 'defeated_by', 'defeated_at'])
    progress, _ = PlayerProgress.objects.get_or_create(user=user)
    PlayerProgress.objects.filter(pk=progress.pk).update(xp=F('xp') + encounter.xp_reward)
    return {
        'outcome': 'won', 'enemyPower': encounter.power, 'pokemonPowerTotal': total, 'pokemons': pokemons,
        'awardedCharacter': reward.character.code, 'xpGained': encounter.xp_reward, 'progress': progress_payload(user),
    }
