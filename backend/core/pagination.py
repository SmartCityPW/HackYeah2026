"""Stronicowanie zgodne z kontraktem: ?page=&pageSize= -> {count, results}."""
from __future__ import annotations

from django.conf import settings
from rest_framework.request import Request


def page_params(request: Request) -> tuple[int, int]:
    cfg = settings.APP.pokestops

    def to_int(name: str, default: int) -> int:
        try:
            return int(request.query_params.get(name, default))
        except ValueError:
            return default

    page = max(1, to_int('page', 1))
    size = min(max(1, to_int('pageSize', cfg.default_page_size)), cfg.max_page_size)
    return page, size


def paginate(request: Request, queryset_or_list):
    """Zwraca (count, wycinek strony)."""
    page, size = page_params(request)
    count = queryset_or_list.count() if hasattr(queryset_or_list, 'count') and callable(queryset_or_list.count) else len(queryset_or_list)
    start = (page - 1) * size
    return count, queryset_or_list[start:start + size]
