import yaml
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import MemberRole, Organization, OrganizationMember, User, VerificationStatus
from apps.collection.services import grant_starter
from apps.pokestops.models import Pokestop
from apps.pokestops.services import create_pokestop
from core.secrets import secret


class Command(BaseCommand):
    help = 'Dane demo (tylko tryb debug): konta, zweryfikowana organizacja i pinezki z <seed.dir>/demo.yaml. Idempotentne.'

    def handle(self, *args, **options):
        if not settings.APP.app.debug:
            raise CommandError('Dane demo można ładować tylko w trybie debug (app.debug: true)')
        password = secret('DEMO_PASSWORD')
        data = yaml.safe_load((settings.APP.path(settings.APP.seed.dir) / 'demo.yaml').read_text(encoding='utf-8'))

        users = {row['email']: self._user(row, password) for row in data['users']}
        created = 0
        for row in data['pokestops']:
            author = users[row['author']]
            if Pokestop.objects.filter(author=author, title=row['title']).exists():
                continue
            payload = {
                'scenario_code': row['scenario'], 'title': row['title'], 'description': row.get('description', ''),
                'lat': row['lat'], 'lng': row['lng'], 'details': row.get('details', {}), 'character': row.get('character'),
            }
            if author.pokemons.exists() and row['scenario'].startswith(('res-', 'idea-')):
                payload['staked_pokemon_id'] = author.pokemons.filter(is_staked=False).first().id
            create_pokestop(author, payload)
            created += 1
        self.stdout.write(f'Konta demo: {len(users)}, nowe pinezki: {created} (hasło kont z DEMO_PASSWORD)')

    def _user(self, row: dict, password: str) -> User:
        user = User.objects.filter(email=row['email']).first()
        if user:
            return user
        user = User.objects.create_user(row['email'], password, row['name'], role=row['role'])
        if row['role'] == 'resident':
            grant_starter(user)
        if row['role'] == 'org':
            org = Organization.objects.create(**row['organization'], verification_status=VerificationStatus.VERIFIED, verified_at=timezone.now())
            OrganizationMember.objects.create(organization=org, user=user, member_role=MemberRole.OWNER)
        return user
