from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.pokestops.models import ModerationLog


class Command(BaseCommand):
    help = (
        'Usuwa wpisy logu moderacji starsze niż moderation.log_retention_days (YAML). Log zawiera treść zgłoszeń, także odrzuconych, '
        'więc nie trzymamy go bez końca. Pinezki i ich treść nie są ruszane.'
    )

    def handle(self, *args, **options):
        days = settings.APP.moderation.log_retention_days
        deleted, _ = ModerationLog.objects.filter(created_at__lt=timezone.now() - timedelta(days=days)).delete()
        self.stdout.write(f'Log moderacji: usunięto {deleted} wpisów starszych niż {days} dni')
