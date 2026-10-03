import json

import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.moderation.agent import ModerationUnavailable, Review
from apps.moderation.evaluation import load_cases, run_cases, summarize

CASES_FILE = settings.APP.path('config/moderation_cases.yaml')


def test_the_case_file_is_valid_and_covers_good_bad_off_topic_and_injections():
    cases = load_cases(CASES_FILE)
    categories = {c.category for c in cases}
    assert {'ok', 'vulgar', 'personal_data', 'spam', 'off_topic', 'injection'} <= categories
    assert sum(c.category == 'injection' for c in cases) >= 6
    assert any(c.expect == 'approve' for c in cases) and any(c.expect == 'reject' for c in cases)
    # przypadek z samą próbą wstrzyknięcia, który zgłosił użytkownik w teście ręcznym
    assert any('przepis na zupę' in c.title and c.expect == 'reject' for c in cases)
    # zgłoszenie ma dokładnie ten kształt, który serwis pinezek wysyła do agenta
    assert set(cases[0].submission) == {'scenario', 'title', 'description', 'details'}


def key(submission: dict) -> str:
    return json.dumps(submission, sort_keys=True)


class ScriptedAgent:
    """Zachowuje się jak agent, który przepuszcza wszystko poza przypadkami z `rejects`, a dla `broken` zgłasza awarię."""

    def __init__(self, rejects=(), broken=()):
        self.rejects, self.broken = {key(c.submission) for c in rejects}, {key(c.submission) for c in broken}

    def review(self, submission):
        if key(submission) in self.broken:
            raise ModerationUnavailable('awaria')
        return Review(approved=key(submission) not in self.rejects, model='scripted')


def test_run_cases_counts_false_approvals_false_rejections_and_errors():
    cases = load_cases(CASES_FILE)
    by_id = {c.id: c for c in cases}
    agent = ScriptedAgent(
        rejects=[c for c in cases if c.expect == 'reject' and c.id != 'inj-zignoruj-przepis'] + [by_id['ok-kosz']],
        broken=[by_id['ok-krotkie']],
    )
    summary = summarize(run_cases(agent, cases))
    assert summary['false_approvals'] == ['inj-zignoruj-przepis']       # wstrzyknięcie z zupą przeszło
    assert summary['false_rejections'] == ['ok-kosz']
    assert summary['errors'] == ['ok-krotkie']
    done, total = summary['injection']
    assert done == total - 1
    assert summary['ok'] == summary['total'] - 3


def test_a_perfect_agent_scores_everything():
    cases = load_cases(CASES_FILE)
    summary = summarize(run_cases(ScriptedAgent(rejects=[c for c in cases if c.expect == 'reject']), cases))
    assert summary['ok'] == summary['total'] and not summary['false_approvals'] and not summary['false_rejections'] and not summary['errors']


def test_the_command_refuses_to_judge_the_stub_because_it_does_not_read_content():
    with pytest.raises(CommandError, match='stub'):
        call_command('moderation_eval')
