from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.game import services
from apps.game.location import Fix
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
        d = q.validated_data
        fix = Fix(lat=d['lat'], lng=d['lng'], accuracy_m=d.get('accuracy_m'), taken_at=d.get('taken_at'), source=d['source'])
        encounters = services.encounters_near(request.user, fix, radius)
        return Response(EncounterSerializer(encounters, many=True).data)


class AttackView(APIView):
    """POST /encounters/{id}/attack: walka rozstrzygana przez serwer."""

    def post(self, request, pk):
        s = AttackRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        fix = Fix(lat=d['lat'], lng=d['lng'], accuracy_m=d.get('accuracy_m'), taken_at=d.get('client_time'), source=d['source'])
        req = services.AttackRequest(fix=fix, pokemon_ids=d['pokemon_ids'])
        return Response(services.attack(user=request.user, encounter_id=pk, req=req))
