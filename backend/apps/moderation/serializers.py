from rest_framework import serializers

from core.serializers import CamelSerializer


class ModerationLogEntrySerializer(CamelSerializer):
    """Wpis logu moderacji AI dla administratora. Autor tylko z nazwy wyświetlanej (bez e-maila)."""

    id = serializers.IntegerField()
    verdict = serializers.CharField()
    reason = serializers.CharField(allow_null=True)
    scenario_code = serializers.CharField(source='scenario.code')
    scenario_label = serializers.CharField(source='scenario.label')
    submitted = serializers.JSONField()
    author = serializers.CharField(source='author.display_name')
    model = serializers.CharField(allow_null=True)
    latency_ms = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()
