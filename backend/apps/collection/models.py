from django.conf import settings
from django.db import models
from django.db.models import Q


class PokemonType(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=60)
    emoji = models.CharField(max_length=8)

    class Meta:
        db_table = 'collection_type'


class Character(models.Model):
    code = models.CharField(max_length=32, unique=True)
    label = models.CharField(max_length=60)
    emoji = models.CharField(max_length=8)
    category_label = models.CharField(max_length=60)
    model_path = models.CharField(max_length=255, null=True, blank=True)
    type = models.ForeignKey(PokemonType, on_delete=models.PROTECT, related_name='characters')
    base_power = models.SmallIntegerField()
    power_growth = models.SmallIntegerField(default=5)
    is_starter = models.BooleanField(default=False)
    is_event_exclusive = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'collection_character'
        constraints = [
            models.CheckConstraint(condition=Q(base_power__gt=0), name='character_base_power_positive'),
            models.CheckConstraint(condition=Q(power_growth__gt=0), name='character_power_growth_positive'),
            models.CheckConstraint(condition=~(Q(is_starter=True) & Q(is_event_exclusive=True)), name='character_starter_not_exclusive'),
            models.UniqueConstraint(fields=['is_starter'], condition=Q(is_starter=True), name='collection_character_one_starter_species'),
        ]


class PokemonOrigin(models.TextChoices):
    STARTER = 'starter'
    ENCOUNTER = 'encounter'
    SURVEY = 'survey'
    EVENT = 'event'


class Pokemon(models.Model):
    """Konkretny, posiadany egzemplarz. Poziom i moc wylicza serwis z `exp` (patrz services.py)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pokemons')
    character = models.ForeignKey(Character, on_delete=models.PROTECT, related_name='pokemons')
    origin = models.CharField(max_length=10, choices=PokemonOrigin.choices)
    nickname = models.CharField(max_length=60, null=True, blank=True)
    exp = models.BigIntegerField(default=0)
    is_staked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'collection_pokemon'
        constraints = [
            models.CheckConstraint(condition=Q(exp__gte=0), name='pokemon_exp_non_negative'),
            models.UniqueConstraint(fields=['user'], condition=Q(origin='starter'), name='collection_pokemon_one_starter_per_user'),
        ]
