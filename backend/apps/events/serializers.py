from rest_framework import serializers

from apps.events import services
from apps.pokestops.serializers import PositionSerializer
from core.serializers import CamelSerializer

TIME_FORMATS = ['%H:%M', '%H:%M:%S']


def _hhmm(value):
    return None if value is None else value.strftime('%H:%M')


class EventSerializer(CamelSerializer):
    """Kontekst: `request` oraz `checked_in` (id wydarzeń, na których zalogowany użytkownik już odebrał nagrodę)."""

    id = serializers.IntegerField()
    organization = serializers.CharField(source='organization.name')
    organization_id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    address = serializers.CharField(allow_null=True)
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    daily_from = serializers.SerializerMethodField()
    daily_to = serializers.SerializerMethodField()
    reward_character = serializers.CharField(source='reward_character.code')
    capacity = serializers.IntegerField(allow_null=True)
    age_min = serializers.IntegerField(allow_null=True)
    age_max = serializers.IntegerField(allow_null=True)
    status = serializers.CharField()
    phase = serializers.SerializerMethodField()
    active_now = serializers.SerializerMethodField()
    next_window_start = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    checked_in = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()

    def get_daily_from(self, obj):
        return _hhmm(obj.daily_from)

    def get_daily_to(self, obj):
        return _hhmm(obj.daily_to)

    def get_phase(self, obj):
        return services.phase(obj)

    def get_active_now(self, obj):
        return services.is_active_now(obj)

    def get_next_window_start(self, obj):
        moment = services.next_window_start(obj)
        return None if moment is None else serializers.DateTimeField().to_representation(moment)

    def get_participant_count(self, obj):
        annotated = getattr(obj, 'participant_count', None)
        return annotated if annotated is not None else obj.participations.count()

    def get_checked_in(self, obj):
        return obj.id in self.context.get('checked_in', ())

    def get_mine(self, obj):
        return services.can_manage(self.context['request'].user, obj)


class NewEventSerializer(CamelSerializer):
    title = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=200)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    daily_from = serializers.TimeField(required=False, allow_null=True, input_formats=TIME_FORMATS)
    daily_to = serializers.TimeField(required=False, allow_null=True, input_formats=TIME_FORMATS)
    reward_character = serializers.CharField()
    capacity = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    age_min = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=120)
    age_max = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=120)


class EventPatchSerializer(CamelSerializer):
    status = serializers.ChoiceField(choices=['cancelled'])


class CheckInRequestSerializer(CamelSerializer):
    position = PositionSerializer()
