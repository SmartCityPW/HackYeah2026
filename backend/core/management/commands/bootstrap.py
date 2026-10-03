from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Uruchamiane przy starcie kontenera: migracje i (gdy seed.on_start) ładowanie słowników oraz scenariuszy.'

    def handle(self, *args, **options):
        call_command('migrate', interactive=False)
        if settings.APP.seed.on_start:
            call_command('seed_reference')
            call_command('seed_scenarios')
