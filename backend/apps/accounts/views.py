from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import services
from apps.accounts.models import Organization, VerificationStatus
from apps.accounts.serializers import (
    CredentialsSerializer,
    MeSerializer,
    OrganizationPublicSerializer,
    OrganizationRegistrationSerializer,
    OrganizationSerializer,
)
from core.errors import ApiError
from core.permissions import role_required
from core.throttling import GuestCreationThrottle


class GuestView(APIView):
    """POST /auth/guest: anonimowe konto gościa (z pokemonem startowym)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [GuestCreationThrottle]

    def post(self, request):
        return Response(services.issue_tokens(services.create_guest()), status=status.HTTP_201_CREATED)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        s = CredentialsSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = services.register(s.validated_data['email'], s.validated_data['password'], s.validated_data.get('display_name'))
        return Response(services.issue_tokens(user), status=status.HTTP_201_CREATED)


class RegisterOrganizationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        s = OrganizationRegistrationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        user = services.register_organization(d['email'], d['password'], d.get('display_name'), d['organization'])
        return Response(services.issue_tokens(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        s = CredentialsSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(request, username=s.validated_data['email'], password=s.validated_data['password'])
        if user is None:
            raise ApiError(status.HTTP_401_UNAUTHORIZED, 'invalid_credentials', 'Nieprawidłowy e-mail lub hasło')
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        return Response(services.issue_tokens(user))


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            refresh = RefreshToken(request.data.get('refresh', ''))
        except TokenError as exc:
            raise ApiError(status.HTTP_401_UNAUTHORIZED, 'unauthorized', 'Nieważny token odświeżania') from exc
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


class UpgradeView(APIView):
    """POST /auth/upgrade: zapis konta gościa z zachowaniem postępu."""

    def post(self, request):
        s = CredentialsSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = services.upgrade_guest(request.user, s.validated_data['email'], s.validated_data['password'], s.validated_data.get('display_name'))
        return Response(MeSerializer(user).data)


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)


class MyOrganizationView(APIView):
    def get(self, request):
        org = services.organization_of(request.user)
        if org is None:
            raise ApiError(status.HTTP_404_NOT_FOUND, 'not_found', 'Użytkownik nie należy do żadnej organizacji')
        return Response(OrganizationSerializer(org).data)


class OrganizationPublicView(APIView):
    """GET /organizations/{id}: publiczny profil bez danych kontaktowych."""

    def get(self, request, pk):
        org = Organization.objects.filter(pk=pk).first()
        if org is None:
            raise ApiError(status.HTTP_404_NOT_FOUND, 'not_found', 'Organizacja nie istnieje')
        return Response(OrganizationPublicSerializer(org).data)


class AdminOrganizationsView(APIView):
    permission_classes = [role_required('admin')]

    def get(self, request):
        qs = Organization.objects.order_by('id')
        wanted = request.query_params.get('verificationStatus')
        if wanted:
            qs = qs.filter(verification_status=wanted)
        return Response(OrganizationSerializer(qs, many=True).data)


class AdminOrganizationDetailView(APIView):
    permission_classes = [role_required('admin')]

    def patch(self, request, pk):
        org = Organization.objects.filter(pk=pk).first()
        if org is None:
            raise ApiError(status.HTTP_404_NOT_FOUND, 'not_found', 'Organizacja nie istnieje')
        new_status = request.data.get('verificationStatus')
        if new_status not in VerificationStatus.values:
            raise ApiError(status.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', {'verificationStatus': 'Nieznany status'})
        org.verification_status = new_status
        if new_status == VerificationStatus.VERIFIED:
            org.verified_at, org.verified_by = timezone.now(), request.user
        else:
            org.verified_at, org.verified_by = None, None
        org.save()
        return Response(OrganizationSerializer(org).data)
