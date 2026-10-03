from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Length

from apps.accounts.models import Organization
from apps.collection.models import Character, Pokemon


models.CharField.register_lookup(Length)  # pozwala użyć `<pole>__length` w ograniczeniach


class EventStatus(models.TextChoices):
    SCHEDULED = 'scheduled'
    CANCELLED = 'cancelled'


class Event(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='events')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    address = models.CharField(max_length=200, null=True, blank=True)
    lat = models.FloatField()
    lng = models.FloatField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    reward_character = models.ForeignKey(Character, on_delete=models.PROTECT, related_name='+')
    capacity = models.IntegerField(null=True, blank=True)
    age_min = models.SmallIntegerField(null=True, blank=True)
    age_max = models.SmallIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=EventStatus.choices, default=EventStatus.SCHEDULED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'events_event'
        indexes = [models.Index(fields=['lat', 'lng'], name='events_event_latlng_idx')]
        constraints = [
            models.CheckConstraint(condition=Q(title__length__gte=3), name='event_title_not_blank'),
            models.CheckConstraint(condition=Q(ends_at__gt=models.F('starts_at')), name='event_ends_after_start'),
            models.CheckConstraint(condition=Q(capacity__isnull=True) | Q(capacity__gt=0), name='event_capacity_positive'),
            models.CheckConstraint(condition=Q(age_min__isnull=True) | Q(age_max__isnull=True) | Q(age_min__lte=models.F('age_max')), name='event_age_range'),
        ]


class Participation(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='participations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    lat = models.FloatField()
    lng = models.FloatField()
    distance_m = models.DecimalField(max_digits=9, decimal_places=1)
    reward_pokemon = models.OneToOneField(Pokemon, on_delete=models.PROTECT, related_name='+')
    checked_in_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'events_participation'
        constraints = [models.UniqueConstraint(fields=['event', 'user'], name='participation_one_per_user')]
