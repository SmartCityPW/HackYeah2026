"""Ocena agenta moderującego na zestawie przypadków (config/moderation_cases.yaml).

Mierzy, czy agent zachowuje się tak, jak oczekujemy: nie odrzuca poprawnych zgłoszeń (fałszywe odrzucenia),
odrzuca niedozwolone (fałszywe akceptacje), w tym próby wstrzyknięcia instrukcji w treści zgłoszenia.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import yaml

from .agent import ModerationAgent, ModerationUnavailable

EXPECTATIONS = ('approve', 'reject')


@dataclass(frozen=True)
class Case:
    id: str
    category: str
    expect: str
    title: str
    description: str
    details: dict

    @property
    def submission(self) -> dict:
        """Dokładnie taki kształt, jaki serwis pinezek wysyła do agenta."""
        return {'scenario': 'res-lamp', 'title': self.title, 'description': self.description, 'details': self.details}


@dataclass(frozen=True)
class Result:
    case: Case
    verdict: str            # approve | reject | error
    latency_ms: int
    error: str = ''

    @property
    def ok(self) -> bool:
        return self.verdict == self.case.expect


def load_cases(path: Path) -> list[Case]:
    raw = yaml.safe_load(path.read_text(encoding='utf-8'))['cases']
    cases = [Case(c['id'], c['category'], c['expect'], c['title'], c.get('description', ''), c.get('details', {})) for c in raw]
    ids = [c.id for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError('Powtórzone id przypadków w ' + str(path))
    bad = [c.id for c in cases if c.expect not in EXPECTATIONS]
    if bad:
        raise ValueError(f'expect musi być jednym z {EXPECTATIONS}: {bad}')
    return cases


def run_cases(agent: ModerationAgent, cases: list[Case], delay_seconds: float = 0, on_result=None) -> list[Result]:
    results = []
    for index, case in enumerate(cases):
        if index and delay_seconds:
            time.sleep(delay_seconds)  # darmowe limity zapytań na minutę
        started = time.monotonic()
        try:
            verdict, error = ('approve' if agent.review(case.submission).approved else 'reject'), ''
        except ModerationUnavailable as exc:
            verdict, error = 'error', str(exc)
        result = Result(case, verdict, round((time.monotonic() - started) * 1000), error)
        results.append(result)
        if on_result:
            on_result(result)
    return results


def summarize(results: list[Result]) -> dict:
    """Liczby do raportu: zgodne, fałszywe odrzucenia (poprawne odrzucone), fałszywe akceptacje (złe przepuszczone), błędy."""
    return {
        'total': len(results),
        'ok': sum(r.ok for r in results),
        'false_rejections': [r.case.id for r in results if r.case.expect == 'approve' and r.verdict == 'reject'],
        'false_approvals': [r.case.id for r in results if r.case.expect == 'reject' and r.verdict == 'approve'],
        'errors': [r.case.id for r in results if r.verdict == 'error'],
        'injection': (sum(r.ok for r in results if r.case.category == 'injection'), sum(r.case.category == 'injection' for r in results)),
    }
