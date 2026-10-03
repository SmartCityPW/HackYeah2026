"""Agent moderujący: port (`ModerationAgent`) i dwa adaptery wybierane konfiguracją (`moderation.provider`).

Agent zwraca wyłącznie tak/nie (opis.md). Awaria lub brak odpowiedzi to `ModerationUnavailable`, a nie
domyślna akceptacja: niezweryfikowana treść nie trafia na publiczną mapę.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings

from core.secrets import secret


class ModerationUnavailable(Exception):
    """Agent nie odpowiedział w limicie czasu albo zwrócił niezrozumiałą odpowiedź."""


@dataclass(frozen=True)
class Review:
    approved: bool
    model: str


class ModerationAgent(Protocol):
    def review(self, submission: dict) -> Review: ...


_YES, _NO = {'1', 'tak', 'yes', 'true'}, {'0', 'nie', 'no', 'false'}


def parse_verdict(text: str) -> bool:
    """Zamienia odpowiedź agenta (1/0, tak/nie) na bool. Wszystko inne to błąd, a nie cichy domyślny wynik."""
    word = text.strip().lower().strip('.!"\' \n')
    if word in _YES:
        return True
    if word in _NO:
        return False
    raise ModerationUnavailable(f'Niezrozumiała odpowiedź agenta: {text[:40]!r}')


class StubAgent:
    """Tryb deweloperski i testowy: akceptuje wszystko poza treścią ze znacznikiem z konfiguracji."""

    def review(self, submission: dict) -> Review:
        marker = settings.APP.moderation.stub.reject_marker
        text = f"{submission.get('title', '')} {submission.get('description', '')}"
        return Review(approved=not (marker and marker in text), model='stub')


class HttpAgent:
    """Wysyła prompt (z pliku z konfiguracji) i zgłoszenie pod adres z konfiguracji; klucz API z env AI_API_KEY."""

    def review(self, submission: dict) -> Review:
        cfg = settings.APP.moderation
        if not cfg.http.url:
            raise ModerationUnavailable('moderation.http.url nie jest ustawiony')
        prompt = settings.APP.path(cfg.prompt_file).read_text(encoding='utf-8')
        body = json.dumps({'model': cfg.http.model, 'prompt': prompt, 'submission': submission}).encode()
        headers = {'Content-Type': 'application/json'}
        key = secret('AI_API_KEY', required=False)
        if key:
            headers['Authorization'] = f'Bearer {key}'
        request = urllib.request.Request(cfg.http.url, data=body, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=cfg.timeout_seconds) as response:  # noqa: S310
                text = response.read().decode('utf-8')
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ModerationUnavailable(f'Agent niedostępny: {exc}') from exc
        return Review(approved=parse_verdict(text), model=cfg.http.model or 'http')


def get_agent() -> ModerationAgent:
    provider = settings.APP.moderation.provider
    if provider == 'stub':
        return StubAgent()
    if provider == 'http':
        return HttpAgent()
    raise ValueError(f'moderation.provider: nieobsługiwana wartość {provider!r} (stub | http)')
