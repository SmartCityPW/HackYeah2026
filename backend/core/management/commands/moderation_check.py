import time

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

from apps.moderation.agent import ModerationUnavailable, get_agent


class Command(BaseCommand):
    help = (
        'Wysyła przykładowe zgłoszenie do skonfigurowanego agenta moderującego (moderation.provider) i pokazuje werdykt. '
        'Do sprawdzenia klucza i modelu bez uruchamiania całej aplikacji. Klucza nie wypisuje.'
    )

    def add_arguments(self, parser):
        parser.add_argument('title', nargs='?', default='Zepsuta latarnia przy przystanku', help='tytuł zgłoszenia')
        parser.add_argument('--description', default='Wieczorem jest tu zupełnie ciemno.', help='opis zgłoszenia')

    def handle(self, *args, **options):
        cfg = settings.APP.moderation
        self.stdout.write(f'provider: {cfg.provider}' + (f', model: {cfg.gemini.model}' if cfg.provider == 'gemini' else ''))
        submission = {'scenario': 'res-lamp', 'title': options['title'], 'description': options['description'], 'details': {}}
        started = time.monotonic()
        try:
            review = get_agent().review(submission)
        except ModerationUnavailable as exc:
            raise CommandError(f'Agent niedostępny: {exc}') from exc
        ms = round((time.monotonic() - started) * 1000)
        verdict = self.style.SUCCESS('AKCEPTUJE') if review.approved else self.style.ERROR('ODRZUCA')
        self.stdout.write(f'werdykt: {verdict} ({review.model}, {ms} ms)')
