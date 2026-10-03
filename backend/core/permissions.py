"""Uprawnienia oparte na roli użytkownika (resident, org, admin)."""
from rest_framework.permissions import BasePermission


def role_required(*roles: str) -> type[BasePermission]:
    class _RoleRequired(BasePermission):
        message = 'Rola nie ma uprawnień do tej operacji'

        def has_permission(self, request, view):
            user = request.user
            return bool(user and user.is_authenticated and user.role in roles)

    _RoleRequired.__name__ = f'RoleRequired_{"_".join(roles)}'
    return _RoleRequired
