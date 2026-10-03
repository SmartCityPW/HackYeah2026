"""Ankiety przy inicjatywach organizacji: odpowiedzi, nagroda i wyniki."""
import pytest

from apps.collection.models import Pokemon, PokemonOrigin
from apps.pokestops.models import SurveyResponse
from tests.conftest import FAR, NEAR, RYNEK, at, client_for

pytestmark = pytest.mark.django_db
URL = '/api/v1/pokestops'
QUESTIONS = [
    {'key': 'support', 'label': 'Czy popierasz?', 'type': 'boolean'},
    {'key': 'where', 'label': 'Gdzie sadzić?', 'type': 'choice', 'options': [{'value': 'a', 'label': 'Rynek'}, {'value': 'b', 'label': 'Park'}]},
    {'key': 'picks', 'label': 'Co ważne?', 'type': 'multiselect', 'options': [{'value': 'shade', 'label': 'Cień'}, {'value': 'noise', 'label': 'Cisza'}], 'required': False},
    {'key': 'rate', 'label': 'Ocena pomysłu', 'type': 'rating'},
    {'key': 'budget', 'label': 'Ile zł?', 'type': 'number', 'min': 0, 'max': 1000, 'required': False},
    {'key': 'why', 'label': 'Dlaczego?', 'type': 'textarea', 'required': False},
]
ORG_PAYLOAD = {
    'scenarioCode': 'org-tree', 'title': 'Nasadzenie lip', 'lat': RYNEK[0], 'lng': RYNEK[1], 'position': at(*RYNEK), 'character': 'tree',
    'details': {'plantingType': 'new', 'species': 'linden', 'count': 5, 'rationale': 'Cień', 'contactPerson': 'Anna', 'contactEmail': 'a@b.pl'},
    'questions': QUESTIONS,
}
GOOD = {'support': True, 'where': 'a', 'rate': 4, 'picks': ['shade'], 'budget': 250, 'why': 'Bo cień'}


@pytest.fixture
def survey(make_org):
    owner, org = make_org()
    stop = client_for(owner).post(URL, ORG_PAYLOAD, format='json').data
    assert stop['character'] == 'tree'
    return owner, stop


def submit(user, stop_id, answers=None, where=NEAR):
    return client_for(user).post(f'{URL}/{stop_id}/survey-responses', {'position': at(*where), 'answers': GOOD if answers is None else answers}, format='json')


def test_answering_grants_a_new_pokemon_of_the_stops_species(survey, resident):
    _, stop = survey
    before = Pokemon.objects.filter(user=resident).count()
    ok = submit(resident, stop['id'])
    assert ok.status_code == 201, ok.data
    assert ok.data['pokemon']['character'] == 'tree' and ok.data['stop']['surveyAnswered'] is True
    assert Pokemon.objects.filter(user=resident).count() == before + 1
    assert Pokemon.objects.get(pk=ok.data['pokemon']['id']).origin == PokemonOrigin.SURVEY
    assert client_for(resident).get(f'{URL}/{stop["id"]}').data['surveyAnswered'] is True


def test_one_answer_per_user_and_no_second_reward(survey, resident):
    _, stop = survey
    submit(resident, stop['id'])
    again = submit(resident, stop['id'])
    assert again.status_code == 409 and again.data['code'] == 'already_answered'
    assert Pokemon.objects.filter(user=resident, origin=PokemonOrigin.SURVEY).count() == 1


def test_answering_requires_being_in_the_circle(survey, resident):
    _, stop = survey
    far = submit(resident, stop['id'], where=FAR)
    assert far.status_code == 422 and far.data['code'] == 'too_far' and far.data['radiusM'] == 50
    assert not SurveyResponse.objects.exists() and Pokemon.objects.filter(user=resident, origin=PokemonOrigin.SURVEY).count() == 0


@pytest.mark.parametrize('answers, bad_key', [
    ({**GOOD, 'support': 'tak'}, 'support'),
    ({**GOOD, 'where': 'zzz'}, 'where'),
    ({**GOOD, 'picks': ['shade', 'zzz']}, 'picks'),
    ({**GOOD, 'rate': 6}, 'rate'),
    ({**GOOD, 'budget': 5000}, 'budget'),
    ({**GOOD, 'why': 12}, 'why'),
    ({k: v for k, v in GOOD.items() if k != 'rate'}, 'rate'),
    ({**GOOD, 'obce': 'x'}, 'obce'),
])
def test_answers_are_validated_against_the_questions(survey, resident, answers, bad_key):
    _, stop = survey
    bad = submit(resident, stop['id'], answers)
    assert bad.status_code == 422 and bad_key in bad.data['fields']
    assert not SurveyResponse.objects.exists()


def test_optional_questions_can_be_skipped(survey, resident):
    _, stop = survey
    assert submit(resident, stop['id'], {'support': False, 'where': 'b', 'rate': 1}).status_code == 201


def test_only_residents_answer_and_only_org_stops_with_questions(survey, make_org, admin, resident):
    other_org, _ = make_org()
    owner, stop = survey
    for user in (owner, other_org, admin):
        assert submit(user, stop['id']).status_code == 403
    plain = client_for(resident).post(URL, {'scenarioCode': 'place-chill', 'title': 'Ławka', 'lat': RYNEK[0], 'lng': RYNEK[1], 'position': at(*RYNEK),
                                            'details': {'rating': '4', 'cost': 'free', 'vibes': ['friends'], 'bestTime': ['evening'], 'accessible': True}}, format='json')
    assert plain.status_code == 201, plain.data
    assert submit(resident, plain.data['id']).status_code == 404
    assert submit(resident, 9999).status_code == 404


def test_survey_closes_when_the_organizer_resolves_the_initiative(survey, resident):
    owner, stop = survey
    client_for(owner).patch(f'{URL}/{stop["id"]}', {'status': 'resolved', 'note': 'Konsultacje zakończone'}, format='json')
    closed = submit(resident, stop['id'])
    assert closed.status_code == 409 and closed.data['code'] == 'survey_closed'


def test_results_aggregate_answers_for_the_owner_and_admin_only(survey, make_resident, resident, make_org, admin):
    owner, stop = survey
    other = make_resident('drugi')
    submit(resident, stop['id'])
    submit(other, stop['id'], {'support': False, 'where': 'a', 'rate': 2, 'budget': 100, 'picks': ['shade', 'noise'], 'why': 'Hałas'})

    for allowed in (owner, admin):
        r = client_for(allowed).get(f'{URL}/{stop["id"]}/survey-results')
        assert r.status_code == 200
        by_key = {q['key']: q for q in r.data['questions']}
        assert r.data['responseCount'] == 2
        assert by_key['support']['counts'] == {'true': 1, 'false': 1}
        assert by_key['where']['counts'] == {'a': 2, 'b': 0}
        assert by_key['picks']['counts'] == {'shade': 2, 'noise': 1}
        assert by_key['rate']['average'] == 3.0 and by_key['budget']['average'] == 175.0
        assert by_key['why']['texts'] == ['Hałas', 'Bo cień'] and by_key['why']['answered'] == 2

    foreign, _ = make_org()
    for denied in (resident, foreign):
        assert client_for(denied).get(f'{URL}/{stop["id"]}/survey-results').status_code == 403


def test_survey_limits_come_from_config_and_keys_must_be_unique(make_org, monkeypatch):
    from dataclasses import replace

    from django.conf import settings

    owner, _ = make_org()
    dup = client_for(owner).post(URL, {**ORG_PAYLOAD, 'questions': [QUESTIONS[0], QUESTIONS[0]]}, format='json')
    assert dup.status_code == 422 and 'questions' in dup.data['fields']

    survey_cfg = replace(settings.APP.pokestops.survey, max_questions=2)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, pokestops=replace(settings.APP.pokestops, survey=survey_cfg)))
    too_many = client_for(owner).post(URL, {**ORG_PAYLOAD, 'questions': QUESTIONS[:3]}, format='json')
    assert too_many.status_code == 422 and 'questions' in too_many.data['fields']
    assert client_for(owner).post(URL, {**ORG_PAYLOAD, 'questions': QUESTIONS[:2]}, format='json').status_code == 201


def test_text_answer_length_limit_comes_from_config(survey, resident, monkeypatch):
    from dataclasses import replace

    from django.conf import settings

    _, stop = survey
    survey_cfg = replace(settings.APP.pokestops.survey, text_max_length=5)
    monkeypatch.setattr(settings, 'APP', replace(settings.APP, pokestops=replace(settings.APP.pokestops, survey=survey_cfg)))
    bad = submit(resident, stop['id'], {**GOOD, 'why': 'za długi tekst'})
    assert bad.status_code == 422 and 'why' in bad.data['fields']
