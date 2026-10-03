"""Pliki wdrożeniowe nie mogą się rozjechać z konfiguracją YAML (jedno źródło prawdy dla wartości niesekretnych)."""
import re
from pathlib import Path

import pytest
import yaml
from core.config import BASE_DIR

ROOT = BASE_DIR.parent
COMPOSE = ROOT / 'docker-compose.yml'
needs_compose = pytest.mark.skipif(not COMPOSE.is_file(), reason='brak docker-compose.yml (obraz bez repozytorium)')


def _base_config() -> dict:
    """Konfiguracja bazowa (bez nadpisań testowych): z niej korzysta kontener."""
    return yaml.safe_load((BASE_DIR / 'config' / 'default.yaml').read_text(encoding='utf-8'))


def _compose() -> dict:
    return yaml.safe_load(COMPOSE.read_text(encoding='utf-8'))


def _default(expr: str) -> str:
    """'${VAR:-wartość}' -> 'wartość'."""
    return re.search(r'\$\{[A-Z_]+:-([^}]*)\}', expr).group(1)


@needs_compose
def test_compose_database_defaults_match_yaml():
    db = _compose()['services']['db']['environment']
    base = _base_config()['database']
    assert _default(db['POSTGRES_DB']) == base['name']
    assert _default(db['POSTGRES_USER']) == base['user']
    assert 'service_healthy' in str(_compose()['services']['backend']['depends_on'])


@needs_compose
def test_compose_container_port_and_media_match_yaml():
    backend, base = _compose()['services']['backend'], _base_config()
    assert backend['ports'][0].rsplit(':', 1)[1] == str(base['server']['port'])
    assert backend['volumes'][0].split(':')[1] == f"/app/{base['storage']['media_root']}"
    assert base['database']['host'] == 'db'  # nazwa usługi w compose


@needs_compose
def test_compose_passes_secrets_only_through_env_file():
    text = COMPOSE.read_text(encoding='utf-8')
    assert 'env_file: .env' in text
    assert not re.search(r'(DJANGO_SECRET_KEY|AI_API_KEY)\s*:\s*\S', text), 'sekret zapisany w compose'
    assert '${DB_PASSWORD:?' in text  # wymagany, bez wartości domyślnej


def test_env_example_lists_exactly_the_secrets_the_code_reads():
    example = (ROOT / '.env.example')
    if not example.is_file():
        pytest.skip('brak .env.example')
    declared = set(re.findall(r'^([A-Z_]+)=', example.read_text(encoding='utf-8'), re.M))
    used = set()
    for path in BASE_DIR.rglob('*.py'):
        if 'tests' in path.parts or '.venv' in path.parts:
            continue
        used |= set(re.findall(r"secret\(\s*'([A-Z_]+)'", path.read_text(encoding='utf-8')))
    assert declared == used, f'.env.example: {sorted(declared)}, kod czyta: {sorted(used)}'


def test_dockerfile_does_not_hardcode_server_settings():
    dockerfile = (BASE_DIR / 'Dockerfile').read_text(encoding='utf-8')
    assert 'config/gunicorn.py' in dockerfile and '--bind' not in dockerfile and '--workers' not in dockerfile
