"""Konfiguracja gunicorna z tego samego YAML-a co reszta aplikacji (bez zaszywania portów i liczby procesów)."""
from core.config import get_config

_server = get_config().server
bind = f'{_server.host}:{_server.port}'
workers = _server.workers
timeout = _server.timeout_seconds
accesslog = '-'
# Gniazdo sterujące (gunicornc) nie jest używane, a domyślnie wymaga katalogu domowego użytkownika (w obrazie go nie ma).
control_socket_disable = True
