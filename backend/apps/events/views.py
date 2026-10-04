from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.accounts.services import organization_of
from apps.collection.serializers import PokemonSerializer
from apps.events import services
from apps.game.location import Fix
from apps.events.models import Event, EventStatus, Participation
from apps.events.serializers import CheckInRequestSerializer, EventPatchSerializer, EventSerializer, NewEventSerializer
from core.errors import ApiError
from core.geo import parse_bbox
from core.pagination import paginate


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(http.HTTP_422_UNPROCESSABLE_ENTITY, 'validation_error', 'Błędne dane', {field: message})


def _queryset():
    return Event.objects.select_related('organization', 'reward_character').annotate(participant_count=Count('participations'))


def _context(request, events) -> dict:
    ids = [e.id for e in events]
    done = set(Participation.objects.filter(user=request.user, event_id__in=ids).values_list('event_id', flat=True))
    return {'request': request, 'checked_in': done}


def _one(request, event_id: int) -> dict:
    event = _queryset().get(pk=event_id)
    return EventSerializer(event, context=_context(request, [event])).data


def _moment(request, name: str, default):
    raw = request.query_params.get(name)
    if not raw:
        return default
    value = parse_datetime(raw)
    if value is None:
        raise _invalid(name, 'Oczekiwano daty i godziny w formacie ISO 8601')
    return value


class EventListCreateView(APIView):
    def get(self, request):
        now = timezone.now()
        start = _moment(request, 'from', now)
        end = _moment(request, 'to', now + timedelta(days=settings.APP.events.default_window_days))
        qs = _queryset().filter(ends_at__gte=start, starts_at__lte=end).order_by('starts_at', 'id')
        wanted_org = request.query_params.get('organizationId')
        # Odwołane wydarzenia widzi tylko ich organizator i administrator (na ekranie zarządzania).
        own = organization_of(request.user) if request.user.role == Role.ORG else None
        if request.user.role == Role.ADMIN:
            pass
        elif wanted_org and own is not None and str(own.id) == wanted_org:
            pass
        else:
            qs = qs.exclude(status=EventStatus.CANCELLED)
        if wanted_org:
            qs = qs.filter(organization_id=wanted_org)
        if request.query_params.get('bbox'):
            try:
                box = parse_bbox(request.query_params['bbox'])
            except ValueError as exc:
                raise _invalid('bbox', str(exc)) from exc
            qs = qs.filter(lat__gte=box.min_lat, lat__lte=box.max_lat, lng__gte=box.min_lng, lng__lte=box.max_lng)
        count, page = paginate(request, qs)
        events = list(page)
        return Response({'count': count, 'results': EventSerializer(events, many=True, context=_context(request, events)).data})

    def post(self, request):
        s = NewEventSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        event = services.create_event(request.user, dict(s.validated_data))
        return Response(_one(request, event.id), status=http.HTTP_201_CREATED)


class EventDetailView(APIView):
    def get(self, request, pk):
        event = _queryset().filter(pk=pk).first()
        hidden = event is not None and event.status == EventStatus.CANCELLED and not services.can_manage(request.user, event)
        if event is None or hidden:
            raise ApiError(http.HTTP_404_NOT_FOUND, 'not_found', 'Wydarzenie nie istnieje')
        return Response(EventSerializer(event, context=_context(request, [event])).data)

    def patch(self, request, pk):
        s = EventPatchSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.cancel_event(request.user, pk)
        return Response(_one(request, pk))


class CheckInView(APIView):
    """POST /events/{id}/check-in: rzadki pokemon za obecność na miejscu i w czasie trwania wydarzenia."""

    def post(self, request, pk):
        s = CheckInRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        event, pokemon = services.check_in(user=request.user, event_id=pk, fix=Fix.from_position(s.validated_data['position']))
        return Response({'event': _one(request, event.id), 'pokemon': PokemonSerializer(pokemon).data})
