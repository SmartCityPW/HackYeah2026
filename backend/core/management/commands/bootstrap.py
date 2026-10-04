from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        'Uruchamiane przy starcie kontenera: migracje, tabela pamięci podręcznej, (gdy seed.on_start) słowniki i scenariusze, konto administratora IT '
        '(gdy ustawiono ADMIN_PASSWORD) oraz (gdy seed.demo_on_start) dane demo oraz czyszczenie starego logu moderacji i zakończonych przeciwników.'
    )

    def handle(self, *args, **options):
        call_command('migrate', interactive=False)
        call_command('createcachetable')  # wspólna pamięć podręczna dla procesów gunicorna (limity żądań liczą się razem)
        if settings.APP.seed.on_start:
            call_command('seed_reference')
            call_command('seed_scenarios')
        call_command('moderation_prune_log')
        call_command('prune_encounters')
        call_command('ensure_admin')
        if settings.APP.seed.demo_on_start:
            call_command('seed_demo')
