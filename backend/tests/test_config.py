import pytest
import yaml
from django.core.exceptions import ImproperlyConfigured

from core import config as cfg
from core.secrets import secret

VALID = yaml.safe_load((cfg.BASE_DIR / 'config' / 'default.yaml').read_text(encoding='utf-8'))


def load(tmp_path, monkeypatch, data, override=None):
    base = tmp_path / 'base.yaml'
    base.write_text(yaml.safe_dump(data), encoding='utf-8')
    monkeypatch.setenv(cfg.ENV_CONFIG, str(base))
    monkeypatch.delenv(cfg.ENV_OVERRIDE, raising=False)
    if override is not None:
        extra = tmp_path / 'override.yaml'
        extra.write_text(yaml.safe_dump(override), encoding='utf-8')
        monkeypatch.setenv(cfg.ENV_OVERRIDE, str(extra))
    cfg.get_config.cache_clear()
    try:
        return cfg.get_config()
    finally:
        cfg.get_config.cache_clear()


def test_default_config_is_valid_and_typed(tmp_path, monkeypatch):
    c = load(tmp_path, monkeypatch, VALID)
    assert c.game.interaction_range_m == 50
    assert c.game.exp.per_vote == 10
    assert c.game.same_type_multiplier == 1.2


def test_override_is_merged_key_by_key(tmp_path, monkeypatch):
    c = load(tmp_path, monkeypatch, VALID, override={'game': {'interaction_range_m': 75}})
    assert c.game.interaction_range_m == 75
    assert c.game.max_party_size == 3  # reszta sekcji nietknięta


def test_missing_key_is_reported(tmp_path, monkeypatch):
    broken = {**VALID, 'game': {k: v for k, v in VALID['game'].items() if k != 'max_party_size'}}
    with pytest.raises(cfg.ConfigError, match='max_party_size'):
        load(tmp_path, monkeypatch, broken)


def test_unknown_key_is_rejected(tmp_path, monkeypatch):
    with pytest.raises(cfg.ConfigError, match='literówka'):
        load(tmp_path, monkeypatch, {**VALID, 'app': {**VALID['app'], 'literówka': 1}})


def test_wrong_type_is_rejected(tmp_path, monkeypatch):
    with pytest.raises(cfg.ConfigError, match='oczekiwano int'):
        load(tmp_path, monkeypatch, {**VALID, 'server': {**VALID['server'], 'port': 'osiem'}})


def test_relative_paths_resolve_against_backend_dir():
    c = cfg.get_config()
    assert c.path('config/seed') == cfg.BASE_DIR / 'config' / 'seed'
    assert c.path('/abs/path').as_posix() == '/abs/path'


def test_secrets_come_from_environment_only(monkeypatch):
    monkeypatch.setenv('SOME_SECRET', 'abc')
    assert secret('SOME_SECRET') == 'abc'
    monkeypatch.delenv('SOME_SECRET')
    with pytest.raises(ImproperlyConfigured, match='SOME_SECRET'):
        secret('SOME_SECRET')
    assert secret('SOME_SECRET', required=False) == ''


def test_no_secret_values_in_yaml_files():
    forbidden = {'SECRET_KEY', 'DJANGO_SECRET_KEY', 'PASSWORD', 'DB_PASSWORD', 'API_KEY', 'AI_API_KEY', 'TOKEN', 'PRIVATE_KEY', 'SIGNING_KEY'}
    for path in (cfg.BASE_DIR / 'config').glob('*.yaml'):
        keys = {k.upper() for k in _flat_keys(yaml.safe_load(path.read_text(encoding='utf-8')))}
        assert not keys & forbidden, f'{path.name} zawiera klucz wyglądający na sekret: {keys & forbidden}'


def _flat_keys(data):
    if isinstance(data, dict):
        for k, v in data.items():
            yield str(k)
            yield from _flat_keys(v)
