from django.core.management.base import BaseCommand

from apps.collection.catalog import generated_files, read_reference


class Command(BaseCommand):
    help = 'Generuje z config/seed/reference.yaml katalog postaci dla atrap frontendu i docs/db/seed_reference.sql'

    def handle(self, *args, **options):
        for path, content in generated_files(read_reference()).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8', newline='\n')
            self.stdout.write(f'Zapisano {path}')
