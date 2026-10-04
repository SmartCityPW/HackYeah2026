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


# ───────────── frontend w Dockerze ─────────────

FRONTEND = ROOT / 'frontend'


@needs_compose
def test_compose_frontend_port_matches_the_cors_origin_backend_allows():
    frontend = _compose()['services']['frontend']
    host_port = _default(frontend['ports'][0])
    assert f'http://localhost:{host_port}' in _base_config()['app']['cors_allowed_origins'], 'port frontendu musi być na liście app.cors_allowed_origins'
    assert frontend['ports'][0].endswith(':80')  # nginx w kontenerze nasłuchuje na 80
    assert 'backend' in frontend['depends_on']


@needs_compose
def test_compose_frontend_config_is_mounted_from_host_without_rebuild():
    volumes = _compose()['services']['frontend']['volumes']
    assert any(v.startswith('./frontend/public/config:') and v.endswith(':ro') for v in volumes)  # katalog, nie pojedynczy plik: edytor podmieniający plik nie psuje montowania
    assert (FRONTEND / 'public' / 'config' / 'app-config.yaml').is_file()


@pytest.mark.skipif(not (FRONTEND / 'Dockerfile').is_file(), reason='brak frontend/Dockerfile (obraz bez repozytorium)')
def test_frontend_image_builds_angular_and_serves_it_with_nginx():
    dockerfile = (FRONTEND / 'Dockerfile').read_text(encoding='utf-8')
    assert 'npm ci' in dockerfile and 'npm run build' in dockerfile
    assert 'dist/HackYeah2026/browser' in dockerfile and 'nginx' in dockerfile
    assert 'ARG NODE_VERSION' in dockerfile and 'ARG NGINX_VERSION' in dockerfile  # wersje jako parametry, nie na sztywno w FROM
    assert 'node_modules' in (FRONTEND / '.dockerignore').read_text(encoding='utf-8')


@pytest.mark.skipif(not (FRONTEND / 'docker' / 'nginx.conf').is_file(), reason='brak frontend/docker/nginx.conf')
def test_nginx_config_has_spa_fallback_and_javascript_mime_for_the_map_worker():
    conf = (FRONTEND / 'docker' / 'nginx.conf').read_text(encoding='utf-8')
    assert 'try_files $uri $uri/ /index.html' in conf  # odświeżenie na podstronie Angulara nie daje 404
    assert re.search(r'text/javascript\s+mjs', conf), 'worker MapLibre (.mjs) musi mieć typ JavaScript'
    assert re.search(r'location = /config/app-config\.yaml\s*\{.*?no-store', conf, re.S)  # konfiguracja zawsze świeża


# ───────────── wdrożenie produkcyjne prototypu ─────────────

def test_production_example_is_a_valid_override_and_turns_off_dev_features(tmp_path, monkeypatch):
    import yaml as _yaml
    from core import config as cfg
    example = _yaml.safe_load((BASE_DIR / 'config' / 'production.example.yaml').read_text(encoding='utf-8'))
    base = _yaml.safe_load((BASE_DIR / 'config' / 'default.yaml').read_text(encoding='utf-8'))
    merged = cfg._merge(base, example)
    built = cfg._build(cfg.Config, merged, 'config')
    assert built.app.debug is False and built.app.https_proxy is True
    assert built.location.allow_simulated is False  # produkcja nie przyjmuje symulowanego GPS
    assert built.server.trusted_proxies == 2        # Caddy + nginx
    assert built.moderation.provider == 'layered'


@needs_compose
def test_compose_publishes_backend_only_on_localhost_and_ships_tls_as_a_profile():
    compose = _compose()
    assert compose['services']['backend']['ports'][0].startswith('127.0.0.1:')
    caddy = compose['services']['caddy']
    assert caddy['profiles'] == ['tls'] and 'frontend' in caddy['depends_on']
    assert (ROOT / 'deploy' / 'Caddyfile').is_file()


@pytest.mark.skipif(not (FRONTEND / 'docker' / 'nginx.conf').is_file(), reason='brak frontend/docker/nginx.conf')
def test_nginx_proxies_api_to_the_backend_and_forwards_client_info():
    conf = (FRONTEND / 'docker' / 'nginx.conf').read_text(encoding='utf-8')
    assert re.search(r'location \^~ /api/\s*\{[^}]*proxy_pass http://backend:8000;', conf, re.S)
    assert 'X-Forwarded-For $proxy_add_x_forwarded_for' in conf and 'X-Forwarded-Proto $forwarded_proto' in conf


@pytest.mark.skipif(not (FRONTEND / 'public' / 'config' / 'app-config.production.yaml').is_file(), reason='brak konfiguracji frontendu')
def test_production_frontend_config_has_no_dev_tools_and_uses_relative_api():
    prod = yaml.safe_load((FRONTEND / 'public' / 'config' / 'app-config.production.yaml').read_text(encoding='utf-8'))
    dev = yaml.safe_load((FRONTEND / 'public' / 'config' / 'app-config.yaml').read_text(encoding='utf-8'))
    assert prod['dev']['tools'] is False and prod['upload']['enabled'] is False
    assert prod['api']['baseUrl'] == '/api/v1'
    assert set(prod) == set(dev)  # ten sam zestaw sekcji, żeby wersja produkcyjna nie została w tyle za deweloperską


@pytest.mark.skipif(not (FRONTEND / 'Dockerfile').is_file(), reason='brak frontend/Dockerfile')
def test_frontend_config_file_is_chosen_by_env_through_the_nginx_template():
    dockerfile = (FRONTEND / 'Dockerfile').read_text(encoding='utf-8')
    conf = (FRONTEND / 'docker' / 'nginx.conf').read_text(encoding='utf-8')
    assert '/etc/nginx/templates/default.conf.template' in dockerfile and 'FRONTEND_CONFIG=app-config.production.yaml' in dockerfile
    assert 'alias /usr/share/nginx/html/config/${FRONTEND_CONFIG};' in conf
    if COMPOSE.is_file():
        assert 'FRONTEND_CONFIG' in str(_compose()['services']['frontend']['environment'])
