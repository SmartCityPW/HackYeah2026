from django.conf import settings
from rest_framework import serializers

from apps.pokestops.models import Comment, Question, Status
from apps.scenarios.models import FieldType
from core.serializers import CamelSerializer

QUESTION_TYPES = [FieldType.TEXT, FieldType.TEXTAREA, FieldType.NUMBER, FieldType.SELECT, FieldType.MULTISELECT, FieldType.BOOLEAN, FieldType.CHOICE, FieldType.RATING]


def _num(value):
    return None if value is None else float(value)


class QuestionSerializer(CamelSerializer):
    id = serializers.IntegerField()
    key = serializers.CharField(source='question_key')
    label = serializers.CharField()
    type = serializers.CharField(source='field_type')
    required = serializers.BooleanField()
    options = serializers.SerializerMethodField()
    min = serializers.SerializerMethodField()
    max = serializers.SerializerMethodField()

    def get_options(self, q: Question):
        return q.options or []

    def get_min(self, q: Question):
        return _num(q.min_value)

    def get_max(self, q: Question):
        return _num(q.max_value)


class PokestopSerializer(CamelSerializer):
    """Kontekst: `request` oraz `my_votes` ({id pinezki: 'for'|'against'}) policzone raz dla całej strony."""

    id = serializers.IntegerField()
    type = serializers.CharField()
    status = serializers.CharField()
    scenario_code = serializers.CharField(source='scenario.code')
    character = serializers.CharField(source='character.code')
    icon = serializers.CharField(source='scenario.emoji')
    title = serializers.CharField()
    description = serializers.CharField()
    author = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()
    organization_id = serializers.IntegerField(allow_null=True)
    photos = serializers.SerializerMethodField()
    details = serializers.JSONField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    votes_for = serializers.IntegerField()
    votes_against = serializers.IntegerField()
    my_vote = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    rejection_reason = serializers.CharField(allow_null=True)
    votes_required = serializers.IntegerField()
    staked_pokemon_id = serializers.IntegerField(allow_null=True)
    stake_released_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()

    def get_author(self, obj):
        return obj.organization.name if obj.organization_id else obj.author.display_name

    def get_mine(self, obj):
        return obj.author_id == self.context['request'].user.id

    def get_organization(self, obj):
        return obj.organization.name if obj.organization_id else None

    def get_photos(self, obj):
        return [{'id': p.id, 'url': f'{settings.MEDIA_URL}{p.storage_key}'} for p in obj.photos.all()]

    def get_my_vote(self, obj):
        return self.context.get('my_votes', {}).get(obj.id)

    def get_comment_count(self, obj):
        annotated = getattr(obj, 'comment_count', None)
        return annotated if annotated is not None else obj.comments.filter(hidden_at__isnull=True).count()


class PokestopDetailSerializer(PokestopSerializer):
    questions = serializers.SerializerMethodField()
    survey_answered = serializers.SerializerMethodField()

    def get_questions(self, obj):
        return QuestionSerializer(obj.questions.all(), many=True).data

    def get_survey_answered(self, obj):
        return obj.survey_responses.filter(user=self.context['request'].user).exists()


class CommentSerializer(CamelSerializer):
    id = serializers.IntegerField()
    parent_comment_id = serializers.IntegerField(source='parent_id', allow_null=True)
    author = serializers.CharField(source='author.display_name')
    text = serializers.CharField(source='body')
    mine = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()
    replies = serializers.SerializerMethodField()

    def get_mine(self, obj: Comment):
        return obj.author_id == self.context['request'].user.id

    def get_replies(self, obj: Comment):
        replies = [r for r in obj.replies.all() if r.hidden_at is None]
        return CommentSerializer(replies, many=True, context=self.context).data if replies else []


class NewQuestionSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=40)
    label = serializers.CharField(max_length=300)
    type = serializers.ChoiceField(choices=QUESTION_TYPES)
    required = serializers.BooleanField(default=True)
    options = serializers.ListField(child=serializers.DictField(child=serializers.CharField()), required=False)
    min = serializers.DecimalField(max_digits=14, decimal_places=4, required=False, allow_null=True)
    max = serializers.DecimalField(max_digits=14, decimal_places=4, required=False, allow_null=True)

    def validate(self, data):
        needs_options = data['type'] in (FieldType.SELECT, FieldType.MULTISELECT, FieldType.CHOICE)
        if needs_options and not data.get('options'):
            raise serializers.ValidationError({'options': 'Wymagane dla pytań z wyborem'})
        if data.get('options') is not None and any(set(o) != {'value', 'label'} for o in data['options']):
            raise serializers.ValidationError({'options': 'Każda opcja ma mieć "value" i "label"'})
        return data


class NewPokestopSerializer(CamelSerializer):
    scenario_code = serializers.CharField()
    title = serializers.CharField(min_length=3, max_length=80)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    character = serializers.CharField(required=False, allow_null=True)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    photo_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    details = serializers.DictField(required=False, default=dict)
    organization_id = serializers.IntegerField(required=False)
    staked_pokemon_id = serializers.IntegerField(required=False)
    questions = NewQuestionSerializer(many=True, required=False)


class VoteRequestSerializer(CamelSerializer):
    vote = serializers.ChoiceField(choices=['for', 'against'])
    pokemon_id = serializers.IntegerField()
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    accuracy_m = serializers.FloatField(required=False, min_value=0)


class StatusChangeSerializer(CamelSerializer):
    status = serializers.ChoiceField(choices=Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CommentRequestSerializer(CamelSerializer):
    text = serializers.CharField(min_length=1)
    parent_comment_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_text(self, value: str) -> str:
        limit = settings.APP.pokestops.comment_max_length
        if len(value) > limit:
            raise serializers.ValidationError(f'Maksymalnie {limit} znaków')
        return value
