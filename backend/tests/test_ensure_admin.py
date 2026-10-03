import pytest
from dataclasses import replace

from django.conf import settings
from django.core.management import call_command

from apps.accounts.models import Role, User
from apps.pokestops.models import Pokestop

pytestmark = pytest.mark.django_db


def _admin_email() -> str:
    return settings.APP.admin.email.lower()


def test_admin_is_created_from_yaml_email_and_env_password(monkeypatch):
    monkeypatch.setenv('ADMIN_PASSWORD', 'tajne-haslo-admina')
    call_command('ensure_admin')
    admin = User.objects.get(email=_admin_email())
    assert admin.role == Role.ADMIN and admin.check_password('tajne-haslo-admina')


def test_existing_admin_keeps_its_password(monkeypatch):
    monkeypatch.setenv('ADMIN_PASSWORD', 'pierwsze-haslo')
    call_command('ensure_admin')
    monkeypatch.setenv('ADMIN_PASSWORD', 'drugie-haslo')
    call_command('ensure_admin')
    assert User.objects.get(email=_admin_email()).check_password('pierwsze-haslo')


def test_account_with_admin_email_is_promoted_not_duplicated(monkeypatch, make_resident):
    user = User.objects.create_user(_admin_email(), 'haslo-mieszkanca', 'Ktoś')
    monkeypatch.setenv('ADMIN_PASSWORD', 'cokolwiek')
    call_command('ensure_admin')
    user.refresh_from_db()
    assert user.role == Role.ADMIN and User.objects.filter(email=_admin_email()).count() == 1


def test_no_password_means_no_admin(monkeypatch):
    monkeypatch.delenv('ADMIN_PASSWORD', raising=False)
    call_command('ensure_admin')
    assert not User.objects.filter(email=_admin_email()).exists()


def test_bootstrap_creates_admin_and_loads_demo_only_when_configured(monkeypatch):
    monkeypatch.setenv('ADMIN_PASSWORD', 'tajne-haslo-admina')
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('bootstrap')
    assert User.objects.filter(email=_admin_email(), role=Role.ADMIN).exists()
    assert Pokestop.objects.count() == 0  # seed.demo_on_start: false w konfiguracji bazowej
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, seed=replace(settings.APP.seed, demo_on_start=True)))
    call_command('bootstrap')
    assert Pokestop.objects.count() > 0
