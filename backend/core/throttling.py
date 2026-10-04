from rest_framework.throttling import AnonRateThrottle


class GuestCreationThrottle(AnonRateThrottle):
    """Limit zakładania kont gościa na adres IP (wartość `auth.guest_rate` z konfiguracji)."""

    scope = 'guest'


class LoginThrottle(AnonRateThrottle):
    """Limit prób logowania i rejestracji na adres IP (`auth.login_rate`): utrudnia zgadywanie haseł."""

    scope = 'login'
