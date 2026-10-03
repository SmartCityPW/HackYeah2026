"""Kod kontra dokumentacja: trasy z openapi.yaml i tabele/kolumny ze schema.sql."""
import re

import pytest
from django.apps import apps
from django.conf import settings

from core.contract.openapi import classify, load_spec
from tests.conftest import client_for

try:
    SPEC = load_spec()
except FileNotFoundError:  # np. obraz Dockera bez katalogu docs/
    SPEC = None

needs_docs = pytest.mark.skipif(SPEC is None, reason='brak docs/openapi.yaml w tym środowisku')


@needs_docs
def test_every_contract_operation_has_a_route():
    missing = [f'{o.method} {o.path}' for o in classify(SPEC) if o.status == 'missing']
    assert not missing, f'Operacje z openapi.yaml bez trasy: {missing}'


@needs_docs
@pytest.mark.django_db
def test_unimplemented_operations_answer_501_with_error_shape(resident):
    stubs = [o for o in classify(SPEC) if o.status == 'stub']
    assert stubs, 'oczekiwano jeszcze kilku atrap (ankiety, wydarzenia, walka)'
    client = client_for(resident)
    prefix = settings.APP.app.api_prefix.strip('/')
    for o in stubs:
        url = f'/{prefix}' + re.sub(r'\{\w+\}', '1', o.path)
        response = getattr(client, o.method.lower())(url, {}, format='json')
        assert response.status_code == 501, f'{o.method} {o.path}'
        assert response.data['code'] == 'not_implemented'


@needs_docs
def test_contract_status_command_runs(capsys):
    from django.core.management import call_command

    call_command('contract_status')
    assert 'Zaimplementowano' in capsys.readouterr().out


# ───────────── schema.sql ─────────────

SCHEMA = settings.APP.path(settings.APP.contract.schema_sql_file)
needs_schema = pytest.mark.skipif(not SCHEMA.is_file(), reason='brak docs/db/schema.sql w tym środowisku')

# Jedyne dozwolone różnice kolumn między modelami a schema.sql (świadome, patrz docs/db/README.md):
#  * location (geography) w DDL, a w Django lat + lng (bez GeoDjango/GDAL),
#  * zastępczy klucz `id` w tabelach, które w DDL mają klucz złożony,
#  * kolumna pokestop_id w odpowiedziach ankiety (w DDL potrzebna do złożonych kluczy obcych).
ALLOWED = {
    'location': {'lat', 'lng'},
}
ALLOWED_DJANGO_ONLY = {
    'accounts_organization_member': {'id'}, 'events_participation': {'id'}, 'game_attack_pokemon': {'id'},
    'pokestops_survey_answer': {'id'}, 'pokestops_vote': {'id'},
}
ALLOWED_DDL_ONLY = {'pokestops_survey_answer': {'pokestop_id'}}


def _ddl_columns() -> dict[str, set[str]]:
    import pglast
    from pglast import ast

    out = {}
    for stmt in pglast.parse_sql(SCHEMA.read_text(encoding='utf-8')):
        s = stmt.stmt
        if isinstance(s, ast.CreateStmt):
            out[s.relation.relname] = {e.colname for e in s.tableElts if isinstance(e, ast.ColumnDef)}
    return out


def _model_columns() -> dict[str, set[str]]:
    labels = {'accounts', 'collection', 'scenarios', 'pokestops', 'events', 'game'}
    return {m._meta.db_table: {f.column for f in m._meta.concrete_fields} for m in apps.get_models() if m._meta.app_label in labels}


@needs_schema
def test_every_table_in_schema_sql_has_a_model_and_vice_versa():
    pytest.importorskip('pglast')
    ddl, models = _ddl_columns(), _model_columns()
    assert set(ddl) == set(models), f'tylko w DDL: {set(ddl) - set(models)}, tylko w Django: {set(models) - set(ddl)}'


@needs_schema
def test_columns_match_schema_sql_except_documented_differences():
    pytest.importorskip('pglast')
    ddl, models = _ddl_columns(), _model_columns()
    problems = []
    for table in sorted(ddl):
        ddl_only = ddl[table] - models[table]
        django_only = models[table] - ddl[table]
        for geo, replacement in ALLOWED.items():
            if geo in ddl_only and replacement <= django_only:
                ddl_only.discard(geo)
                django_only -= replacement
        ddl_only -= ALLOWED_DDL_ONLY.get(table, set())
        django_only -= ALLOWED_DJANGO_ONLY.get(table, set())
        if ddl_only or django_only:
            problems.append(f'{table}: tylko DDL={sorted(ddl_only)}, tylko Django={sorted(django_only)}')
    assert not problems, 'Modele i schema.sql się rozjechały:\n' + '\n'.join(problems)
