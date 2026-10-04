"""Ustawienia Django budowane z konfiguracji YAML (config/*.yaml) i sekretów ze zmiennych środowiskowych."""
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from core.config import BASE_DIR, get_config
from core.secrets import secret

APP = get_config()  # dostęp w kodzie: django.conf.settings.APP

SECRET_KEY = secret('DJANGO_SECRET_KEY')
DEBUG = APP.app.debug
ALLOWED_HOSTS = APP.app.allowed_hosts

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'core',
    'apps.accounts',
    'apps.collection',
    'apps.scenarios',
    'apps.pokestops',
    'apps.events',
    'apps.game',
    'apps.moderation',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'smartcity.urls'
WSGI_APPLICATION = 'smartcity.wsgi.application'
AUTH_USER_MODEL = 'accounts.User'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

if APP.database.engine == 'sqlite':
    # ":memory:" zostaje bez zmian, ścieżka pliku jest liczona od katalogu backendu (nie od bieżącego katalogu procesu)
    sqlite_name = APP.database.name if APP.database.name == ':memory:' else str(APP.path(APP.database.name))
    if sqlite_name != ':memory:':
        Path(sqlite_name).parent.mkdir(parents=True, exist_ok=True)  # katalog bazy (np. data/) nie istnieje w świeżym repozytorium
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': sqlite_name}}
elif APP.database.engine == 'postgresql':
    try:
        db_password = secret('DB_PASSWORD')
    except ImproperlyConfigured as exc:
        raise ImproperlyConfigured(
            f'{exc}. Konfiguracja domyślna używa PostgreSQL. Do pracy lokalnej bez Dockera ustaw '
            'APP_CONFIG_OVERRIDE=config/local.yaml (SQLite), np. przez: source config/local.env'
        ) from exc
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': APP.database.name,
            'USER': APP.database.user,
            'PASSWORD': db_password,
            'HOST': APP.database.host,
            'PORT': APP.database.port,
        }
    }
else:
    raise ValueError(f'database.engine: nieobsługiwana wartość {APP.database.engine!r} (postgresql | sqlite)')

# Limity żądań (throttling) zapisują liczniki w pamięci podręcznej. Domyślna pamięć procesu jest osobna w każdym z procesów
# gunicorna (3 procesy = limit 3 razy większy), dlatego liczniki trzymamy w bazie. Tabelę tworzy `manage.py bootstrap`.
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.db.DatabaseCache', 'LOCATION': 'django_cache'}}

LANGUAGE_CODE = APP.app.language
TIME_ZONE = APP.app.timezone
USE_TZ = True

STATIC_URL = '/static/'
MEDIA_URL = APP.storage.media_url
MEDIA_ROOT = APP.path(APP.storage.media_root)

CORS_ALLOWED_ORIGINS = APP.app.cors_allowed_origins

if APP.app.https_proxy:
    # TLS kończy proxy przed aplikacją (Caddy, nginx): ufamy jego nagłówkowi, żeby Django wiedziało, że połączenie jest bezpieczne.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
if APP.app.hsts_seconds:
    SECURE_HSTS_SECONDS = APP.app.hsts_seconds
SECURE_CONTENT_TYPE_NOSNIFF = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser', 'rest_framework.parsers.MultiPartParser'],
    'EXCEPTION_HANDLER': 'core.errors.exception_handler',
    'DEFAULT_THROTTLE_RATES': {'guest': APP.auth.guest_rate, 'login': APP.auth.login_rate},
    'NUM_PROXIES': APP.server.trusted_proxies or None,  # None = adres klienta z połączenia; liczba = IP z X-Forwarded-For przed N proxy
    'DATETIME_FORMAT': 'iso-8601',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=APP.auth.access_token_minutes),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=APP.auth.refresh_token_days),
    'SIGNING_KEY': SECRET_KEY,
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'DEBUG' if DEBUG else 'INFO'},
}
