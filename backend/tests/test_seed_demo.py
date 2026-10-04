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
    assert pins == 42 and Organization.objects.count() == 2 and all(o.is_verified for o in Organization.objects.all())
    assert Pokestop.objects.filter(type='consultation').count() == 3 and Pokestop.objects.filter(type='place').count() == 1
    call_command('seed_demo')  # drugi raz nic nie dubluje
    assert (User.objects.count(), Pokestop.objects.count()) == (users, pins)
    assert User.objects.get(email='admin@demo.smartcity.example').check_password('demo-haslo-1234')
    tester = User.objects.get(email='tester@demo.smartcity.example')  # konto "w połowie gry" do pokazu
    assert tester.pokemons.count() == 12 + tester.pokestops.count()  # + pokemony zastawione pod jej własne zgłoszenia
    assert tester.progress.xp == 640 and tester.pokemons.order_by('-exp').first().exp == 620


def test_demo_password_comes_from_the_environment_only(monkeypatch):
    monkeypatch.delenv('DEMO_PASSWORD', raising=False)
    with pytest.raises(ImproperlyConfigured, match='DEMO_PASSWORD'):
        call_command('seed_demo')


def test_demo_data_refuses_to_run_outside_debug(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, app=replace(settings.APP.app, debug=False)))
    with pytest.raises(CommandError, match='debug'):
        call_command('seed_demo')


def test_demo_consultation_has_a_timeline_custom_fields_and_a_survey(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    stop = Pokestop.objects.get(title__startswith='Konsultacje: Płaszów')
    assert [f['label'] for f in stop.custom_fields] == ['Obszar', 'Planowany horyzont']
    assert stop.updates.count() == 1 and stop.questions.count() == 3 and stop.organization.name == 'Urząd Miasta Krakowa'


def test_demo_pins_are_spread_over_krakow_with_varied_characters(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    stops = list(Pokestop.objects.all())
    assert all(49.9 < s.lat < 50.15 and 19.7 < s.lng < 20.25 for s in stops)  # Kraków i najbliższa okolica
    # nie skupiają się w jednym miejscu: punkty "gdzieś na ulicach" dzielą co najmniej kilka różnych dzielnic (kwadraty ok. 2 km)
    assert len({(round(s.lat * 50), round(s.lng * 30)) for s in stops}) >= 20
    assert len({s.character.code for s in stops if s.type in ('report', 'idea', 'place')}) >= 12  # różne modele 3D, nie same rowery
    assert len({s.author_id for s in stops}) >= 15


def test_demo_votes_levels_and_balance_are_varied(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    stops = Pokestop.objects.all()
    assert any(s.votes_against > s.votes_for for s in stops) and any(s.votes_for >= 100 for s in stops)
    assert len({s.staked_pokemon.exp // 100 for s in stops if s.staked_pokemon_id} | {0}) >= 4  # różne poziomy zastawionych Spryciaków
    assert Pokestop.objects.filter(status__in=['in_progress', 'resolved']).count() >= 3
    plan = Pokestop.objects.get(title__startswith='Zmiana Planu Adaptacji')
    assert (plan.votes_for, plan.votes_against) == (1, 0) and plan.status == 'resolved'


def test_reset_replaces_existing_pins_and_frees_stakes(monkeypatch):
    from apps.collection.models import Pokemon

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    assert Pokestop.objects.exclude(staked_pokemon=None).filter(stake_released_at=None).exists()  # świeże zgłoszenia z niewielkim poparciem trzymają zastaw
    Pokestop.objects.filter(title__startswith='Dziury w chodniku').update(title='Stara pinezka')  # zmieniony tytuł: bez resetu powstałby duplikat
    call_command('seed_demo', '--reset')
    assert Pokestop.objects.count() == 42 and not Pokestop.objects.filter(title='Stara pinezka').exists()
    staked = Pokemon.objects.filter(is_staked=True).count()
    assert staked == Pokestop.objects.exclude(staked_pokemon=None).filter(stake_released_at=None).count()  # zastawy tylko pod istniejące pinezki


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
