"""Porównanie kodu z kontraktem (docs/openapi.yaml): które operacje mają trasę, a które są jeszcze atrapą (501)."""
from __future__ import annotations

import re
from dataclasses import dataclass

import yaml
from django.conf import settings
from django.urls import Resolver404, resolve

from core.views import NotImplementedView

METHODS = ('get', 'post', 'put', 'patch', 'delete')
PLACEHOLDER = {'id': '1', 'code': 'x'}


@dataclass(frozen=True)
class Operation:
    method: str
    path: str
    status: str  # implemented | stub | missing


def load_spec() -> dict:
    path = settings.APP.path(settings.APP.contract.openapi_file)
    return yaml.safe_load(path.read_text(encoding='utf-8'))


def _url(path: str) -> str:
    prefix = settings.APP.app.api_prefix.strip('/')
    return f'/{prefix}' + re.sub(r'\{(\w+)\}', lambda m: PLACEHOLDER.get(m.group(1), '1'), path)


def classify(spec: dict | None = None) -> list[Operation]:
    spec = spec or load_spec()
    result = []
    for path, item in spec['paths'].items():
        for method in (m for m in item if m in METHODS):
            try:
                view_class = resolve(_url(path)).func.cls
            except Resolver404:
                result.append(Operation(method.upper(), path, 'missing'))
                continue
            if issubclass(view_class, NotImplementedView):
                result.append(Operation(method.upper(), path, 'stub'))
            elif callable(getattr(view_class, method, None)):
                result.append(Operation(method.upper(), path, 'implemented'))
            else:
                result.append(Operation(method.upper(), path, 'missing'))
    return result
