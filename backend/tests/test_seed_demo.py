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
    assert pins == 53 and Organization.objects.count() == 4 and all(o.is_verified for o in Organization.objects.all())
    assert Pokestop.objects.filter(type='consultation').count() == 14 and Pokestop.objects.filter(type='place').count() == 1
    call_command('seed_demo')  # drugi raz nic nie dubluje
    assert (User.objects.count(), Pokestop.objects.count()) == (users, pins)
    assert User.objects.get(email='admin@demo.smartcity.example').check_password('demo-haslo-1234')
    tester = User.objects.get(email='tester@demo.smartcity.example')  # konto "w połowie gry" do pokazu
    assert tester.pokemons.count() == 12 + tester.pokestops.count()  # + pokemony zastawione pod jej własne zgłoszenia
    assert tester.progress.xp == 640 and tester.pokemons.order_by('-exp').first().exp == 620 + 10 * tester.votes.count()  # + exp za jej głosy


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


def test_demo_support_comes_from_real_votes_not_counters(monkeypatch):
    from django.db import models
    from django.db.models import Count, Q

    from apps.pokestops.models import Vote

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    stops = Pokestop.objects.annotate(
        real_for=Count('votes', filter=Q(votes__vote='for')), real_against=Count('votes', filter=Q(votes__vote='against')),
    )
    assert all((s.votes_for, s.votes_against) == (s.real_for, s.real_against) for s in stops)  # liczniki = wiersze głosów
    assert Vote.objects.count() == sum(s.votes_for + s.votes_against for s in stops) > 1000
    assert all(v.rewarded_pokemon.user_id == v.user_id and v.exp_granted == 10 for v in Vote.objects.select_related('rewarded_pokemon')[:50])
    assert any(s.votes_against > s.votes_for for s in stops) and any(s.votes_for >= 50 for s in stops)
    own = Vote.objects.filter(user=models.F('pokestop__author'))
    assert not own.exists()  # nikt nie głosuje na własną pinezkę
    assert len({s.staked_pokemon.exp // 100 for s in stops if s.staked_pokemon_id} | {0}) >= 3  # różne poziomy zastawionych Spryciaków
    assert Pokestop.objects.filter(status__in=['in_progress', 'resolved']).count() >= 3
    plan = Pokestop.objects.get(title__startswith='Zmiana Planu Adaptacji')
    assert (plan.votes_for, plan.votes_against) == (1, 0) and plan.status == 'resolved'


def test_demo_consultations_have_real_survey_answers(monkeypatch):
    from apps.pokestops.models import SurveyAnswer, SurveyResponse

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    counts = {s.title[:20]: s.survey_responses.count() for s in Pokestop.objects.filter(type='consultation')}
    assert min(counts.values()) == 1 and sum(counts.values()) == 1 + 40 + 30 + 38 + 28 + 32 + 30 + 36 + 40 + 33 + 29 + 26 + 31 + 34  # Plan Adaptacji: jeden uczestnik
    assert SurveyAnswer.objects.count() > 150
    assert all(r.reward_pokemon.user_id == r.user_id for r in SurveyResponse.objects.select_related('reward_pokemon')[:20])  # nagroda jak w grze
    plaszow = Pokestop.objects.get(title__startswith='Konsultacje: Płaszów')
    vision = {a.value for a in SurveyAnswer.objects.filter(response__pokestop=plaszow, question__question_key='vision')}
    assert vision == {'industrial', 'residential', 'mixed'}  # wyniki ankiety nie są puste ani jednolite


def test_demo_texts_pass_the_moderation_rules(monkeypatch):
    from apps.moderation.rules import inspect_text
    from apps.pokestops.models import Comment

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    texts = [t for s in Pokestop.objects.all() for t in (s.title, s.description)] + list(Comment.objects.values_list('body', flat=True))
    assert [t for t in texts if inspect_text(t)] == []


def test_reset_replaces_existing_pins_and_frees_stakes(monkeypatch):
    from apps.collection.models import Pokemon

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    assert Pokestop.objects.exclude(staked_pokemon=None).filter(stake_released_at=None).exists()  # świeże zgłoszenia z niewielkim poparciem trzymają zastaw
    Pokestop.objects.filter(title__startswith='Dziury w chodniku').update(title='Stara pinezka')  # zmieniony tytuł: bez resetu powstałby duplikat
    call_command('seed_demo', '--reset')
    assert Pokestop.objects.count() == 53 and not Pokestop.objects.filter(title='Stara pinezka').exists()
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


def test_demo_resident_pins_go_through_moderation_like_in_the_game(monkeypatch):
    from apps.pokestops.models import ModerationLog

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    residents = Pokestop.objects.filter(type__in=['report', 'idea', 'place']).count()
    assert ModerationLog.objects.filter(verdict='approved', pokestop__isnull=False).count() == residents  # każde zgłoszenie ma werdykt w logu
    assert not ModerationLog.objects.filter(pokestop__type='consultation').exists()  # inicjatywy organizacji nie są moderowane (jak w grze)


def test_skip_moderation_flag_bypasses_the_agent(monkeypatch):
    from apps.pokestops.models import ModerationLog

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo', '--skip-moderation')
    assert Pokestop.objects.count() == 53 and not ModerationLog.objects.exists()


def test_a_pin_rejected_by_moderation_is_not_created_and_leaves_no_stray_pokemon(monkeypatch):
    from apps.collection.models import Pokemon
    from apps.moderation.agent import Review
    from apps.pokestops import services
    from apps.pokestops.models import ModerationLog

    class RejectSzewska:
        def review(self, submission):
            return Review(approved='Szewska' not in submission['title'], model='test', reason='nie na temat')

    monkeypatch.setattr(services, 'get_agent', lambda: RejectSzewska())
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    assert Pokestop.objects.count() == 52 and not Pokestop.objects.filter(title__contains='Szewska').exists()
    assert ModerationLog.objects.filter(verdict='rejected').count() == 1
    author = User.objects.get(email='janusz@demo.smartcity.example')
    assert not Pokemon.objects.filter(user=author, character__code='sports_car').exists()  # Spryciak nadany pod odrzucony zastaw znika


def test_unavailable_moderation_stops_the_seed_with_a_clear_message(monkeypatch):
    from apps.moderation.agent import ModerationUnavailable
    from apps.pokestops import services

    class Down:
        def review(self, submission):
            raise ModerationUnavailable('AI_API_KEY nie jest ustawiony')

    sleeps = []
    monkeypatch.setattr(services, 'get_agent', lambda: Down())
    monkeypatch.setattr('apps.accounts.management.commands.seed_demo.time.sleep', sleeps.append)
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    with pytest.raises(CommandError, match='AI_API_KEY'):
        call_command('seed_demo')
    assert len(sleeps) == 3  # trzy ponowienia, potem czytelny błąd


def test_a_rate_limited_agent_is_retried_and_the_pin_is_created(monkeypatch):
    from apps.moderation.agent import ModerationUnavailable, Review
    from apps.pokestops import services

    class Flaky:
        calls = 0

        def review(self, submission):
            Flaky.calls += 1
            if Flaky.calls == 3:  # jedno zapytanie dostaje "429", kolejne próby przechodzą
                raise ModerationUnavailable('Agent odpowiedział błędem HTTP 429')
            return Review(approved=True, model='test')

    sleeps = []
    monkeypatch.setattr(services, 'get_agent', lambda: Flaky())
    monkeypatch.setattr('apps.accounts.management.commands.seed_demo.time.sleep', sleeps.append)
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    assert Pokestop.objects.count() == 53 and sleeps.count(30.0) == 1


def test_network_agents_get_a_pause_between_requests_and_the_stub_does_not(monkeypatch):
    from dataclasses import replace

    from apps.moderation.agent import Review
    from apps.pokestops import services

    class Ok:
        def review(self, submission):
            return Review(approved=True, model='test')

    sleeps = []
    monkeypatch.setattr(services, 'get_agent', lambda: Ok())
    monkeypatch.setattr('apps.accounts.management.commands.seed_demo.time.sleep', sleeps.append)
    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')  # conftest ustawia provider stub: bez przerw
    assert sleeps == []
    Pokestop.objects.all().delete()
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=replace(settings.APP.moderation, provider='gemini')))
    call_command('seed_demo')
    assert len(sleeps) == 39 and set(sleeps) == {5.0}  # po każdym zgłoszeniu mieszkańca


def test_demo_has_many_consultations_and_one_within_reach_near_tauron_arena(monkeypatch):
    from core.geo import distance_m

    monkeypatch.setenv('DEMO_PASSWORD', 'demo-haslo-1234')
    call_command('seed_demo')
    consultations = Pokestop.objects.filter(type='consultation')
    assert consultations.count() >= 10 and {c.organization.name for c in consultations} >= {'Urząd Miasta Krakowa', 'Rada Dzielnicy XIV Czyżyny', 'Rada Dzielnicy XIII Podgórze'}
    assert all(c.questions.exists() and c.survey_responses.exists() and c.votes_for + c.votes_against > 0 for c in consultations)
    arena = settings.APP.game.interaction_range_m, 50.0676, 19.9917  # domyślna pozycja z prezentacji (?gps=50.0676,19.9917)
    near = [c for c in consultations if distance_m(arena[1], arena[2], c.lat, c.lng) <= arena[0] - 10]
    assert [c.title for c in near] == ['Konsultacje: parkowanie i ruch wokół Tauron Areny w dni wydarzeń']  # w zasięgu głosu i ankiety, z zapasem 10 m
