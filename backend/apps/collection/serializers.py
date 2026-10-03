from rest_framework import serializers

from apps.collection.models import Character, Pokemon, PokemonType
from apps.collection.services import level_for, power_for
from core.serializers import CamelSerializer


class PokemonSerializer(CamelSerializer):
    id = serializers.IntegerField()
    character = serializers.CharField(source='character.code')
    type_code = serializers.CharField(source='character.type.code')
    nickname = serializers.CharField(allow_null=True)
    level = serializers.SerializerMethodField()
    exp = serializers.IntegerField()
    power = serializers.SerializerMethodField()
    is_staked = serializers.BooleanField()
    caught_at = serializers.DateTimeField(source='created_at')

    def get_level(self, obj: Pokemon) -> int:
        return level_for(obj.exp)

    def get_power(self, obj: Pokemon) -> int:
        return power_for(obj.character, obj.exp)


class CatalogCharacterSerializer(CamelSerializer):
    code = serializers.CharField()
    label = serializers.CharField()
    emoji = serializers.CharField()
    category_label = serializers.CharField()
    type_code = serializers.CharField(source='type.code')
    model_path = serializers.CharField(allow_null=True)
    is_starter = serializers.BooleanField()


class CatalogTypeSerializer(CamelSerializer):
    code = serializers.CharField()
    name = serializers.CharField()
    emoji = serializers.CharField()


def catalog_payload() -> dict:
    characters = Character.objects.filter(is_active=True).select_related('type').order_by('id')
    return {
        'characters': CatalogCharacterSerializer(characters, many=True).data,
        'types': CatalogTypeSerializer(PokemonType.objects.order_by('id'), many=True).data,
    }
