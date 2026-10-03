from django.conf import settings
from django.core.management.base import BaseCommand

from apps.collection.seed import load_reference


class Command(BaseCommand):
    help = 'Ładuje słowniki gry (typy, postacie, przeciwnicy) z <seed.dir>/reference.yaml'

    def handle(self, *args, **options):
        path = settings.APP.path(settings.APP.seed.dir) / 'reference.yaml'
        self.stdout.write(f'Słowniki z {path}: {load_reference(path)}')
