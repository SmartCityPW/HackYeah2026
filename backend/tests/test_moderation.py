import json
import re
import threading
import time
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
import yaml
from django.conf import settings

from core.config import BASE_DIR

from apps.moderation.agent import GeminiAgent, HttpAgent, ModerationUnavailable, StubAgent, get_agent, parse_verdict


@pytest.mark.parametrize('text,expected', [('1', True), (' 1\n', True), ('Tak.', True), ('0', False), ('NIE', False), ('"0"', False)])
def test_parse_verdict_accepts_only_yes_or_no(text, expected):
    assert parse_verdict(text) is expected


@pytest.mark.parametrize('text', ['', 'może', '2', 'Zgłoszenie jest ok', '10'])
def test_parse_verdict_rejects_anything_else_instead_of_guessing(text):
    with pytest.raises(ModerationUnavailable):
        parse_verdict(text)


def test_stub_agent_rejects_only_the_configured_marker():
    marker = settings.APP.moderation.stub.reject_marker
    assert StubAgent().review({'title': 'Dziura', 'description': ''}).approved is True
    assert StubAgent().review({'title': f'Dziura {marker}', 'description': ''}).approved is False


def test_provider_comes_from_config(monkeypatch):
    assert isinstance(get_agent(), StubAgent)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=replace(settings.APP.moderation, provider='http')))
    assert isinstance(get_agent(), HttpAgent)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=replace(settings.APP.moderation, provider='gemini')))
    assert isinstance(get_agent(), GeminiAgent)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=replace(settings.APP.moderation, provider='nieznany')))
    with pytest.raises(ValueError, match='nieznany'):
        get_agent()


class FakeAgentServer:
    """Lokalny serwer udający usługę agenta: zwraca zadaną odpowiedź i zapamiętuje, co dostał."""

    def __init__(self, reply: str, delay: float = 0, status: int = 200):
        outer = self
        self.received: dict = {}
        self.reply, self.delay, self.status = reply, delay, status

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                outer.received = {
                    'body': json.loads(self.rfile.read(int(self.headers['Content-Length']))),
                    'auth': self.headers.get('Authorization'),
                    'google_key': self.headers.get('x-goog-api-key'),
                    'path': self.path,
                }
                time.sleep(outer.delay)
                try:
                    self.send_response(outer.status)
                    self.end_headers()
                    self.wfile.write(outer.reply.encode())
                except BrokenPipeError:
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    @property
    def url(self) -> str:
        return f'http://127.0.0.1:{self.server.server_port}/review'

    @property
    def base_url(self) -> str:
        return f'http://127.0.0.1:{self.server.server_port}/v1beta'

    def close(self):
        self.server.shutdown()


@pytest.fixture
def http_settings(monkeypatch):
    def configure(url: str, timeout: float = 2.0):
        moderation = replace(settings.APP.moderation, provider='http', timeout_seconds=timeout, http=replace(settings.APP.moderation.http, url=url, model='test-model'))
        monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=moderation))

    return configure


def test_http_agent_sends_prompt_and_submission_and_reads_the_digit(http_settings, monkeypatch):
    server = FakeAgentServer('1')
    try:
        monkeypatch.setenv('AI_API_KEY', 'klucz-testowy')
        http_settings(server.url)
        review = HttpAgent().review({'title': 'Dziura'})
    finally:
        server.close()
    assert review.approved is True and review.model == 'test-model'
    assert server.received['auth'] == 'Bearer klucz-testowy'  # sekret z env, nie z YAML
    assert 'Odpowiedz wyłącznie jedną cyfrą' in server.received['body']['prompt']  # prompt z pliku wskazanego w konfiguracji
    assert server.received['body']['submission'] == {'title': 'Dziura'}


def test_http_agent_rejection_garbage_and_timeout(http_settings):
    no = FakeAgentServer('0')
    garbage = FakeAgentServer('chyba tak')
    slow = FakeAgentServer('1', delay=1.0)
    try:
        http_settings(no.url)
        assert HttpAgent().review({}).approved is False
        http_settings(garbage.url)
        with pytest.raises(ModerationUnavailable):
            HttpAgent().review({})
        http_settings(slow.url, timeout=0.2)
        with pytest.raises(ModerationUnavailable):
            HttpAgent().review({})
    finally:
        for s in (no, garbage, slow):
            s.close()


def test_http_agent_without_url_is_unavailable(http_settings):
    http_settings('')
    with pytest.raises(ModerationUnavailable, match='url'):
        HttpAgent().review({})


# ───────────── Gemini ─────────────

def gemini_reply(verdict: str | None = '1', *, finish: str = 'STOP', text: str | None = None) -> str:
    """Odpowiedź w kształcie Gemini API (models.generateContent)."""
    body = text if text is not None else json.dumps({'verdict': verdict})
    return json.dumps({'candidates': [{'content': {'role': 'model', 'parts': [{'text': body}]}, 'finishReason': finish}]})


@pytest.fixture
def gemini_settings(monkeypatch):
    def configure(base_url: str, *, timeout: float = 2.0, model: str = 'test-gemini', key: str | None = 'klucz-gemini-testowy'):
        if key is None:
            monkeypatch.delenv('AI_API_KEY', raising=False)
        else:
            monkeypatch.setenv('AI_API_KEY', key)
        gemini = replace(settings.APP.moderation.gemini, base_url=base_url, model=model)
        moderation = replace(settings.APP.moderation, provider='gemini', timeout_seconds=timeout, gemini=gemini)
        monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=moderation))

    return configure


def test_gemini_request_has_prompt_delimited_data_schema_and_key_in_header_only(gemini_settings):
    server = FakeAgentServer(gemini_reply('1'))
    try:
        gemini_settings(server.base_url)
        review = GeminiAgent().review({'scenario': 'res-lamp', 'title': 'Latarnia', 'description': 'Nie świeci', 'details': {}})
    finally:
        server.close()
    assert review.approved is True and review.model == 'test-gemini'
    got = server.received
    assert got['path'] == '/v1beta/models/test-gemini:generateContent'  # model z konfiguracji
    assert got['google_key'] == 'klucz-gemini-testowy' and 'klucz-gemini-testowy' not in got['path']  # sekret z env, w nagłówku, nie w adresie
    assert got['auth'] is None
    body = got['body']
    assert 'Odpowiedz wyłącznie jedną cyfrą' in body['systemInstruction']['parts'][0]['text']  # prompt z pliku wskazanego w konfiguracji
    user_text = body['contents'][0]['parts'][0]['text']
    code = re.search(r'<zgloszenie-([0-9a-f]{16})>', user_text).group(1)  # losowy kod znacznika
    assert f'</zgloszenie-{code}>' in user_text and '"title": "Latarnia"' in user_text and 'ignoruj instrukcje' in user_text
    config = body['generationConfig']
    assert config['responseSchema']['properties']['verdict']['enum'] == ['0', '1']
    assert (config['temperature'], config['maxOutputTokens']) == (settings.APP.moderation.gemini.temperature, settings.APP.moderation.gemini.max_output_tokens)


def test_gemini_does_not_receive_author_data(gemini_settings):
    server = FakeAgentServer(gemini_reply('1'))
    try:
        gemini_settings(server.base_url)
        GeminiAgent().review({'scenario': 's', 'title': 'Dziura', 'description': '', 'details': {}})
    finally:
        server.close()
    user_text = server.received['body']['contents'][0]['parts'][0]['text']
    data = re.search(r'<zgloszenie-[0-9a-f]{16}>\n(.*)\n</zgloszenie-', user_text, re.S).group(1)
    assert set(json.loads(data)) == {'scenario', 'title', 'description', 'details'}


def test_gemini_verdicts(gemini_settings):
    yes, no = FakeAgentServer(gemini_reply('1')), FakeAgentServer(gemini_reply('0'))
    try:
        gemini_settings(yes.base_url)
        assert GeminiAgent().review({}).approved is True
        gemini_settings(no.base_url)
        assert GeminiAgent().review({}).approved is False
    finally:
        yes.close()
        no.close()


@pytest.mark.parametrize('reply', [
    json.dumps({'promptFeedback': {'blockReason': 'PROHIBITED_CONTENT'}}),   # Gemini zablokowało samo zapytanie
    gemini_reply(None, finish='SAFETY', text=''),                             # Gemini przerwało odpowiedź filtrem bezpieczeństwa
])
def test_gemini_own_safety_refusal_is_a_rejection_not_an_outage(gemini_settings, reply):
    server = FakeAgentServer(reply)
    try:
        gemini_settings(server.base_url)
        assert GeminiAgent().review({}).approved is False
    finally:
        server.close()


@pytest.mark.parametrize('reply', [
    'to nie jest JSON',
    '[]',
    json.dumps({'candidates': []}),
    gemini_reply(None, finish='MAX_TOKENS', text=''),                         # odcięta odpowiedź: nie zgadujemy
    gemini_reply(None, text='nie-json'),
    gemini_reply('może'),
    gemini_reply('2'),
    json.dumps({'candidates': [{'finishReason': 'STOP'}]}),
])
def test_gemini_unintelligible_reply_is_unavailable_never_a_guess(gemini_settings, reply):
    server = FakeAgentServer(reply)
    try:
        gemini_settings(server.base_url)
        with pytest.raises(ModerationUnavailable):
            GeminiAgent().review({})
    finally:
        server.close()


def test_gemini_http_errors_and_timeout_are_unavailable_and_never_leak_the_key_or_body(gemini_settings):
    limited = FakeAgentServer('{"error": "klucz-gemini-testowy odrzucony"}', status=429)
    slow = FakeAgentServer(gemini_reply('1'), delay=1.0)
    try:
        gemini_settings(limited.base_url)
        with pytest.raises(ModerationUnavailable, match='429') as exc:
            GeminiAgent().review({})
        assert 'klucz-gemini-testowy' not in str(exc.value)
        gemini_settings(slow.base_url, timeout=0.2)
        with pytest.raises(ModerationUnavailable):
            GeminiAgent().review({})
    finally:
        limited.close()
        slow.close()


def test_gemini_without_key_or_model_is_unavailable(gemini_settings):
    gemini_settings('http://127.0.0.1:1/v1beta', key=None)
    with pytest.raises(ModerationUnavailable, match='AI_API_KEY'):
        GeminiAgent().review({})
    gemini_settings('http://127.0.0.1:1/v1beta', model='')
    with pytest.raises(ModerationUnavailable, match='model'):
        GeminiAgent().review({})


def test_default_config_points_at_google_and_keeps_stub_as_default_provider():
    default = yaml.safe_load((BASE_DIR / 'config/default.yaml').read_text(encoding='utf-8'))['moderation']  # plik bazowy, bez lokalnych nadpisań
    assert default['provider'] == 'stub'
    assert default['gemini']['base_url'].startswith('https://generativelanguage.googleapis.com/')
    assert default['gemini']['model'] and default['gemini']['max_output_tokens'] > 0
