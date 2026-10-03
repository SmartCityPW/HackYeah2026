import yaml
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.moderation.evaluation import EXPECTATIONS
from apps.pokestops.models import ModerationLog


class Command(BaseCommand):
    help = (
        'Dopisuje wpis z logu moderacji do zestawu regresyjnego agenta (moderation.cases_file): np. fałszywe odrzucenie '
        '(--expect approve) albo przepuszczony atak (--expect reject). Idempotentne: ten sam wpis nie dubluje się.'
    )

    def add_arguments(self, parser):
        parser.add_argument('log_id', type=int, help='id wpisu z GET /admin/moderation-log')
        parser.add_argument('--expect', required=True, choices=EXPECTATIONS, help='jak agent powinien ocenić tę treść')
        parser.add_argument('--category', default='from_log', help='kategoria do podsumowania oceny (np. injection, vulgar, ok)')

    def handle(self, *args, **options):
        entry = ModerationLog.objects.select_related('scenario').filter(pk=options['log_id']).first()
        if entry is None:
            raise CommandError(f'Nie ma wpisu logu o id {options["log_id"]} (mógł zostać usunięty po czasie przechowywania)')
        path = settings.APP.path(settings.APP.moderation.cases_file)
        case_id = f'log-{entry.id}'
        text = path.read_bytes().decode('utf-8')  # bez konwersji końców linii: plik może mieć CRLF
        if f'id: {case_id},' in text:
            self.stdout.write(f'Przypadek {case_id} już jest w {path.name}')
            return
        s = entry.submitted
        case = {'id': case_id, 'category': options['category'], 'expect': options['expect'], 'title': s.get('title', ''), 'description': s.get('description', '')}
        if s.get('details'):
            case['details'] = s['details']
        line = '  - ' + yaml.safe_dump(case, default_flow_style=True, allow_unicode=True, width=10_000, sort_keys=False).strip()
        newline = '\r\n' if '\r\n' in text else '\n'
        path.write_text(text.rstrip('\r\n') + newline + line + newline, encoding='utf-8', newline='')
        yaml.safe_load(path.read_text(encoding='utf-8'))  # plik musi pozostać poprawnym YAML-em
        self.stdout.write(self.style.SUCCESS(f'Dopisano {case_id} (expect: {options["expect"]}) do {path.name}'))
