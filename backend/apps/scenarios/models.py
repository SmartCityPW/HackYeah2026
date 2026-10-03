from django.db import models
from django.db.models import Q

from apps.collection.models import Character


class Audience(models.TextChoices):
    RESIDENT = 'resident'
    ORG = 'org'


class Category(models.TextChoices):
    PROBLEM = 'problem'
    INITIATIVE = 'initiative'
    PLACE = 'place'


class FieldType(models.TextChoices):
    TEXT = 'text'
    TEXTAREA = 'textarea'
    NUMBER = 'number'
    SELECT = 'select'
    MULTISELECT = 'multiselect'
    BOOLEAN = 'boolean'
    TAGS = 'tags'
    DATE = 'date'
    PHOTOS = 'photos'
    CHARACTER = 'character'
    CHOICE = 'choice'
    RATING = 'rating'


class PokestopType(models.TextChoices):
    REPORT = 'report'
    IDEA = 'idea'
    PLACE = 'place'
    NGO = 'ngo'
    CONSULTATION = 'consultation'


class Scenario(models.Model):
    code = models.CharField(max_length=60, unique=True)
    audience = models.CharField(max_length=10, choices=Audience.choices)
    category = models.CharField(max_length=12, choices=Category.choices, null=True, blank=True)
    pokestop_type = models.CharField(max_length=12, choices=PokestopType.choices)
    label = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    emoji = models.CharField(max_length=8)
    default_character = models.ForeignKey(Character, on_delete=models.PROTECT, related_name='+')
    default_title = models.CharField(max_length=80, null=True, blank=True)
    votes_required = models.SmallIntegerField(default=10)
    sort_order = models.SmallIntegerField(default=0)
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'scenarios_scenario'
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(fields=['id', 'pokestop_type'], name='scenario_id_type_unique'),
            models.CheckConstraint(condition=Q(votes_required__gt=0), name='scenario_votes_required_positive'),
            models.CheckConstraint(
                condition=(
                    Q(audience='resident')
                    & (
                        (Q(category='problem') & Q(pokestop_type='report'))
                        | (Q(category='initiative') & Q(pokestop_type='idea'))
                        | (Q(category='place') & Q(pokestop_type='place'))
                    )
                )
                | (Q(audience='org') & Q(category__isnull=True) & Q(pokestop_type__in=['ngo', 'consultation'])),
                name='scenario_type_matches_category',
            ),
        ]


class Section(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=100)
    sort_order = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'scenarios_section'
        ordering = ['sort_order', 'id']


class Field(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE, related_name='fields')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='fields')
    field_key = models.CharField(max_length=40)
    label = models.CharField(max_length=150)
    field_type = models.CharField(max_length=12, choices=FieldType.choices)
    required = models.BooleanField(default=False)
    hint = models.TextField(null=True, blank=True)
    placeholder = models.CharField(max_length=120, null=True, blank=True)
    unit = models.CharField(max_length=16, null=True, blank=True)
    min_value = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    max_value = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    show_if_key = models.CharField(max_length=40, null=True, blank=True)
    show_if_value = models.JSONField(null=True, blank=True)
    sort_order = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'scenarios_field'
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['scenario', 'field_key'], name='field_key_unique_in_scenario')]


class FieldOption(models.Model):
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name='options')
    value = models.CharField(max_length=60)
    label = models.CharField(max_length=120)
    sort_order = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'scenarios_field_option'
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['field', 'value'], name='field_option_value_unique')]
