from rest_framework import serializers

from apps.scenarios.models import Field, Scenario
from core.serializers import CamelSerializer


def _num(value):
    return None if value is None else float(value)


class FieldSerializer(CamelSerializer):
    key = serializers.CharField(source='field_key')
    label = serializers.CharField()
    type = serializers.CharField(source='field_type')
    required = serializers.BooleanField()
    hint = serializers.CharField(allow_null=True)
    placeholder = serializers.CharField(allow_null=True)
    unit = serializers.CharField(allow_null=True)
    min = serializers.SerializerMethodField()
    max = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()
    show_if = serializers.SerializerMethodField()

    def get_min(self, f: Field):
        return _num(f.min_value)

    def get_max(self, f: Field):
        return _num(f.max_value)

    def get_options(self, f: Field):
        return [{'value': o.value, 'label': o.label} for o in f.options.all()]

    def get_show_if(self, f: Field):
        return {'key': f.show_if_key, 'equals': f.show_if_value} if f.show_if_key else None


class ScenarioSerializer(CamelSerializer):
    code = serializers.CharField()
    audience = serializers.CharField()
    category = serializers.CharField(allow_null=True)
    pokestop_type = serializers.CharField()
    label = serializers.CharField()
    description = serializers.CharField()
    emoji = serializers.CharField()
    character = serializers.CharField(source='default_character.code')
    default_title = serializers.CharField(allow_null=True)
    version = serializers.IntegerField()
    sections = serializers.SerializerMethodField()

    def get_sections(self, scenario: Scenario):
        out = []
        for section in scenario.sections.all():
            fields = FieldSerializer(section.fields.all(), many=True).data
            out.append({'title': section.title, 'fields': fields})
        return out
