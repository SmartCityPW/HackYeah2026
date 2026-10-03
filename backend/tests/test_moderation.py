import json
import threading
import time
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from django.conf import settings

from apps.moderation.agent import HttpAgent, ModerationUnavailable, StubAgent, get_agent, parse_verdict


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
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=replace(settings.APP.moderation, provider='nieznany')))
    with pytest.raises(ValueError, match='nieznany'):
        get_agent()


class FakeAgentServer:
    """Lokalny serwer udający usługę agenta: zwraca zadaną odpowiedź i zapamiętuje, co dostał."""

    def __init__(self, reply: str, delay: float = 0):
        outer = self
        self.received: dict = {}
        self.reply, self.delay = reply, delay

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                outer.received = {'body': json.loads(self.rfile.read(int(self.headers['Content-Length']))), 'auth': self.headers.get('Authorization')}
                time.sleep(outer.delay)
                try:
                    self.send_response(200)
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
