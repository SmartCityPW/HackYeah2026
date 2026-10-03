from dataclasses import replace

import pytest
from django.conf import settings
from rest_framework.test import APIClient

from apps.accounts.models import Organization, OrganizationMember, Role, User, VerificationStatus
from apps.collection.seed import load_reference
from apps.collection.services import grant_starter
from apps.scenarios.seed import load_scenarios

# Rynek w Krakowie i punkt ok. 11 m obok (w zasięgu interakcji) oraz ok. 1,1 km dalej (poza zasięgiem).
RYNEK = (50.0617, 19.9373)
NEAR = (50.0618, 19.9373)
FAR = (50.0717, 19.9373)


@pytest.fixture(scope='session')
def django_db_setup(django_db_setup, django_db_blocker):
    """Słowniki i scenariusze z prawdziwych plików seed, ładowane raz na sesję testową."""
    with django_db_blocker.unblock():
        seed_dir = settings.APP.path(settings.APP.seed.dir)
        load_reference(seed_dir / 'reference.yaml')
        load_scenarios(seed_dir / 'scenarios.yaml')


@pytest.fixture(autouse=True)
def stub_moderation_provider(monkeypatch):
    """Testy nie zależą od lokalnej konfiguracji dewelopera (np. `moderation.provider: gemini` w config/local.yaml)."""
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, moderation=replace(settings.APP.moderation, provider='stub')))


def client_for(user: User | None = None) -> APIClient:
    client = APIClient()
    if user is not None:
        client.force_authenticate(user)
    return client


@pytest.fixture
def anon():
    return client_for()


@pytest.fixture
def make_resident(db):
    counter = iter(range(1, 1000))

    def make(name: str | None = None) -> User:
        n = name or f'mieszkaniec{next(counter)}'
        user = User.objects.create_user(f'{n}@example.pl', 'haslo-testowe-1', n)
        grant_starter(user)
        return user

    return make


@pytest.fixture
def resident(make_resident):
    return make_resident('autor')


@pytest.fixture
def admin(db):
    return User.objects.create_user('admin@example.pl', 'haslo-testowe-1', 'Admin', role=Role.ADMIN)


@pytest.fixture
def make_org(db):
    counter = iter(range(1, 1000))

    def make(verified: bool = True) -> tuple[User, Organization]:
        n = next(counter)
        user = User.objects.create_user(f'org{n}@example.pl', 'haslo-testowe-1', f'Org {n}', role=Role.ORG)
        org = Organization.objects.create(name=f'Fundacja {n}', kind='foundation')
        if verified:
            from django.utils import timezone

            org.verification_status, org.verified_at = VerificationStatus.VERIFIED, timezone.now()
            org.save()
        OrganizationMember.objects.create(organization=org, user=user, member_role='owner')
        return user, org

    return make


def report_payload(user: User, **extra) -> dict:
    """Poprawne zgłoszenie problemu (scenariusz res-pothole) z zastawionym pokemonem startowym."""
    payload = {
        'scenarioCode': 'res-pothole', 'title': 'Dziura w chodniku', 'description': 'Głęboka dziura',
        'lat': RYNEK[0], 'lng': RYNEK[1], 'stakedPokemonId': user.pokemons.first().id,
    }
    payload.update(extra)
    return payload
