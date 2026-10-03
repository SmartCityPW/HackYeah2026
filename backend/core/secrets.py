"""Sekrety czytane wyłącznie ze zmiennych środowiskowych (nigdy z plików konfiguracyjnych ani z kodu)."""
import os

from django.core.exceptions import ImproperlyConfigured


def secret(name: str, *, required: bool = True) -> str:
    value = os.environ.get(name, '')
    if required and not value:
        raise ImproperlyConfigured(f'Brak wymaganej zmiennej środowiskowej {name} (patrz .env.example)')
    return value
