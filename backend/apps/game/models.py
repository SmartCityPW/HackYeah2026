from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.collection.models import PokemonType, Pokemon


class ActionKind(models.TextChoices):
    CHECKIN = 'checkin'
    PHOTO = 'photo'
    QR = 'qr'
    DWELL = 'dwell'


class EnemyType(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=80)
    emoji = models.CharField(max_length=8)
    description = models.TextField(blank=True, default='')
    type = models.ForeignKey(PokemonType, on_delete=models.PROTECT, related_name='enemy_types')
    action_kind = models.CharField(max_length=10, choices=ActionKind.choices, default=ActionKind.CHECKIN)
    action_label = models.CharField(max_length=200)
    min_level = models.SmallIntegerField(default=1)
    max_level = models.SmallIntegerField(default=5)
    base_power = models.IntegerField()
    power_growth = models.IntegerField(default=10)
    base_xp = models.IntegerField()
    spawn_weight = models.SmallIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'game_enemy_type'
        constraints = [
            models.CheckConstraint(condition=Q(min_level__gte=1, min_level__lte=models.F('max_level')), name='enemy_level_range'),
            models.CheckConstraint(condition=Q(base_xp__gt=0), name='enemy_xp_positive'),
            models.CheckConstraint(condition=Q(base_power__gt=0, power_growth__gt=0), name='enemy_power_positive'),
            models.CheckConstraint(condition=Q(spawn_weight__gt=0), name='enemy_weight_positive'),
        ]


class EncounterStatus(models.TextChoices):
    ACTIVE = 'active'
    DEFEATED = 'defeated'
    EXPIRED = 'expired'


class EncounterCell(models.Model):
    """Kwadrat terenu (bok `game.encounters.cell_size_m`), do którego przypisani są przeciwnicy, wspólny dla wszystkich graczy.

    `row`/`col` to numer kwadratu w siatce (patrz `services.cell_of`). `refill_at`: kiedy pusty kwadrat zasiedli się na nowo
    (NULL, dopóki stoją w nim przeciwnicy albo nikt jeszcze nie zauważył, że jest pusty).
    """

    row = models.IntegerField()
    col = models.IntegerField()
    populated_at = models.DateTimeField(null=True, blank=True)
    refill_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'game_encounter_cell'
        constraints = [models.UniqueConstraint(fields=['row', 'col'], name='game_encounter_cell_unique')]


class Encounter(models.Model):
    cell = models.ForeignKey(EncounterCell, null=True, blank=True, on_delete=models.CASCADE, related_name='encounters')
    enemy_type = models.ForeignKey(EnemyType, on_delete=models.PROTECT, related_name='encounters')
    level = models.SmallIntegerField()
    power = models.IntegerField()
    xp_reward = models.IntegerField()
    lat = models.FloatField()
    lng = models.FloatField()
    status = models.CharField(max_length=10, choices=EncounterStatus.choices, default=EncounterStatus.ACTIVE)
    spawned_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    defeated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    defeated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'game_encounter'
        indexes = [models.Index(fields=['status', 'lat', 'lng'], name='game_encounter_state_pos_idx')]
        constraints = [
            models.CheckConstraint(condition=Q(level__gte=1, level__lte=100), name='encounter_level_range'),
            models.CheckConstraint(condition=Q(power__gt=0), name='encounter_power_positive'),
            models.CheckConstraint(condition=Q(xp_reward__gt=0), name='encounter_xp_positive'),
        ]


class AttackOutcome(models.TextChoices):
    WON = 'won'
    LOST = 'lost'
    TOO_FAR = 'too_far'
    REJECTED = 'rejected'
    EXPIRED = 'expired'


class Attack(models.Model):
    encounter = models.ForeignKey(Encounter, on_delete=models.CASCADE, related_name='attacks')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    lat = models.FloatField()
    lng = models.FloatField()
    distance_m = models.DecimalField(max_digits=9, decimal_places=1)
    accuracy_m = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    client_time = models.DateTimeField(null=True, blank=True)
    pokemon_power_total = models.IntegerField(null=True, blank=True)
    reward_pokemon = models.OneToOneField(Pokemon, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    outcome = models.CharField(max_length=10, choices=AttackOutcome.choices)
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'game_attack'
        indexes = [models.Index(fields=['user', '-created_at'], name='game_attack_user_time_idx')]
        constraints = [
            models.UniqueConstraint(fields=['encounter'], condition=Q(outcome='won'), name='game_attack_one_win_per_encounter'),
            models.CheckConstraint(condition=Q(distance_m__gte=0), name='attack_distance_non_negative'),
            models.CheckConstraint(
                condition=Q(outcome__in=['won', 'lost'], pokemon_power_total__isnull=False)
                | (~Q(outcome__in=['won', 'lost']) & Q(pokemon_power_total__isnull=True)),
                name='attack_power_total_required',
            ),
            models.CheckConstraint(
                condition=Q(outcome='won', reward_pokemon__isnull=False) | (~Q(outcome='won') & Q(reward_pokemon__isnull=True)),
                name='attack_reward_iff_won',
            ),
        ]


class AttackPokemon(models.Model):
    attack = models.ForeignKey(Attack, on_delete=models.CASCADE, related_name='pokemons')
    pokemon = models.ForeignKey(Pokemon, on_delete=models.PROTECT, related_name='+')
    power_used = models.IntegerField()
    type_multiplier_applied = models.DecimalField(max_digits=3, decimal_places=2, default=1)
    exp_gained = models.IntegerField(default=0)

    class Meta:
        db_table = 'game_attack_pokemon'
        constraints = [
            models.UniqueConstraint(fields=['attack', 'pokemon'], name='attack_pokemon_unique'),
            models.CheckConstraint(condition=Q(power_used__gt=0), name='attack_pokemon_power_positive'),
            models.CheckConstraint(condition=Q(type_multiplier_applied__gte=1), name='attack_pokemon_multiplier_valid'),
            models.CheckConstraint(condition=Q(exp_gained__gte=0), name='attack_pokemon_exp_non_negative'),
        ]


class PlayerProgress(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name='progress')
    xp = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'game_player_progress'
        constraints = [models.CheckConstraint(condition=Q(xp__gte=0), name='progress_xp_non_negative')]
