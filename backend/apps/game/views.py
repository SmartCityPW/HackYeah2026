from rest_framework.response import Response
from rest_framework.views import APIView

from apps.game.services import progress_payload


class MyProgressView(APIView):
    """GET /me/progress: poziom i doświadczenie gracza."""

    def get(self, request):
        return Response(progress_payload(request.user))
