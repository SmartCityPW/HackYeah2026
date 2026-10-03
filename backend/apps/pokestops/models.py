from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Length

from apps.accounts.models import Organization
from apps.collection.models import Character, Pokemon
from apps.scenarios.models import FieldType, PokestopType, Scenario

ORG_TYPES = [PokestopType.NGO, PokestopType.CONSULTATION]
STAKE_TYPES = [PokestopType.REPORT, PokestopType.IDEA]


models.CharField.register_lookup(Length)  # pozwala użyć `<pole>__length` w ograniczeniach


class Status(models.TextChoices):
    OPEN = 'open'
    IN_PROGRESS = 'in_progress'
    RESOLVED = 'resolved'
    REJECTED = 'rejected'


class VoteValue(models.TextChoices):
    FOR = 'for'
    AGAINST = 'against'


class Pokestop(models.Model):
    type = models.CharField(max_length=12, choices=PokestopType.choices)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    scenario = models.ForeignKey(Scenario, on_delete=models.PROTECT, related_name='pokestops')
    scenario_version = models.IntegerField()
    character = models.ForeignKey(Character, on_delete=models.PROTECT, related_name='+')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='pokestops')
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.PROTECT, related_name='pokestops')
    title = models.CharField(max_length=80)
    description = models.TextField(blank=True, default='')
    lat = models.FloatField()
    lng = models.FloatField()
    details = models.JSONField(default=dict)
    custom_fields = models.JSONField(default=list)  # pola własne organizatora: [{"label": ..., "value": ...}]
    votes_for = models.IntegerField(default=0)
    votes_against = models.IntegerField(default=0)
    votes_required = models.SmallIntegerField()
    staked_pokemon = models.ForeignKey(Pokemon, null=True, blank=True, on_delete=models.PROTECT, related_name='+')
    stake_released_at = models.DateTimeField(null=True, blank=True)
    stake_bonus_exp = models.IntegerField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pokestops_pokestop'
        indexes = [
            models.Index(fields=['lat', 'lng'], name='pokestops_latlng_idx'),
            models.Index(fields=['status', 'type'], name='pokestops_status_type_idx'),
            models.Index(fields=['-created_at'], name='pokestops_created_idx'),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(lat__gte=-90, lat__lte=90, lng__gte=-180, lng__lte=180), name='pokestop_coordinates_valid'),
            models.CheckConstraint(condition=Q(title__length__gte=3), name='pokestop_title_not_blank'),
            models.CheckConstraint(condition=Q(votes_for__gte=0, votes_against__gte=0), name='pokestop_votes_non_negative'),
            models.CheckConstraint(condition=Q(votes_required__gt=0), name='pokestop_votes_required_positive'),
            models.CheckConstraint(
                condition=(Q(type__in=ORG_TYPES) & Q(organization__isnull=False)) | (~Q(type__in=ORG_TYPES) & Q(organization__isnull=True)),
                name='pokestop_org_for_org_types',
            ),
            models.CheckConstraint(
                condition=(Q(type__in=STAKE_TYPES) & Q(staked_pokemon__isnull=False)) | (~Q(type__in=STAKE_TYPES) & Q(staked_pokemon__isnull=True)),
                name='pokestop_stake_matches_type',
            ),
            models.CheckConstraint(
                condition=Q(stake_released_at__isnull=True, stake_bonus_exp__isnull=True)
                | (Q(stake_released_at__isnull=False, stake_bonus_exp__isnull=False, staked_pokemon__isnull=False) & Q(stake_bonus_exp__gte=0)),
                name='pokestop_stake_release_consistent',
            ),
            models.CheckConstraint(condition=Q(rejection_reason__isnull=True) | Q(status='rejected'), name='pokestop_rejection_reason'),
        ]


class Photo(models.Model):
    pokestop = models.ForeignKey(Pokestop, null=True, blank=True, on_delete=models.CASCADE, related_name='photos')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    storage_key = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=60)
    size_bytes = models.IntegerField()
    width = models.SmallIntegerField(null=True, blank=True)
    height = models.SmallIntegerField(null=True, blank=True)
    sort_order = models.SmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pokestops_photo'
        ordering = ['sort_order', 'id']
        constraints = [
            models.CheckConstraint(condition=Q(sort_order__gte=0, sort_order__lte=2), name='photo_max_three'),
            models.UniqueConstraint(fields=['pokestop', 'sort_order'], name='photo_pokestop_order_unique'),
        ]


class Vote(models.Model):
    pokestop = models.ForeignKey(Pokestop, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='votes')
    vote = models.CharField(max_length=7, choices=VoteValue.choices)
    rewarded_pokemon = models.ForeignKey(Pokemon, on_delete=models.PROTECT, related_name='+')
    exp_granted = models.IntegerField(default=0)
    lat = models.FloatField()
    lng = models.FloatField()
    distance_m = models.DecimalField(max_digits=9, decimal_places=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pokestops_vote'
        constraints = [
            models.UniqueConstraint(fields=['pokestop', 'user'], name='pokestops_vote_one_per_user'),
            models.CheckConstraint(condition=Q(exp_granted__gte=0), name='vote_exp_non_negative'),
            models.CheckConstraint(condition=Q(distance_m__gte=0), name='vote_distance_non_negative'),
        ]


class Comment(models.Model):
    pokestop = models.ForeignKey(Pokestop, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies', db_column='parent_comment_id')
    body = models.CharField(max_length=300)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pokestops_comment'
        constraints = [models.CheckConstraint(condition=Q(body__length__gte=1), name='comment_body_not_blank')]


class StatusChange(models.Model):
    pokestop = models.ForeignKey(Pokestop, on_delete=models.CASCADE, related_name='status_changes')
    from_status = models.CharField(max_length=12, choices=Status.choices)
    to_status = models.CharField(max_length=12, choices=Status.choices)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pokestops_status_change'
        constraints = [models.CheckConstraint(condition=~Q(from_status=models.F('to_status')), name='status_change_differs')]


class Update(models.Model):
    """Wpis organizatora na osi czasu inicjatywy (np. "Dziś rada miasta spotkała się w sprawie ...")."""

    pokestop = models.ForeignKey(Pokestop, on_delete=models.CASCADE, related_name='updates')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pokestops_update'
        indexes = [models.Index(fields=['pokestop', '-created_at'], name='pokestops_update_stop_idx')]
        constraints = [models.CheckConstraint(condition=Q(title__length__gte=1), name='update_title_not_blank')]


class Verdict(models.TextChoices):
    APPROVED = 'approved'
    REJECTED = 'rejected'
    ERROR = 'error'


class ModerationLog(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    scenario = models.ForeignKey(Scenario, on_delete=models.PROTECT, related_name='+')
    pokestop = models.ForeignKey(Pokestop, null=True, blank=True, on_delete=models.SET_NULL, related_name='moderation_logs')
    submitted = models.JSONField()
    verdict = models.CharField(max_length=10, choices=Verdict.choices)
    reason = models.TextField(null=True, blank=True)
    model = models.CharField(max_length=60, null=True, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pokestops_moderation_log'
        constraints = [models.CheckConstraint(condition=Q(verdict='approved') | Q(pokestop__isnull=True), name='moderation_only_approved_saved')]


class Question(models.Model):
    pokestop = models.ForeignKey(Pokestop, on_delete=models.CASCADE, related_name='questions')
    question_key = models.CharField(max_length=40)
    label = models.CharField(max_length=300)
    field_type = models.CharField(max_length=12, choices=FieldType.choices)
    required = models.BooleanField(default=True)
    options = models.JSONField(null=True, blank=True)
    min_value = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    max_value = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    sort_order = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'pokestops_question'
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['pokestop', 'question_key'], name='question_key_unique'),
            models.UniqueConstraint(fields=['pokestop', 'sort_order'], name='question_order_unique'),
        ]


class SurveyResponse(models.Model):
    pokestop = models.ForeignKey(Pokestop, on_delete=models.CASCADE, related_name='survey_responses')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    lat = models.FloatField()
    lng = models.FloatField()
    distance_m = models.DecimalField(max_digits=9, decimal_places=1)
    reward_pokemon = models.OneToOneField(Pokemon, on_delete=models.PROTECT, related_name='+')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pokestops_survey_response'
        constraints = [models.UniqueConstraint(fields=['pokestop', 'user'], name='survey_one_per_user')]


class SurveyAnswer(models.Model):
    response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    value = models.JSONField()

    class Meta:
        db_table = 'pokestops_survey_answer'
        constraints = [models.UniqueConstraint(fields=['response', 'question'], name='survey_answer_unique')]
