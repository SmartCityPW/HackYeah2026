from rest_framework import serializers

from apps.collection.models import Character, Pokemon, PokemonType
from django.conf import settings

from apps.collection.catalog import catalog_character
from apps.collection.services import level_for, power_for
from core.serializers import CamelSerializer


class PokemonSerializer(CamelSerializer):
    id = serializers.IntegerField()
    character = serializers.CharField(source='character.code')
    type_code = serializers.CharField(source='character.type.code')
    nickname = serializers.CharField(allow_null=True)
    level = serializers.SerializerMethodField()
    exp = serializers.IntegerField()
    exp_into_level = serializers.SerializerMethodField()
    exp_for_next_level = serializers.SerializerMethodField()
    power = serializers.SerializerMethodField()
    is_staked = serializers.BooleanField()
    caught_at = serializers.DateTimeField(source='created_at')

    def get_level(self, obj: Pokemon) -> int:
        return level_for(obj.exp)

    def get_exp_into_level(self, obj: Pokemon) -> int:
        return obj.exp % settings.APP.game.levels.exp_per_pokemon_level

    def get_exp_for_next_level(self, obj: Pokemon) -> int:
        return settings.APP.game.levels.exp_per_pokemon_level

    def get_power(self, obj: Pokemon) -> int:
        return power_for(obj.character, obj.exp)


class CatalogTypeSerializer(CamelSerializer):
    code = serializers.CharField()
    name = serializers.CharField()
    emoji = serializers.CharField()


def catalog_payload() -> dict:
    characters = Character.objects.filter(is_active=True).select_related('type').order_by('id')
    return {
        'characters': [
            catalog_character(c.code, c.label, c.emoji, c.category_label, c.type.code, c.model_path, c.is_starter, c.is_event_exclusive,
                              c.base_power, c.power_growth)
            for c in characters
        ],
        'types': CatalogTypeSerializer(PokemonType.objects.order_by('id'), many=True).data,
    }
