"""Błędy w jednolitym kształcie z kontraktu: {code, message, fields?}."""
from rest_framework import exceptions, status
from rest_framework.views import exception_handler as drf_exception_handler


class ApiError(exceptions.APIException):
    """Błąd domenowy z kodem maszynowym (np. `too_far`, `own_pokestop`)."""

    def __init__(self, status_code: int, code: str, message: str, fields: dict | None = None, extra: dict | None = None):
        super().__init__(detail=message, code=code)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields
        self.extra = extra  # dodatkowe pola odpowiedzi (np. distanceM i radiusM przy `too_far`)


def too_far(distance_m: float, radius_m: float) -> ApiError:
    """Gracz stoi poza kółkiem interakcji: 422 `too_far` z odległością i promieniem (kontrakt: `TooFarError`)."""
    distance, radius = round(distance_m), round(radius_m)
    return ApiError(
        status.HTTP_422_UNPROCESSABLE_ENTITY, 'too_far', f'Jesteś za daleko ({distance} m), podejdź na mniej niż {radius} m',
        extra={'distanceM': distance, 'radiusM': radius},
    )


def not_implemented(feature: str) -> ApiError:
    return ApiError(status.HTTP_501_NOT_IMPLEMENTED, 'not_implemented', f'Funkcja jeszcze niezaimplementowana: {feature}')


def _snake_to_camel(name: str) -> str:
    head, *rest = name.split('_')
    return head + ''.join(part.title() for part in rest)


def _flatten(detail, prefix: str = '') -> dict[str, str]:
    """Spłaszcza błędy DRF do {pole: komunikat}, z nazwami pól w camelCase."""
    out: dict[str, str] = {}
    if isinstance(detail, dict):
        for key, value in detail.items():
            name = _snake_to_camel(str(key)) if not prefix else f'{prefix}.{key}'
            out.update(_flatten(value, name))
    elif isinstance(detail, list):
        if detail and all(isinstance(x, (str, exceptions.ErrorDetail)) for x in detail):
            out[prefix or 'nonFieldErrors'] = str(detail[0])
        else:
            for i, item in enumerate(detail):
                out.update(_flatten(item, f'{prefix}[{i}]' if prefix else str(i)))
    else:
        out[prefix or 'nonFieldErrors'] = str(detail)
    return out


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ApiError):
        body = {'code': exc.code, 'message': exc.message}
        if exc.fields:
            body['fields'] = exc.fields
        if exc.extra:
            body.update(exc.extra)
    elif isinstance(exc, exceptions.ValidationError):
        body = {'code': 'validation_error', 'message': 'Błędne dane', 'fields': _flatten(exc.detail)}
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY  # kontrakt: błędy walidacji to 422
    else:
        codes = {
            exceptions.NotAuthenticated: 'unauthorized',
            exceptions.AuthenticationFailed: 'unauthorized',
            exceptions.PermissionDenied: 'forbidden',
            exceptions.NotFound: 'not_found',
            exceptions.Throttled: 'too_many_requests',
            exceptions.MethodNotAllowed: 'method_not_allowed',
            exceptions.ParseError: 'bad_request',
        }
        code = next((c for cls, c in codes.items() if isinstance(exc, cls)), 'error')
        body = {'code': code, 'message': str(exc.detail)}
    response.data = body
    return response
