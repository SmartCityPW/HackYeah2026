from django.core.management.base import BaseCommand

from core.contract.openapi import classify


class Command(BaseCommand):
    help = 'Pokazuje, które operacje z docs/openapi.yaml są zaimplementowane, które są atrapami (501), a których brakuje.'

    def handle(self, *args, **options):
        ops = classify()
        for status in ('implemented', 'stub', 'missing'):
            group = [o for o in ops if o.status == status]
            self.stdout.write(self.style.SUCCESS(f'\n{status.upper()} ({len(group)})') if status == 'implemented' else f'\n{status.upper()} ({len(group)})')
            for o in group:
                self.stdout.write(f'  {o.method:6} {o.path}')
        done = sum(o.status == 'implemented' for o in ops)
        self.stdout.write(f'\nZaimplementowano {done} z {len(ops)} operacji kontraktu.')
