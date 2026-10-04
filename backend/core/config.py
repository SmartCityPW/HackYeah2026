"""Typowana konfiguracja z YAML. Jedyne miejsce, które czyta pliki konfiguracyjne.

Kolejność: plik bazowy (`APP_CONFIG`, domyślnie config/default.yaml) + opcjonalne nadpisania (`APP_CONFIG_OVERRIDE`, także kilka plików po przecinku).
Sekretów tu nie ma (patrz core/secrets.py). Ścieżki względne liczone są od katalogu backendu.
"""
from __future__ import annotations

import os
import typing
from dataclasses import dataclass, fields, is_dataclass
from functools import lru_cache
from pathlib import Path

import yaml

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_CONFIG = 'APP_CONFIG'
ENV_OVERRIDE = 'APP_CONFIG_OVERRIDE'
DEFAULT_CONFIG = 'config/default.yaml'


class ConfigError(Exception):
    """Błędna lub niekompletna konfiguracja."""


@dataclass(frozen=True)
class AppSection:
    name: str
    debug: bool
    language: str
    timezone: str
    allowed_hosts: list[str]
    cors_allowed_origins: list[str]
    api_prefix: str
    https_proxy: bool
    hsts_seconds: int


@dataclass(frozen=True)
class ServerSection:
    host: str
    port: int
    workers: int
    timeout_seconds: int
    trusted_proxies: int


@dataclass(frozen=True)
class DatabaseSection:
    engine: str
    name: str
    user: str
    host: str
    port: int


@dataclass(frozen=True)
class StorageSection:
    media_root: str
    media_url: str


@dataclass(frozen=True)
class SeedSection:
    dir: str
    on_start: bool
    demo_on_start: bool


@dataclass(frozen=True)
class AdminSection:
    email: str
    display_name: str


@dataclass(frozen=True)
class AuthSection:
    access_token_minutes: int
    refresh_token_days: int
    password_min_length: int
    guest_rate: str
    login_rate: str


@dataclass(frozen=True)
class ExpSection:
    per_vote: int
    stake_release_bonus: int


@dataclass(frozen=True)
class LevelsSection:
    exp_per_pokemon_level: int
    xp_per_player_level: int


@dataclass(frozen=True)
class EncountersSection:
    cell_size_m: int
    max_per_cell: int
    max_in_response: int
    lifetime_minutes: int
    respawn_seconds: int
    default_radius_m: int
    max_radius_m: int
    retention_hours: int


@dataclass(frozen=True)
class AntiCheatSection:
    min_seconds_between_attacks: int
    max_attacks_per_hour: int


@dataclass(frozen=True)
class GameSection:
    interaction_range_m: float
    max_party_size: int
    same_type_multiplier: float
    exp: ExpSection
    levels: LevelsSection
    encounters: EncountersSection
    anti_cheat: AntiCheatSection


@dataclass(frozen=True)
class PhotosSection:
    max_per_pokestop: int
    max_bytes: int
    allowed_content_types: list[str]


@dataclass(frozen=True)
class TimelineSection:
    title_max_length: int
    body_max_length: int
    max_updates_per_pokestop: int
    max_custom_fields: int
    custom_field_label_max_length: int
    custom_field_value_max_length: int


@dataclass(frozen=True)
class SurveySection:
    max_questions: int
    max_options: int
    text_max_length: int


@dataclass(frozen=True)
class PokestopsSection:
    votes_required_default: int
    default_page_size: int
    max_page_size: int
    comment_max_length: int
    withdraw_reason: str
    photos: PhotosSection
    timeline: TimelineSection
    survey: SurveySection


@dataclass(frozen=True)
class ModerationStubSection:
    reject_marker: str


@dataclass(frozen=True)
class ModerationHttpSection:
    url: str
    model: str


@dataclass(frozen=True)
class ModerationGeminiSection:
    base_url: str
    model: str
    temperature: float
    max_output_tokens: int


@dataclass(frozen=True)
class ModerationLayeredSection:
    ai: str
    require_ai: bool
    on_ai_error: str


@dataclass(frozen=True)
class ModerationSection:
    provider: str
    timeout_seconds: float
    log_retention_days: int
    cases_file: str
    prompt_file: str
    rules_file: str
    layered: ModerationLayeredSection
    stub: ModerationStubSection
    http: ModerationHttpSection
    gemini: ModerationGeminiSection


@dataclass(frozen=True)
class EventsSection:
    default_window_days: int
    max_duration_days: int
    description_max_length: int


@dataclass(frozen=True)
class LocationSection:
    require_accuracy: bool
    max_accuracy_m: float
    require_timestamp: bool
    max_age_seconds: float
    max_future_seconds: float
    max_speed_mps: float
    speed_ignore_below_m: float
    allow_simulated: bool


@dataclass(frozen=True)
class ContractSection:
    openapi_file: str
    schema_sql_file: str
    seed_reference_sql_file: str
    frontend_catalog_file: str


@dataclass(frozen=True)
class Config:
    app: AppSection
    server: ServerSection
    database: DatabaseSection
    storage: StorageSection
    seed: SeedSection
    admin: AdminSection
    auth: AuthSection
    game: GameSection
    pokestops: PokestopsSection
    moderation: ModerationSection
    events: EventsSection
    location: LocationSection
    contract: ContractSection

    def path(self, value: str) -> Path:
        """Zamienia ścieżkę z konfiguracji na bezwzględną (względne liczone od katalogu backendu)."""
        p = Path(value)
        return p if p.is_absolute() else BASE_DIR / p


def _merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        out[key] = _merge(out[key], value) if isinstance(value, dict) and isinstance(out.get(key), dict) else value
    return out


def _build(cls, data, where: str):
    """Buduje dataclass z słownika: wymaga kompletu kluczy, odrzuca nieznane, sprawdza typy."""
    if not isinstance(data, dict):
        raise ConfigError(f'{where}: oczekiwano sekcji (słownika), jest {type(data).__name__}')
    hints = typing.get_type_hints(cls)
    expected = {f.name for f in fields(cls)}
    missing, unknown = expected - data.keys(), data.keys() - expected
    if missing:
        raise ConfigError(f'{where}: brak kluczy {sorted(missing)}')
    if unknown:
        raise ConfigError(f'{where}: nieznane klucze {sorted(unknown)}')
    values = {}
    for name in expected:
        hint, value, path = hints[name], data[name], f'{where}.{name}'
        if is_dataclass(hint):
            values[name] = _build(hint, value, path)
        else:
            values[name] = _check(hint, value, path)
    return cls(**values)


def _check(hint, value, where: str):
    origin = typing.get_origin(hint)
    if origin is list:
        if not isinstance(value, list):
            raise ConfigError(f'{where}: oczekiwano listy')
        return value
    if hint is float and isinstance(value, int) and not isinstance(value, bool):
        return float(value)
    if hint is int and isinstance(value, bool) or not isinstance(value, hint):
        raise ConfigError(f'{where}: oczekiwano {hint.__name__}, jest {type(value).__name__}')
    return value


def _read(path: Path) -> dict:
    if not path.is_file():
        raise ConfigError(f'Nie znaleziono pliku konfiguracji: {path}')
    return yaml.safe_load(path.read_text(encoding='utf-8')) or {}


def _resolve(value: str) -> Path:
    p = Path(value)
    return p if p.is_absolute() else BASE_DIR / p


@lru_cache(maxsize=1)
def get_config() -> Config:
    data = _read(_resolve(os.environ.get(ENV_CONFIG, DEFAULT_CONFIG)))
    # Nadpisania mogą być listą plików rozdzieloną przecinkami (scalane po kolei, późniejszy wygrywa), np. dane demo + Gemini.
    for override in filter(None, (part.strip() for part in os.environ.get(ENV_OVERRIDE, '').split(','))):
        data = _merge(data, _read(_resolve(override)))
    return _build(Config, data, 'config')
