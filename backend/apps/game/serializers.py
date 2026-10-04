from rest_framework import serializers

from core.serializers import CamelSerializer


class EncounterSerializer(CamelSerializer):
    """`Encounter` z kontraktu: moc i typ widoczne z góry, żeby gracz mógł dobrać pokemony przed podejściem."""

    id = serializers.IntegerField()
    name = serializers.CharField(source='enemy_type.name')
    emoji = serializers.CharField(source='enemy_type.emoji')
    level = serializers.IntegerField()
    type_code = serializers.CharField(source='enemy_type.type.code')
    power = serializers.IntegerField()
    description = serializers.CharField(source='enemy_type.description')
    action_label = serializers.CharField(source='enemy_type.action_label')
    xp_reward = serializers.IntegerField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    expires_at = serializers.DateTimeField()


class EncounterQuerySerializer(CamelSerializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    radius = serializers.IntegerField(required=False, min_value=1)
    accuracy_m = serializers.FloatField(required=False, min_value=0)
    taken_at = serializers.DateTimeField(required=False)
    source = serializers.ChoiceField(choices=['gps', 'simulated'], required=False, default='gps')


class AttackRequestSerializer(CamelSerializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    accuracy_m = serializers.FloatField(required=False, allow_null=True, min_value=0)
    client_time = serializers.DateTimeField(required=False, allow_null=True)
    source = serializers.ChoiceField(choices=['gps', 'simulated'], required=False, default='gps')
    pokemon_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
