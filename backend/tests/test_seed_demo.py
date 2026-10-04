import pytest
from dataclasses import replace

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import Organization, User
from apps.pokestops.models import Pokestop

pytestmark = pytest.mark.django_db


def test_demo_data_is_created_once_and_has_a_verified_org(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    users, pins = User.objects.count(), Pokestop.objects.count()
    assert pins == 6 and Organization.objects.get().is_verified
    assert Pokestop.objects.filter(type='ngo').count() == 1 and Pokestop.objects.filter(type='place').count() == 2
    call_command('seed_demo')  # drugi raz nic nie dubluje
    assert (User.objects.count(), Pokestop.objects.count()) == (users, pins)
    assert User.objects.get(email='admin@demo.smartcity.example').check_password('demo-haslo-1234')
    tester = User.objects.get(email='tester@demo.smartcity.example')  # konto "w połowie gry" do pokazu
    assert tester.pokemons.count() == 12 and tester.progress.xp == 640 and tester.pokemons.order_by('-exp').first().exp == 620


def test_demo_password_comes_from_the_environment_only(monkeypatch):
    monkeypatch.delenv('DEMO_PASSWORD', raising=False)
    with pytest.raises(ImproperlyConfigured, match='DEMO_PASSWORD'):
        call_command('seed_demo')


def test_demo_data_refuses_to_run_outside_debug(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, app=replace(settings.APP.app, debug=False)))
    with pytest.raises(CommandError, match='debug'):
        call_command('seed_demo')


def test_demo_initiative_has_a_timeline_custom_fields_and_a_survey(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    stop = Pokestop.objects.get(type='ngo')
    assert [f['label'] for f in stop.custom_fields] == ['Liczba drzew', 'Budżet']
    assert stop.updates.count() == 2 and stop.questions.count() == 3


def test_demo_has_a_running_and_an_upcoming_event_with_rare_rewards(monkeypatch):
    from apps.events import services
    from apps.events.models import Event

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    call_command('seed_demo')  # idempotentnie
    assert Event.objects.count() == 3
    picnic, cleanup, festival = Event.objects.order_by('starts_at', 'id')
    assert (picnic.reward_character.code, cleanup.reward_character.code, festival.reward_character.code) == ('gold_bike', 'shiny_bin', 'lantern')
    assert services.phase(picnic) == 'ongoing' and services.phase(festival) == 'upcoming'
    assert services.is_active_now(cleanup) and cleanup.daily_from is None  # zawsze do odebrania, niezależnie od pory dnia
    assert picnic.daily_from is not None and festival.capacity == 100
    assert all(e.reward_character.is_event_exclusive for e in Event.objects.all())
