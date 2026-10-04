from datetime import datetime, timedelta

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import MemberRole, Organization, OrganizationMember, User, VerificationStatus
from apps.collection.models import Character, PokemonOrigin
from apps.collection.services import grant_pokemon, grant_starter
from apps.events.models import Event
from apps.game.models import PlayerProgress
from apps.pokestops.models import Pokestop, Update
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
                'position': {'lat': row['lat'], 'lng': row['lng']},  # dane demo powstają "na miejscu", w kółku autora
            }
            if row.get('questions'):
                payload['questions'] = row['questions']
            if author.pokemons.exists() and row['scenario'].startswith(('res-', 'idea-')):
                free = author.pokemons.filter(is_staked=False).first()
                if free is None:  # np. stara baza lokalna, w której autor zastawił już wszystkie pokemony
                    self.stdout.write(f'Pominięto "{row["title"]}": autor nie ma wolnego pokemona do zastawu')
                    continue
                payload['staked_pokemon_id'] = free.id
            stop = create_pokestop(author, payload, verify_location=False)
            if row.get('custom_fields'):
                stop.custom_fields = row['custom_fields']
                stop.save(update_fields=['custom_fields', 'updated_at'])
            for update in row.get('updates', []):
                Update.objects.create(pokestop=stop, author=author, title=update['title'], body=update.get('body', ''))
            created += 1
        events = self._events(data.get('events', []))
        self.stdout.write(f'Konta demo: {len(users)}, nowe pinezki: {created}, nowe wydarzenia: {events} (hasło kont z DEMO_PASSWORD)')

    def _events(self, rows: list[dict]) -> int:
        """Wydarzenia fundacji; czasy względem chwili ładowania (starts_in_hours), więc demo zawsze ma wydarzenie trwające i zapowiedziane."""
        created = 0
        for row in rows:
            org = Organization.objects.get(name=row['organization'])
            if Event.objects.filter(organization=org, title=row['title']).exists():
                continue
            starts = timezone.now() + timedelta(hours=row['starts_in_hours'])
            parse = lambda text: datetime.strptime(text, '%H:%M').time() if text else None  # noqa: E731
            Event.objects.create(
                organization=org, created_by=org.members.first().user, title=row['title'], description=row.get('description', ''),
                address=row.get('address'), lat=row['lat'], lng=row['lng'], starts_at=starts, ends_at=starts + timedelta(hours=row['duration_hours']),
                daily_from=parse(row.get('daily_from')), daily_to=parse(row.get('daily_to')), reward_character=Character.objects.get(code=row['reward']),
                capacity=row.get('capacity'), age_min=row.get('age_min'), age_max=row.get('age_max'),
            )
            created += 1
        return created

    def _user(self, row: dict, password: str) -> User:
        user = User.objects.filter(email=row['email']).first()
        if user:
            return user
        user = User.objects.create_user(row['email'], password, row['name'], role=row['role'])
        if row['role'] == 'resident':
            self._collection(user, row)
        if row['role'] == 'org':
            org = Organization.objects.create(**row['organization'], verification_status=VerificationStatus.VERIFIED, verified_at=timezone.now())
            OrganizationMember.objects.create(organization=org, user=user, member_role=MemberRole.OWNER)
        return user

    def _collection(self, user: User, row: dict) -> None:
        """Startowy pokemon, a dla kont "w połowie gry" także dodatkowe Spryciaki z exp i XP gracza (klucze `pokemons`, `xp`)."""
        starter = grant_starter(user)
        if row.get('starter_exp'):
            starter.exp = row['starter_exp']
            starter.save(update_fields=['exp'])
        for item in row.get('pokemons', []):
            pokemon = grant_pokemon(user, Character.objects.get(code=item['character']), PokemonOrigin.ENCOUNTER)
            pokemon.exp = item.get('exp', 0)
            pokemon.save(update_fields=['exp'])
        if row.get('xp'):
            PlayerProgress.objects.update_or_create(user=user, defaults={'xp': row['xp']})
