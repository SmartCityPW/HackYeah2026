from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.moderation.serializers import ModerationLogEntrySerializer
from apps.pokestops.models import ModerationLog, Verdict
from core.errors import ApiError
from core.pagination import paginate
from core.permissions import role_required
from rest_framework import status as http

DEFAULT_VERDICTS = [Verdict.REJECTED, Verdict.ERROR]


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', {field: message})


class ModerationLogView(APIView):
    """GET /admin/moderation-log: co agent AI odrzucił (albo czego nie zdołał ocenić), żeby administrator o tym wiedział."""

    permission_classes = [role_required('admin')]

    def get(self, request):
        raw = request.query_params.get('verdict')
        verdicts = [v.strip() for v in raw.split(',')] if raw else DEFAULT_VERDICTS
        unknown = [v for v in verdicts if v not in Verdict.values]
        if unknown:
            raise _invalid('verdict', f'Nieznany werdykt: {", ".join(unknown)}')
        qs = ModerationLog.objects.select_related('author', 'scenario').filter(verdict__in=verdicts).order_by('-created_at', '-id')
        since = request.query_params.get('since')
        if since:
            moment = parse_datetime(since)
            if moment is None:
                raise _invalid('since', 'Oczekiwano daty i godziny w formacie ISO 8601')
            qs = qs.filter(created_at__gt=moment)
        count, page = paginate(request, qs)
        return Response({'count': count, 'results': ModerationLogEntrySerializer(list(page), many=True).data})
