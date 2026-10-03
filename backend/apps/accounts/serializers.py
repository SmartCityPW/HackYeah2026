from django.conf import settings
from rest_framework import serializers

from apps.accounts.models import OrganizationKind, Organization
from core.serializers import CamelSerializer


class CredentialsSerializer(CamelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    display_name = serializers.CharField(max_length=60, required=False, allow_blank=True)

    def validate_email(self, value: str) -> str:
        return value.lower()

    def validate_password(self, value: str) -> str:
        minimum = settings.APP.auth.password_min_length
        if len(value) < minimum:
            raise serializers.ValidationError(f'Hasło musi mieć co najmniej {minimum} znaków')
        return value


class OrganizationInputSerializer(CamelSerializer):
    name = serializers.CharField(max_length=150)
    kind = serializers.ChoiceField(choices=OrganizationKind.choices)
    krs = serializers.CharField(max_length=10, required=False, allow_null=True, allow_blank=True)
    contact_person = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    contact_email = serializers.EmailField(required=False, allow_null=True)
    contact_phone = serializers.CharField(max_length=30, required=False, allow_null=True, allow_blank=True)


class OrganizationRegistrationSerializer(CredentialsSerializer):
    organization = OrganizationInputSerializer()


class OrganizationSerializer(CamelSerializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.CharField()
    krs = serializers.CharField(allow_null=True)
    contact_person = serializers.CharField(allow_null=True)
    contact_email = serializers.CharField(allow_null=True)
    contact_phone = serializers.CharField(allow_null=True)
    verification_status = serializers.CharField()


class OrganizationPublicSerializer(CamelSerializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.CharField()
    verified = serializers.BooleanField(source='is_verified')


class MeSerializer(CamelSerializer):
    id = serializers.IntegerField()
    display_name = serializers.CharField()
    role = serializers.CharField()
    is_guest = serializers.BooleanField()
    organization = serializers.SerializerMethodField()

    def get_organization(self, user):
        from apps.accounts.services import organization_of

        org = organization_of(user)
        return OrganizationSerializer(org).data if org else None
