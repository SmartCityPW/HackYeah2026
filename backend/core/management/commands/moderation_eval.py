from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.moderation.agent import get_agent
from apps.moderation.evaluation import load_cases, run_cases, summarize


class Command(BaseCommand):
    help = (
        'Ocenia skonfigurowanego agenta moderującego na zestawie przypadków (domyślnie config/moderation_cases.yaml): '
        'poprawne zgłoszenia, niedozwolona treść i próby wstrzyknięcia instrukcji. Wymaga providera innego niż stub.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--cases', default=None, help='plik z przypadkami (domyślnie moderation.cases_file z YAML)')
        parser.add_argument('--delay', type=float, default=0, help='przerwa między zapytaniami w sekundach (limity darmowego planu)')

    def handle(self, *args, **options):
        cfg = settings.APP.moderation
        if cfg.provider == 'stub':
            raise CommandError('moderation.provider to "stub" (atrapa nie ocenia treści). Ustaw gemini albo http, patrz config/local.example.yaml.')
        path = Path(options['cases']) if options['cases'] else settings.APP.path(settings.APP.moderation.cases_file)
        cases = load_cases(path)
        model = cfg.gemini.model if cfg.provider == 'gemini' else cfg.http.model
        self.stdout.write(f'provider: {cfg.provider}' + (f', model: {model}' if model else '') + f', przypadków: {len(cases)}\n')

        def show(result):
            mark = self.style.SUCCESS('✔') if result.ok else self.style.ERROR('✘')
            line = f'{mark} {result.case.id:28} oczekiwano: {result.case.expect:8} jest: {result.verdict:8} {result.latency_ms:5} ms'
            self.stdout.write(line + (f'  ({result.error})' if result.error else ''))

        results = run_cases(get_agent(), cases, options['delay'], show)
        s = summarize(results)
        done, total = s['injection']
        self.stdout.write(f'\nZgodnych z oczekiwaniem: {s["ok"]} z {s["total"]}. Próby wstrzyknięcia odrzucone: {done} z {total}.')
        for label, key in (('Fałszywe odrzucenia (poprawne odrzucone)', 'false_rejections'), ('Fałszywe akceptacje (złe przepuszczone)', 'false_approvals'), ('Błędy agenta', 'errors')):
            if s[key]:
                self.stdout.write(self.style.ERROR(f'{label}: {", ".join(s[key])}'))
        if s['ok'] != s['total']:
            raise CommandError('Agent nie spełnia wszystkich oczekiwań.')
