from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.scenarios.models import Audience, Scenario
from apps.scenarios.serializers import ScenarioSerializer


class ScenarioListView(APIView):
    """GET /scenarios?category=: katalog formularzy dla roli (mieszkaniec: resident, organizacja: org, administrator: wszystkie)."""

    def get(self, request):
        qs = Scenario.objects.filter(is_active=True).select_related('default_character').prefetch_related('sections__fields__options')
        if request.user.role == Role.RESIDENT:
            qs = qs.filter(audience=Audience.RESIDENT)
        elif request.user.role == Role.ORG:
            qs = qs.filter(audience=Audience.ORG)
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return Response(ScenarioSerializer(qs, many=True).data)
