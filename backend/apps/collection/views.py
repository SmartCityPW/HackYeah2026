from django.db.models import Count
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.collection.models import Character, Pokemon
from apps.collection.serializers import PokemonSerializer, catalog_payload


class CatalogView(APIView):
    """GET /catalog: postacie i typy (dane statyczne, publiczne)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(catalog_payload())


class MyCollectionView(APIView):
    """GET /me/collection: liczba posiadanych sztuk każdej postaci (klucz = kod postaci)."""

    def get(self, request):
        counts = dict(
            Pokemon.objects.filter(user=request.user).values_list('character__code').annotate(n=Count('id'))
        )
        return Response({code: counts.get(code, 0) for code in Character.objects.order_by('id').values_list('code', flat=True)})


class MyPokemonsView(APIView):
    """GET /me/pokemons?availableOnly=: posiadane egzemplarze z poziomem i mocą."""

    def get(self, request):
        qs = Pokemon.objects.filter(user=request.user).select_related('character__type').order_by('id')
        if request.query_params.get('availableOnly', '').lower() in ('1', 'true'):
            qs = qs.filter(is_staked=False)
        return Response(PokemonSerializer(qs, many=True).data)
