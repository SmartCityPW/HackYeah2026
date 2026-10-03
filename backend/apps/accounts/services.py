"""Zakładanie kont i tokeny. Każde nowe konto mieszkańca dostaje pokemona startowego."""
import secrets

from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import MemberRole, Organization, OrganizationMember, Role, User
from apps.collection.services import grant_starter
from core.errors import ApiError


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _email_taken() -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, 'email_taken', 'Konto z tym adresem e-mail już istnieje')


@transaction.atomic
def create_guest() -> User:
    user = User.objects.create_guest(display_name=f'Gość-{secrets.token_hex(2)}')
    grant_starter(user)
    return user


def register(email: str, password: str, display_name: str | None) -> User:
    try:
        with transaction.atomic():
            user = User.objects.create_user(email, password, display_name or email.split('@')[0])
            grant_starter(user)
            return user
    except IntegrityError as exc:
        raise _email_taken() from exc


def register_organization(email: str, password: str, display_name: str | None, organization: dict) -> User:
    """Konto `org` + organizacja `pending` + członkostwo właściciela. Publikować można po weryfikacji."""
    try:
        with transaction.atomic():
            user = User.objects.create_user(email, password, display_name or organization['name'], role=Role.ORG)
            org = Organization.objects.create(**organization)
            OrganizationMember.objects.create(organization=org, user=user, member_role=MemberRole.OWNER)
            return user
    except IntegrityError as exc:
        raise _email_taken() from exc


def upgrade_guest(user: User, email: str, password: str, display_name: str | None) -> User:
    if not user.is_guest:
        raise ApiError(status.HTTP_409_CONFLICT, 'already_registered', 'To konto jest już zapisane')
    try:
        with transaction.atomic():
            user.email = User.objects.normalize_email(email).lower()
            user.set_password(password)
            user.is_guest = False
            if display_name:
                user.display_name = display_name
            user.save()
            return user
    except IntegrityError as exc:
        raise _email_taken() from exc


def organization_of(user: User) -> Organization | None:
    member = OrganizationMember.objects.select_related('organization').filter(user=user).first()
    return member.organization if member else None
