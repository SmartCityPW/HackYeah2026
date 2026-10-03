import pytest

from apps.accounts.models import Organization, User, VerificationStatus
from apps.collection.models import Pokemon
from tests.conftest import client_for

pytestmark = pytest.mark.django_db


def test_guest_gets_tokens_and_starter_pokemon(anon):
    r = anon.post('/api/v1/auth/guest')
    assert r.status_code == 201 and set(r.data) == {'access', 'refresh'}
    user = User.objects.get(is_guest=True)
    assert Pokemon.objects.filter(user=user, origin='starter').count() == 1

    me = anon.get('/api/v1/me', HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    assert me.status_code == 200 and me.data['isGuest'] is True and me.data['role'] == 'resident'


def test_register_login_refresh_flow(anon):
    body = {'email': 'Ala@Example.pl', 'password': 'dlugie-haslo-1', 'displayName': 'Ala'}
    assert anon.post('/api/v1/auth/register', body, format='json').status_code == 201
    assert User.objects.get(email='ala@example.pl').display_name == 'Ala'  # e-mail znormalizowany do małych liter

    login = anon.post('/api/v1/auth/login', body, format='json')
    assert login.status_code == 200
    refreshed = anon.post('/api/v1/auth/refresh', {'refresh': login.data['refresh']}, format='json')
    assert refreshed.status_code == 200 and refreshed.data['access']


def test_duplicate_email_is_conflict_and_short_password_is_422(anon):
    body = {'email': 'a@example.pl', 'password': 'dlugie-haslo-1'}
    anon.post('/api/v1/auth/register', body, format='json')
    dup = anon.post('/api/v1/auth/register', body, format='json')
    assert dup.status_code == 409 and dup.data['code'] == 'email_taken'
    short = anon.post('/api/v1/auth/register', {'email': 'b@example.pl', 'password': 'x'}, format='json')
    assert short.status_code == 422 and short.data['code'] == 'validation_error' and 'password' in short.data['fields']


def test_wrong_password_is_401_with_error_shape(anon):
    anon.post('/api/v1/auth/register', {'email': 'a@example.pl', 'password': 'dlugie-haslo-1'}, format='json')
    r = anon.post('/api/v1/auth/login', {'email': 'a@example.pl', 'password': 'zle-haslo-xxx'}, format='json')
    assert r.status_code == 401 and r.data['code'] == 'invalid_credentials'


def test_requests_without_token_are_401(anon):
    r = anon.get('/api/v1/me')
    assert r.status_code == 401 and r.data['code'] == 'unauthorized'


def test_guest_upgrade_keeps_progress(anon):
    tokens = anon.post('/api/v1/auth/guest').data
    user = User.objects.get(is_guest=True)
    pokemon_id = user.pokemons.get().id
    r = anon.post('/api/v1/auth/upgrade', {'email': 'zapis@example.pl', 'password': 'dlugie-haslo-1'}, format='json',
                  HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert r.status_code == 200 and r.data['isGuest'] is False
    assert user.pokemons.get().id == pokemon_id
    again = anon.post('/api/v1/auth/upgrade', {'email': 'inny@example.pl', 'password': 'dlugie-haslo-1'}, format='json',
                      HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert again.status_code == 409 and again.data['code'] == 'already_registered'


def test_organization_registration_is_pending_until_admin_verifies(anon, admin):
    body = {'email': 'fundacja@example.pl', 'password': 'dlugie-haslo-1',
            'organization': {'name': 'Fundacja Testowa', 'kind': 'foundation', 'contactPerson': 'Anna'}}
    tokens = anon.post('/api/v1/auth/register-organization', body, format='json')
    assert tokens.status_code == 201
    org = Organization.objects.get(name='Fundacja Testowa')
    assert org.verification_status == VerificationStatus.PENDING

    me = anon.get('/api/v1/me', HTTP_AUTHORIZATION=f"Bearer {tokens.data['access']}")
    assert me.data['role'] == 'org' and me.data['organization']['verificationStatus'] == 'pending'

    admin_client = client_for(admin)
    assert admin_client.patch(f'/api/v1/admin/organizations/{org.id}', {'verificationStatus': 'verified'}, format='json').status_code == 200
    org.refresh_from_db()
    assert org.is_verified and org.verified_at and org.verified_by_id == admin.id


def test_admin_endpoints_reject_residents(resident):
    assert client_for(resident).get('/api/v1/admin/organizations').status_code == 403


def test_public_organization_profile_hides_contact_data(resident, make_org):
    _, org = make_org()
    r = client_for(resident).get(f'/api/v1/organizations/{org.id}')
    assert r.status_code == 200 and r.data['verified'] is True
    assert 'contactEmail' not in r.data and 'krs' not in r.data
