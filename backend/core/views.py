from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from core.errors import not_implemented


class NotImplementedView(APIView):
    """Operacja z kontraktu, której jeszcze nie zaimplementowano: jawne 501 zamiast 404.

    Użycie w urls.py: `NotImplementedView.as_view(feature='opis')`. Przy implementacji podmieniamy widok.
    """

    feature = 'operacja'
    permission_classes = [AllowAny]

    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def initial(self, request, *args, **kwargs):
        raise not_implemented(self.feature)
