"""Moderacja regułami (warstwa 1): deterministyczna, bez sieci i bez klucza API.

Sprawdza wulgaryzmy, mowę nienawiści, groźby, dane osobowe, spam i próby wstrzyknięcia instrukcji do AI w całej treści
zgłoszenia (tytuł, opis i wszystkie pola formularza). Listy słów i wzorce leżą w `config/moderation_rules.yaml`.
Wynik to nazwa kategorii (do logu moderacji), nigdy fragment treści. Czy zgłoszenie dotyczy miasta, ocenia dopiero AI.
"""
from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from typing import Iterator

import yaml
from django.conf import settings

CATEGORIES = ('vulgar', 'hate', 'threat', 'personal_data', 'spam', 'injection')

_LEET = str.maketrans({'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '€': 'e', 'ø': 'o', 'ł': 'l'})
_MASK = '*#%&'  # ku*wa, k#rwa: maskę próbujemy zastąpić każdą samogłoską
_VOWELS = 'aeiouy'
_URL = re.compile(r'(https?://|www\.)\S+|\b[a-z0-9-]{2,}\.(com|pl|net|org|eu|io|ru|xyz|shop|info|biz|me|tk|ly|cc|store|online|site)\b', re.I)
_EMAIL = re.compile(r'[\w.+-]+\s?(@|\(at\)|\[at\])\s?[\w-]+(\.[\w-]+)+', re.I)
_PHONE = re.compile(r'(?<![\d])(?:\+?\s?48[\s.-]?)?(?:\d[\s.-]?){8}\d(?![\d])')
_DIGITS = re.compile(r'(?<!\d)(?:\d[\s-]?){10,18}\d(?!\d)')
_SPACED = re.compile(r'(?<!\w)(?:\w[\s.\-_*]){3,}\w(?!\w)')
_REPEATED_CHAR = re.compile(r'(.)\1{7,}')


def strip_accents(text: str) -> str:
    text = text.lower().replace('ł', 'l')
    return ''.join(ch for ch in unicodedata.normalize('NFKD', text) if not unicodedata.combining(ch))


def _squash(text: str) -> str:
    """Trzy i więcej takich samych liter obok siebie -> jedna (kurwaaa -> kurwa). Podwójne (np. 'll', 'ss') zostają."""
    return re.sub(r'([a-z])\1{2,}', r'\1', text)


@lru_cache(maxsize=1)
def _rules() -> dict:
    path = settings.APP.path(settings.APP.moderation.rules_file)
    raw = yaml.safe_load(path.read_text(encoding='utf-8'))
    out = {k: dict(raw.get(k) or {}) for k in CATEGORIES}
    for section in out.values():
        section['patterns'] = [re.compile(p) for p in section.get('patterns', [])]
    return out


def reload_rules() -> None:
    _rules.cache_clear()


def _strings(value) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _strings(v)


def _wild_find(token: str, stem: str, anchored: bool) -> bool:
    """Czy `stem` występuje w `token`, gdy znak maski (*, #, %, &) pasuje do dowolnej litery (ku*wa ~ kurw)."""
    n = len(stem)
    starts = [0] if anchored else range(len(token) - n + 1)
    return any(all(t == c or t in _MASK for t, c in zip(token[i:i + n], stem)) for i in starts if i + n <= len(token))


def _word_hit(token: str, rules: dict) -> bool:
    contains, starts = rules.get('contains', []), rules.get('startswith', [])
    if any(m in token for m in _MASK):
        if len(token) < 4:
            return False
        return any(_wild_find(token, c, False) for c in contains) or any(_wild_find(token, s, True) for s in starts)
    return any(c in token for c in contains) or any(token.startswith(s) for s in starts)


def _normalised_tokens(text: str) -> list[str]:
    base = strip_accents(text)
    tokens = []
    for v_as in ('w', 'u'):  # "kurva" (v jak w) i "kvrwa" (v jak u)
        plain = _squash(base.replace('v', v_as).translate(_LEET))
        tokens += re.findall(r'[a-z*#%&]+', plain)
        if 'v' not in base:
            break
    return tokens


def _check_vulgar_hate(text: str, category: str, rules: dict) -> bool:
    tokens = _normalised_tokens(text)
    # litery rozdzielone odstępami lub kropkami (k u r w a, k.u.r.w.a) sklejamy w jedno słowo
    for run in _SPACED.findall(strip_accents(text)):
        tokens.append(re.sub(r'[^a-z0-9]', '', _squash(run.translate(_LEET))))
    for token in tokens:
        if _word_hit(token, rules):
            return True
    # frazy bez spacji ("heil hitler" -> "heilhitler") sprawdzamy na tekście sklejonym
    glued = ''.join(tokens)
    return any(c in glued for c in rules.get('contains', []) if len(c) >= 8)


def _luhn(number: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(number)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d * 2 > 9 else d * 2
        total += d
    return total % 10 == 0


def _pesel(number: str) -> bool:
    if len(number) != 11:
        return False
    weights = (1, 3, 7, 9, 1, 3, 7, 9, 1, 3)
    return (10 - sum(int(a) * w for a, w in zip(number, weights)) % 10) % 10 == int(number[10])


def _personal_data(text: str, rules: dict) -> bool:
    if _EMAIL.search(text) or _PHONE.search(text):
        return True
    for match in _DIGITS.finditer(text):
        digits = re.sub(r'\D', '', match.group())
        if _pesel(digits) or (13 <= len(digits) <= 19 and _luhn(digits)):
            return True
    plain = strip_accents(text)
    return any(p.search(plain) for p in rules['patterns'])


def _spam(text: str, rules: dict) -> bool:
    if _URL.search(text) or _REPEATED_CHAR.search(text):
        return True
    words = re.findall(r'\w+', text.lower())
    if len(words) >= 6 and any(words.count(w) >= 5 and len(w) > 2 for w in set(words)):
        return True
    plain = strip_accents(text)
    glued = re.sub(r'[^a-z0-9]', '', plain)
    return any(c in glued for c in rules.get('contains', [])) or any(p.search(plain) for p in rules['patterns'])


def _patterns(text: str, rules: dict) -> bool:
    plain = _squash(strip_accents(text))
    return any(p.search(plain) for p in rules['patterns'])


def inspect_text(text: str) -> str | None:
    """Pierwsza kategoria naruszenia znaleziona w tekście albo None."""
    if not text or not text.strip():
        return None
    rules = _rules()
    if _check_vulgar_hate(text, 'vulgar', rules['vulgar']):
        return 'vulgar'
    if _check_vulgar_hate(text, 'hate', rules['hate']) or _patterns(text, rules['hate']):
        return 'hate'
    if _patterns(text, rules['threat']):
        return 'threat'
    if _personal_data(text, rules['personal_data']):
        return 'personal_data'
    if _spam(text, rules['spam']):
        return 'spam'
    if _patterns(text, rules['injection']):
        return 'injection'
    return None


def inspect_submission(submission) -> str | None:
    """Sprawdza każdy tekst zgłoszenia osobno i razem (zdanie rozbite na pola też ma się nie przemycić)."""
    texts = [s for s in _strings(submission) if s]
    for text in texts:
        hit = inspect_text(text)
        if hit:
            return hit
    return inspect_text('\n'.join(texts)) if len(texts) > 1 else None
