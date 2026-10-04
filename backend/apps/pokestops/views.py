from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from rest_framework import status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.game.location import Fix
from apps.pokestops import services, survey, timeline
from apps.pokestops.models import Comment, Pokestop, Status, Update, Vote
from apps.pokestops.serializers import (
    CommentRequestSerializer,
    CommentSerializer,
    NewPokestopSerializer,
    PokestopDetailSerializer,
    PokestopSerializer,
    PokestopPatchSerializer,
    SurveyResponseRequestSerializer,
    UpdatePatchSerializer,
    UpdateRequestSerializer,
    VoteRequestSerializer,
)
from core.errors import ApiError
from core.geo import parse_bbox
from core.pagination import paginate
from core.permissions import role_required


def _base_queryset():
    visible_comments = (
        Comment.objects.filter(pokestop=OuterRef('pk'), hidden_at__isnull=True).values('pokestop').annotate(c=Count('pk')).values('c')
    )
    updates = Update.objects.filter(pokestop=OuterRef('pk')).values('pokestop').annotate(c=Count('pk')).values('c')
    return (
        Pokestop.objects.select_related('scenario', 'character', 'author', 'organization')
        .prefetch_related('photos')
        .annotate(
            comment_count=Coalesce(Subquery(visible_comments, output_field=IntegerField()), 0),
            update_count=Coalesce(Subquery(updates, output_field=IntegerField()), 0),
        )
    )


def _context(request, stops) -> dict:
    """Głosy zalogowanego użytkownika dla pinezek ze strony: jedno zapytanie zamiast jednego na pinezkę."""
    ids = [s.id for s in stops]
    votes = dict(Vote.objects.filter(user=request.user, pokestop_id__in=ids).values_list('pokestop_id', 'vote'))
    return {'request': request, 'my_votes': votes}


def _page_response(request, queryset) -> Response:
    count, page = paginate(request, queryset)
    stops = list(page)
    return Response({'count': count, 'results': PokestopSerializer(stops, many=True, context=_context(request, stops)).data})


def _detail(request, stop_id: int) -> Response:
    stop = _base_queryset().filter(pk=stop_id).first()
    return Response(PokestopDetailSerializer(stop, context=_context(request, [stop])).data)


class PokestopListCreateView(APIView):
    def get(self, request):
        qs = _base_queryset().order_by('-created_at')
        wanted_status = request.query_params.get('status')
        if wanted_status == Status.REJECTED and request.user.role == Role.ADMIN:
            qs = qs.filter(status=Status.REJECTED)
        else:
            qs = qs.exclude(status=Status.REJECTED)
            if wanted_status:
                qs = qs.filter(status=wanted_status)
        if request.query_params.get('type'):
            qs = qs.filter(type=request.query_params['type'])
        if request.query_params.get('organizationId'):
            qs = qs.filter(organization_id=request.query_params['organizationId'])
        if request.query_params.get('bbox'):
            try:
                box = parse_bbox(request.query_params['bbox'])
            except ValueError as exc:
                raise ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', {'bbox': str(exc)}) from exc
            qs = qs.filter(lat__gte=box.min_lat, lat__lte=box.max_lat, lng__gte=box.min_lng, lng__lte=box.max_lng)
        return _page_response(request, qs)

    def post(self, request):
        s = NewPokestopSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        stop = services.create_pokestop(request.user, dict(s.validated_data))
        response = _detail(request, stop.id)
        response.status_code = http.HTTP_201_CREATED
        return response


class PokestopDetailView(APIView):
    def get(self, request, pk):
        stop = _base_queryset().filter(pk=pk).first()
        hidden = stop is not None and stop.status == Status.REJECTED and request.user.role != Role.ADMIN and stop.author_id != request.user.id
        if stop is None or hidden:
            raise ApiError(http.HTTP_404_NOT_FOUND, 'not_found', 'Pinezka nie istnieje')
        return Response(PokestopDetailSerializer(stop, context=_context(request, [stop])).data)

    def patch(self, request, pk):
        """Prowadzenie inicjatywy: status (administrator, organizator), treść i pola własne (organizator)."""
        s = PokestopPatchSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        timeline.manage(request.user, pk, dict(s.validated_data))
        return _detail(request, pk)


class TimelineView(APIView):
    """GET /pokestops/{id}/timeline: losy inicjatywy (najnowsze pierwsze)."""

    def get(self, request, pk):
        count, page = paginate(request, timeline.timeline(request.user, pk))
        return Response({'count': count, 'results': list(page)})


def _entry(request, pk: int, update: Update) -> dict:
    return next(e for e in timeline.timeline(request.user, pk) if e['kind'] == 'update' and e['id'] == update.id)


class UpdatesView(APIView):
    def post(self, request, pk):
        s = UpdateRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        update = timeline.add_update(request.user, pk, s.validated_data['title'], s.validated_data['body'])
        return Response(_entry(request, pk, update), status=http.HTTP_201_CREATED)


class UpdateDetailView(APIView):
    def patch(self, request, pk, update_id):
        s = UpdatePatchSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        update = timeline.edit_update(request.user, pk, update_id, s.validated_data.get('title'), s.validated_data.get('body'))
        return Response(_entry(request, pk, update))

    def delete(self, request, pk, update_id):
        timeline.delete_update(request.user, pk, update_id)
        return Response(status=http.HTTP_204_NO_CONTENT)


class VoteView(APIView):
    def post(self, request, pk):
        s = VoteRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        stop, pokemon = services.vote(
            user=request.user, pokestop_id=pk, value=d['vote'], pokemon_id=d['pokemon_id'], fix=Fix.from_position(d['position']),
        )
        from apps.collection.serializers import PokemonSerializer

        stop_data = _detail(request, stop.id).data
        return Response({'stop': stop_data, 'pokemon': PokemonSerializer(pokemon).data})


class SurveyResponsesView(APIView):
    """POST /pokestops/{id}/survey-responses: odpowiedzi na ankietę; nagrodą jest nowy pokemon gatunku inicjatywy."""

    def post(self, request, pk):
        s = SurveyResponseRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        stop, pokemon = survey.answer_survey(user=request.user, pokestop_id=pk, fix=Fix.from_position(d['position']), answers=d['answers'])
        from apps.collection.serializers import PokemonSerializer

        response = Response({'stop': _detail(request, stop.id).data, 'pokemon': PokemonSerializer(pokemon).data})
        response.status_code = http.HTTP_201_CREATED
        return response


class SurveyResultsView(APIView):
    def get(self, request, pk):
        return Response(survey.results(request.user, pk))


class WithdrawView(APIView):
    def post(self, request, pk):
        services.withdraw(request.user, pk)
        return _detail(request, pk)


class CommentsView(APIView):
    def get(self, request, pk):
        stop = Pokestop.objects.filter(pk=pk).exclude(status=Status.REJECTED).first()
        if stop is None:
            raise ApiError(http.HTTP_404_NOT_FOUND, 'not_found', 'Pinezka nie istnieje')
        top = (
            Comment.objects.filter(pokestop=stop, parent__isnull=True, hidden_at__isnull=True)
            .select_related('author')
            .prefetch_related('replies__author')
            .order_by('-created_at', '-id')
        )
        count, page = paginate(request, top)
        return Response({'count': count, 'results': CommentSerializer(list(page), many=True, context={'request': request}).data})

    def post(self, request, pk):
        s = CommentRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        comment = services.add_comment(request.user, pk, s.validated_data['text'], s.validated_data.get('parent_comment_id'))
        return Response(CommentSerializer(comment, context={'request': request}).data, status=http.HTTP_201_CREATED)


class MyInteractionsView(APIView):
    """GET /me/interactions: pinezki, które użytkownik zgłosił, ocenił albo skomentował."""

    def get(self, request):
        user = request.user
        qs = (
            _base_queryset()
            .filter(Q(author=user) | Q(votes__user=user) | Q(comments__author=user))
            .distinct()
            .order_by('-created_at')
        )
        return _page_response(request, qs)
