from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.game import services
from apps.game.serializers import AttackRequestSerializer, EncounterQuerySerializer, EncounterSerializer
from apps.game.services import progress_payload


class MyProgressView(APIView):
    """GET /me/progress: poziom i doświadczenie gracza."""

    def get(self, request):
        return Response(progress_payload(request.user))


class EncounterListView(APIView):
    """GET /encounters?lat=&lng=&radius=: najbliżsi przeciwnicy w kółku (promień przycięty do `max_radius_m`)."""

    def get(self, request):
        q = EncounterQuerySerializer(data=request.query_params)
        q.is_valid(raise_exception=True)
        cfg = settings.APP.game.encounters
        radius = min(q.validated_data.get('radius', cfg.default_radius_m), cfg.max_radius_m)
        encounters = services.encounters_near(q.validated_data['lat'], q.validated_data['lng'], radius)
        return Response(EncounterSerializer(encounters, many=True).data)


class AttackView(APIView):
    """POST /encounters/{id}/attack: walka rozstrzygana przez serwer."""

    def post(self, request, pk):
        s = AttackRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        req = services.AttackRequest(lat=d['lat'], lng=d['lng'], pokemon_ids=d['pokemon_ids'], accuracy_m=d.get('accuracy_m'), client_time=d.get('client_time'))
        return Response(services.attack(user=request.user, encounter_id=pk, req=req))
