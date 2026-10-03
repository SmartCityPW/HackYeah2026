from django.conf import settings

from apps.game.models import PlayerProgress


def progress_payload(user) -> dict:
    """Poziom wyliczany z xp wzorem z konfiguracji (xp_per_player_level), baza trzyma tylko xp."""
    per_level = settings.APP.game.levels.xp_per_player_level
    xp = PlayerProgress.objects.filter(user=user).values_list('xp', flat=True).first() or 0
    return {'level': 1 + xp // per_level, 'xp': xp, 'xpIntoLevel': xp % per_level, 'xpForNextLevel': per_level}
