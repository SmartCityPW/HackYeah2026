from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.game.models import Encounter, EncounterCell, EncounterStatus


class Command(BaseCommand):
    help = (
        'Usuwa zakończonych (pokonanych albo wygasłych) przeciwników starszych niż game.encounters.retention_hours, o ile nie ma po nich śladu walki '
        '(próby walki zostają jako historia i podstawa limitów), oraz puste, nieaktualne kwadraty graczy. Każdy gracz ma własnych przeciwników, '
        'więc bez czyszczenia tabela rosłaby bez końca.'
    )

    def handle(self, *args, **options):
        hours = settings.APP.game.encounters.retention_hours
        cutoff = timezone.now() - timedelta(hours=hours)
        encounters, _ = (
            Encounter.objects.filter(expires_at__lt=cutoff, attacks__isnull=True).exclude(status=EncounterStatus.ACTIVE).delete()
        )
        stale_active, _ = Encounter.objects.filter(status=EncounterStatus.ACTIVE, expires_at__lt=cutoff, attacks__isnull=True).delete()
        cells, _ = EncounterCell.objects.filter(encounters__isnull=True).filter(populated_at__lt=cutoff).delete()
        self.stdout.write(f'Przeciwnicy: usunięto {encounters + stale_active} wpisów i {cells} pustych kwadratów starszych niż {hours} h')
