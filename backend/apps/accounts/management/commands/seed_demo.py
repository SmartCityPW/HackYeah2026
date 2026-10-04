import random
from datetime import datetime, timedelta

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import MemberRole, Organization, OrganizationMember, User, VerificationStatus
from apps.collection.models import Character, Pokemon, PokemonOrigin
from apps.collection.services import grant_pokemon, grant_starter
from apps.events.models import Event
from apps.game.location import Fix
from apps.game.models import PlayerProgress
from apps.pokestops import survey
from apps.pokestops.models import Pokestop, Update
from apps.pokestops.services import add_comment, create_pokestop, set_status, vote
from core.secrets import secret


# Pula głosujących mieszkańców: ich głosy i odpowiedzi w ankietach przechodzą przez te same funkcje co w grze, więc poparcie pinezek
# wynika z wierszy w bazie, a nie z wpisanych liczników.
VOTER_FIRST_NAMES = ['Anna', 'Piotr', 'Kasia', 'Marek', 'Ewa', 'Tomasz', 'Magda', 'Jan', 'Ola', 'Paweł', 'Basia', 'Michał', 'Agata', 'Krzysztof', 'Julia',
                     'Adam', 'Zofia', 'Łukasz', 'Marta', 'Grzegorz', 'Natalia', 'Rafał', 'Iga', 'Bartek', 'Dorota']
VOTER_INITIALS = ['K.', 'W.', 'N.', 'Z.', 'S.', 'M.', 'L.', 'P.', 'D.', 'B.', 'G.', 'J.', 'R.', 'T.', 'C.', 'H.']
QUESTION_FIELDS = ('key', 'label', 'type', 'required', 'options', 'min', 'max')  # reszta kluczy pytania w pliku steruje losowaniem odpowiedzi


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
        voters = self._voters(data.get('voters', {}).get('count', 0))
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
                payload['questions'] = [{k: v for k, v in q.items() if k in QUESTION_FIELDS} for q in row['questions']]
            if row['scenario'].startswith(('res-', 'idea-')):
                stake = self._stake(author, row)
                if stake is None:  # np. stara baza lokalna, w której autor zastawił już wszystkie pokemony
                    self.stdout.write(f'Pominięto "{row["title"]}": autor nie ma wolnego pokemona do zastawu')
                    continue
                payload['staked_pokemon_id'] = stake.id
            stop = create_pokestop(author, payload, verify_location=False, moderate=False)
            self._finish(stop, row, author, users, admin, voters)
            created += 1
        events = self._events(data.get('events', []))
        self.stdout.write(f'Konta demo: {len(users)}, nowe pinezki: {created}, nowe wydarzenia: {events} (hasło kont z DEMO_PASSWORD)')

    def _reset(self) -> None:
        """Czyści dane pinezek demo: pinezki (głosy, komentarze i ankiety znikają kaskadowo), konta głosujących i Spryciaki, które konta demo
        dostały tylko po to, żeby je zastawić. Prawdziwe konta i ich Spryciaki zostają."""
        demo = User.objects.filter(email__endswith='@demo.smartcity.example')
        granted = list(Pokemon.objects.filter(
            user__in=demo, origin=PokemonOrigin.ENCOUNTER, pk__in=Pokestop.objects.exclude(staked_pokemon=None).values('staked_pokemon_id'),
        ).values_list('pk', flat=True))
        removed = Pokestop.objects.count()
        Pokemon.objects.filter(is_staked=True).update(is_staked=False)
        Pokestop.objects.all().delete()
        Pokemon.objects.filter(pk__in=granted).delete()
        voters, _ = User.objects.filter(email__startswith='mieszkaniec', email__endswith='@demo.smartcity.example').delete()
        self.stdout.write(f'Usunięto pinezki: {removed}, zastawione Spryciaki: {len(granted)}, rekordy głosujących: {voters}')

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

    def _voters(self, count: int) -> list[User]:
        """Pula głosujących (konta bez hasła, każde z Spryciakiem startowym). Idempotentna: istniejące konta są używane ponownie."""
        voters = []
        for n in range(1, count + 1):
            email = f'mieszkaniec{n:03d}@demo.smartcity.example'
            user = User.objects.filter(email=email).first()
            if user is None:
                name = f'{VOTER_FIRST_NAMES[n % len(VOTER_FIRST_NAMES)]} {VOTER_INITIALS[(n * 7) % len(VOTER_INITIALS)]}'
                user = User.objects.create_user(email, None, name, role='resident')  # hasło None = konto bez możliwości logowania
                grant_starter(user)
            voters.append(user)
        return voters

    def _finish(self, stop: Pokestop, row: dict, author: User, users: dict[str, User], admin: User | None, voters: list[User]) -> None:
        """Dopełnia pinezkę: pola własne, oś czasu, wiek, głosy, odpowiedzi ankiety, komentarze i status (głosy, ankiety, komentarze i status
        przechodzą przez te same funkcje co w grze: exp za głos, zwrot zastawu po progu, walidacja odpowiedzi, reguły komentarzy)."""
        if row.get('custom_fields'):
            stop.custom_fields = row['custom_fields']
            stop.save(update_fields=['custom_fields', 'updated_at'])
        for update in row.get('updates', []):
            Update.objects.create(pokestop=stop, author=author, title=update['title'], body=update.get('body', ''))
        if row.get('days_ago'):  # jedyny skrót: nie da się utworzyć pinezki w przeszłości, więc postarzamy ją
            Pokestop.objects.filter(pk=stop.pk).update(created_at=timezone.now() - timedelta(days=row['days_ago']))
        self._cast_votes(stop, row, users, voters)
        self._answer_surveys(stop, row, voters)
        for item in row.get('comments', []):
            parent = add_comment(users[item['author']], stop.pk, item['text'], None)
            for reply in item.get('replies', []):
                add_comment(users[reply['author']], stop.pk, reply['text'], parent.pk)
        if row.get('status') and admin is not None:
            set_status(admin, stop.pk, row['status'], row.get('status_note'))

    def _cast_votes(self, stop: Pokestop, row: dict, users: dict[str, User], voters: list[User]) -> None:
        """`votes_by` to głosy wskazanych kont, `votes: [za, przeciw]` to docelowa liczba głosów łącznie (resztę dokładają losowi głosujący z puli,
        deterministycznie: ten sam plik daje ten sam wynik)."""
        explicit = {users[email]: value for email, value in (row.get('votes_by') or {}).items()}
        want_for, want_against = row.get('votes', (0, 0))
        need = {'for': want_for - sum(v == 'for' for v in explicit.values()), 'against': want_against - sum(v == 'against' for v in explicit.values())}
        pool = [v for v in voters if v.pk != stop.author_id and v not in explicit]
        random.Random(f'votes:{row["title"]}').shuffle(pool)
        if max(need['for'], 0) + max(need['against'], 0) > len(pool):
            raise CommandError(f'Pinezka "{row["title"]}" chce {want_for + want_against} głosów, a pula ma {len(pool)} głosujących (voters.count w demo.yaml)')
        queue = list(explicit.items()) + [(v, 'for') for v in pool[:max(need['for'], 0)]] + [(v, 'against') for v in pool[max(need['for'], 0):max(need['for'], 0) + max(need['against'], 0)]]
        for voter, value in queue:
            pokemon = voter.pokemons.first()
            vote(user=voter, pokestop_id=stop.pk, value=value, pokemon_id=pokemon.pk, fix=Fix(lat=stop.lat, lng=stop.lng), verify_location=False)

    def _answer_surveys(self, stop: Pokestop, row: dict, voters: list[User]) -> None:
        """`survey_responses: N`: N losowych mieszkańców wypełnia ankietę (odpowiedzi losowane wg `weights`, `yes`, `samples` z pytań w pliku)."""
        count = row.get('survey_responses', 0)
        if not count:
            return
        rng = random.Random(f'survey:{row["title"]}')
        respondents = rng.sample(voters, count)
        for voter in respondents:
            answers = {}
            for q in row['questions']:
                if not q.get('required', True) and rng.random() < 0.5:
                    continue
                answers[q['key']] = self._answer(q, rng)
            survey.answer_survey(user=voter, pokestop_id=stop.pk, fix=Fix(lat=stop.lat, lng=stop.lng), answers=answers, verify_location=False)

    @staticmethod
    def _answer(q: dict, rng: random.Random):
        kind, values = q['type'], [o['value'] for o in q.get('options', [])]
        if kind == 'boolean':
            return rng.random() < q.get('yes', 0.6)
        if kind in ('choice', 'select'):
            return rng.choices(values, weights=q.get('weights'))[0]
        if kind == 'multiselect':
            return [v for v in values if rng.random() < 0.45] or [values[0]]
        if kind == 'rating':
            return rng.randint(int(q.get('min') or 1), int(q.get('max') or 5))
        if kind == 'number':
            return rng.randint(int(q.get('min') or 0), int(q.get('max') or 10))
        return rng.choice(q.get('samples') or ['Bez uwag.'])

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
