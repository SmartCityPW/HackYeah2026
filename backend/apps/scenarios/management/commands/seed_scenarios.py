from django.conf import settings
from django.core.management.base import BaseCommand

from apps.scenarios.seed import load_scenarios


class Command(BaseCommand):
    help = 'Ładuje katalog scenariuszy z <seed.dir>/scenarios.yaml'

    def handle(self, *args, **options):
        path = settings.APP.path(settings.APP.seed.dir) / 'scenarios.yaml'
        self.stdout.write(f'Scenariusze z {path}: {load_scenarios(path)}')
