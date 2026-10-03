from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        'Uruchamiane przy starcie kontenera: migracje, (gdy seed.on_start) słowniki i scenariusze, konto administratora IT '
        '(gdy ustawiono ADMIN_PASSWORD) oraz (gdy seed.demo_on_start) dane demo.'
    )

    def handle(self, *args, **options):
        call_command('migrate', interactive=False)
        if settings.APP.seed.on_start:
            call_command('seed_reference')
            call_command('seed_scenarios')
        call_command('ensure_admin')
        if settings.APP.seed.demo_on_start:
            call_command('seed_demo')
