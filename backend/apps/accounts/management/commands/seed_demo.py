from datetime import datetime, timedelta

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import MemberRole, Organization, OrganizationMember, User, VerificationStatus
from apps.collection.models import Character, Pokemon, PokemonOrigin
from apps.collection.services import grant_pokemon, grant_starter
from apps.events.models import Event
from apps.game.models import PlayerProgress
from apps.pokestops.models import Comment, Pokestop, Update, Vote
from apps.pokestops.services import create_pokestop, release_stake, set_status
from core.secrets import secret


class Command(BaseCommand):
    help = 'Dane demo (tylko tryb debug): konta, zweryfikowana organizacja i pinezki z <seed.dir>/demo.yaml. Idempotentne.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='Najpierw usuwa WSZYSTKIE pinezki (z głosami, komentarzami i ankietami) i zdejmuje zastawy pokemonów. Konta i wydarzenia zostają.')

    def handle(self, *args, **options):
        if not settings.APP.app.debug:
            raise CommandError('Dane demo można ładować tylko w trybie debug (app.debug: true)')
        password = secret('DEMO_PASSWORD')
        data = yaml.safe_load((settings.APP.path(settings.APP.seed.dir) / 'demo.yaml').read_text(encoding='utf-8'))
        if options['reset']:
            self._reset()

        users = {row['email']: self._user(row, password) for row in data['users']}
        admin = next((u for u in users.values() if u.role == 'admin'), None)
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
            if row['scenario'].startswith(('res-', 'idea-')):
                stake = self._stake(author, row)
                if stake is None:  # np. stara baza lokalna, w której autor zastawił już wszystkie pokemony
                    self.stdout.write(f'Pominięto "{row["title"]}": autor nie ma wolnego pokemona do zastawu')
                    continue
                payload['staked_pokemon_id'] = stake.id
            stop = create_pokestop(author, payload, verify_location=False, moderate=False)
            self._finish(stop, row, author, users, admin)
            created += 1
        events = self._events(data.get('events', []))
        self.stdout.write(f'Konta demo: {len(users)}, nowe pinezki: {created}, nowe wydarzenia: {events} (hasło kont z DEMO_PASSWORD)')

    def _reset(self) -> None:
        """Czyści pinezki demo: zastawy wracają do właścicieli, reszta (głosy, komentarze, ankiety) znika kaskadowo."""
        removed = Pokestop.objects.count()
        Pokemon.objects.filter(is_staked=True).update(is_staked=False)
        Pokestop.objects.all().delete()
        self.stdout.write(f'Usunięto pinezki: {removed}')

    def _stake(self, author: User, row: dict) -> Pokemon | None:
        """Pokemon do zastawu. Z kluczem `character` autor dostaje nowego Spryciaka tego gatunku (postać pinezki to gatunek zastawionego
        pokemona), a `exp` ustawia jego poziom. Bez `character` zastawiamy pierwszego wolnego."""
        if row.get('character'):
            pokemon = grant_pokemon(author, Character.objects.get(code=row['character']), PokemonOrigin.ENCOUNTER)
            if row.get('exp'):
                pokemon.exp = row['exp']
                pokemon.save(update_fields=['exp'])
            return pokemon
        return author.pokemons.filter(is_staked=False).first()

    def _finish(self, stop: Pokestop, row: dict, author: User, users: dict[str, User], admin: User | None) -> None:
        """Dopełnia pinezkę danymi z wiersza: pola własne, oś czasu, wiek, głosy, komentarze i status."""
        if row.get('custom_fields'):
            stop.custom_fields = row['custom_fields']
            stop.save(update_fields=['custom_fields', 'updated_at'])
        for update in row.get('updates', []):
            Update.objects.create(pokestop=stop, author=author, title=update['title'], body=update.get('body', ''))
        if row.get('days_ago'):
            Pokestop.objects.filter(pk=stop.pk).update(created_at=timezone.now() - timedelta(days=row['days_ago']))
        # Liczniki głosów to dane demo ("zmyślone" poparcie); prawdziwe głosy konkretnych kont (`votes_by`) dochodzą do nich.
        votes_for, votes_against = row.get('votes', (0, 0))
        Pokestop.objects.filter(pk=stop.pk).update(votes_for=votes_for, votes_against=votes_against)
        for email, value in (row.get('votes_by') or {}).items():
            voter = users[email]
            pokemon = voter.pokemons.first()
            Vote.objects.create(pokestop=stop, user=voter, vote=value, rewarded_pokemon=pokemon, exp_granted=0, lat=stop.lat, lng=stop.lng, distance_m=10)
            Pokestop.objects.filter(pk=stop.pk).update(**{'votes_for' if value == 'for' else 'votes_against': F('votes_for' if value == 'for' else 'votes_against') + 1})
        stop.refresh_from_db()
        if stop.staked_pokemon_id and stop.votes_for >= stop.votes_required:  # próg poparcia osiągnięty: zastaw wraca z premią
            release_stake(stop, settings.APP.game.exp.stake_release_bonus)
        for item in row.get('comments', []):
            parent = Comment.objects.create(pokestop=stop, author=users[item['author']], body=item['text'])
            for reply in item.get('replies', []):
                Comment.objects.create(pokestop=stop, author=users[reply['author']], parent=parent, body=reply['text'])
        if row.get('status') and admin is not None:
            set_status(admin, stop.pk, row['status'], row.get('status_note'))

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
