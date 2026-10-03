from rest_framework.throttling import AnonRateThrottle


class GuestCreationThrottle(AnonRateThrottle):
    """Limit zakładania kont gościa na adres IP (wartość `auth.guest_rate` z konfiguracji)."""

    scope = 'guest'
