#!/usr/bin/env python3
"""Przechodzi przez działające API krok po kroku i sprawdza wyniki (test "z zewnątrz", jak zrobi to frontend).

Uruchomienie (serwer musi działać):  python scripts/api_walkthrough.py
Adres API: zmienna API_URL, a gdy jej nie ma, składany z konfiguracji (server.port i app.api_prefix).
Opcjonalnie DEMO_PASSWORD: dodatkowo loguje administratora z danych demo (manage.py seed_demo).
Nic poza biblioteką standardową Pythona nie jest potrzebne.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.config import get_config  # noqa: E402

cfg = get_config()
API = os.environ.get('API_URL') or f'http://localhost:{cfg.server.port}/{cfg.app.api_prefix.strip("/")}'
LAT = float(os.environ.get('WALK_LAT', '50.0617'))  # punkt, w którym powstaje testowa pinezka (Rynek)
LNG = float(os.environ.get('WALK_LNG', '19.9373'))
NEAR = (LAT + 0.0001, LNG)   # ok. 11 m od pinezki
FAR = (LAT + 0.01, LNG)      # ok. 1,1 km od pinezki
HERE = {'lat': LAT, 'lng': LNG}  # pozycja gracza przy tworzeniu pinezki (stoi w tym samym miejscu)

steps = {'ok': 0, 'fail': 0}


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, object]:
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        return error.code, json.loads(raw) if raw else None
    except urllib.error.URLError as error:
        sys.exit(f'Nie można połączyć się z {API}: {error.reason}\nCzy backend działa? (python manage.py runserver)')


def check(title: str, condition: bool, detail: object = '') -> None:
    steps['ok' if condition else 'fail'] += 1
    print(f'  {"✔" if condition else "✘"} {title}' + ('' if condition else f'\n      otrzymano: {detail}'))


def section(title: str) -> None:
    print(f'\n{title}')


def guest() -> tuple[str, dict]:
    status, tokens = call('POST', '/auth/guest')
    assert status == 201, f'/auth/guest -> {status}: {tokens}'
    return tokens['access'], call('GET', '/me', token=tokens['access'])[1]


print(f'API: {API}')

section('1. Słowniki (publiczne, bez logowania)')
status, catalog = call('GET', '/catalog')
check('GET /catalog zwraca postacie i typy', status == 200 and len(catalog['characters']) >= 5 and len(catalog['types']) >= 5, catalog)

section('2. Konto gościa dostaje pokemona startowego')
author, me = guest()
check('POST /auth/guest + GET /me: gość z rolą resident', me['isGuest'] and me['role'] == 'resident', me)
pokemons = call('GET', '/me/pokemons', token=author)[1]
check('ma dokładnie jednego pokemona (poziom 1)', len(pokemons) == 1 and pokemons[0]['level'] == 1, pokemons)
check('GET /me/progress: poziom 1, 0 XP', call('GET', '/me/progress', token=author)[1]['xp'] == 0)
scenarios = call('GET', '/scenarios', token=author)[1]
check('GET /scenarios: katalog mieszkańca (3 kategorie)', {s['category'] for s in scenarios} == {'problem', 'initiative', 'place'}, len(scenarios))

section('3. Zgłoszenie problemu z zastawem pokemona')
status, stop = call('POST', '/pokestops', {'scenarioCode': 'res-pothole', 'title': 'Dziura (test skryptu)', 'description': 'Testowa dziura',
                                          'lat': LAT, 'lng': LNG, 'position': HERE, 'stakedPokemonId': pokemons[0]['id']}, token=author)
check('POST /pokestops: 201, status open, postać = gatunek zastawionego pokemona', status == 201 and stop['status'] == 'open' and stop['character'] == pokemons[0]['character'], stop)
check('zastawiony pokemon jest zablokowany do walki', call('GET', '/me/pokemons?availableOnly=true', token=author)[1] == [])
check('te same zastaw drugi raz: 409 pokemon_unavailable', call('POST', '/pokestops', {'scenarioCode': 'res-pothole', 'title': 'Drugie', 'lat': LAT, 'lng': LNG, 'position': HERE, 'stakedPokemonId': pokemons[0]['id']}, token=author)[1].get('code') == 'pokemon_unavailable')
# cool miejsce nie wymaga zastawu, więc o odrzuceniu decyduje wyłącznie moderacja
status, rejected = call('POST', '/pokestops', {'scenarioCode': 'place-food', 'title': f'Test {cfg.moderation.stub.reject_marker}', 'lat': LAT, 'lng': LNG, 'position': HERE,
                                              'details': {'rating': '4', 'cost': 'cheap'}}, token=author)
if cfg.moderation.provider == 'stub':
    check('moderacja AI (tryb stub) odrzuca treść ze znacznikiem: 422 moderation_rejected', status == 422 and rejected['code'] == 'moderation_rejected', rejected)

section('4. Głosowanie tylko z bliska')
voter, _ = guest()
voter_pokemon = call('GET', '/me/pokemons', token=voter)[1][0]
vote = {'vote': 'for', 'pokemonId': voter_pokemon['id']}
status, body = call('POST', f'/pokestops/{stop["id"]}/vote', {**vote, 'position': {'lat': FAR[0], 'lng': FAR[1]}}, token=voter)
check('z odległości ~1,1 km: 422 too_far z odległością i promieniem', status == 422 and body['code'] == 'too_far' and body['radiusM'] == cfg.game.interaction_range_m, body)
status, body = call('POST', f'/pokestops/{stop["id"]}/vote', {**vote, 'position': {'lat': NEAR[0], 'lng': NEAR[1]}}, token=voter)
exp_gain = cfg.game.exp.per_vote
check(f'z odległości ~11 m: 200, głos zapisany, wybrany pokemon dostaje +{exp_gain} exp', status == 200 and body['stop']['votesFor'] == 1 and body['pokemon']['exp'] == exp_gain, body)
check('drugi głos tego samego użytkownika: 409 already_voted', call('POST', f'/pokestops/{stop["id"]}/vote', {**vote, 'position': {'lat': NEAR[0], 'lng': NEAR[1]}}, token=voter)[1].get('code') == 'already_voted')
own = call('POST', f'/pokestops/{stop["id"]}/vote', {'vote': 'for', 'pokemonId': pokemons[0]['id'], 'position': {'lat': NEAR[0], 'lng': NEAR[1]}}, token=author)[1]
check('autor nie głosuje na własną pinezkę: 403 own_pokestop', own.get('code') == 'own_pokestop', own)

section('5. Dyskusja')
status, comment = call('POST', f'/pokestops/{stop["id"]}/comments', {'text': 'Potwierdzam, dziura jest groźna'}, token=voter)
check('POST comments: 201', status == 201, comment)
status, reply = call('POST', f'/pokestops/{stop["id"]}/comments', {'text': 'Dzięki!', 'parentCommentId': comment['id']}, token=author)
check('odpowiedź na komentarz: 201', status == 201, reply)
thread = call('GET', f'/pokestops/{stop["id"]}/comments?pageSize=10', token=author)[1]
check('GET comments: 1 komentarz nadrzędny z 1 odpowiedzią (stronicowane)', thread['count'] == 1 and len(thread['results'][0]['replies']) == 1, thread)

section('6. Mapa i "moje inicjatywy"')
listed = call('GET', f'/pokestops?bbox={LNG - 0.01},{LAT - 0.01},{LNG + 0.01},{LAT + 0.01}', token=voter)[1]
mine = next((p for p in listed['results'] if p['id'] == stop['id']), None)
check('GET /pokestops?bbox=: pinezka jest na liście, z moim głosem i licznikiem komentarzy', mine and mine['myVote'] == 'for' and mine['commentCount'] == 2, mine)
check('GET /me/interactions: pinezka, na którą zagłosowałem', any(p['id'] == stop['id'] for p in call('GET', '/me/interactions', token=voter)[1]['results']))

section('7. Wycofanie zgłoszenia zwraca pokemona')
status, withdrawn = call('POST', f'/pokestops/{stop["id"]}/withdraw', token=author)
check('POST withdraw: status rejected', status == 200 and withdrawn['status'] == 'rejected', withdrawn)
back = call('GET', '/me/pokemons?availableOnly=true', token=author)[1]
check('pokemon wrócił do autora (bez premii exp)', len(back) == 1 and back[0]['exp'] == 0, back)

section('8. Walka')
radius = cfg.game.encounters.max_radius_m
status, enemies = call('GET', f'/encounters?lat={LAT}&lng={LNG}&radius={radius}', token=author)
check(f'GET /encounters: 200, najwyżej {cfg.game.encounters.max_in_response} przeciwników', status == 200 and len(enemies) <= cfg.game.encounters.max_in_response, enemies)
check('drugie zapytanie: ci sami przeciwnicy (przypisani do miejsca)', [e['id'] for e in call('GET', f'/encounters?lat={LAT}&lng={LNG}&radius={radius}', token=voter)[1]] == [e['id'] for e in enemies])
if enemies:
    enemy = enemies[0]
    status, result = call('POST', f'/encounters/{enemy["id"]}/attack', {'lat': enemy['lat'], 'lng': enemy['lng'], 'pokemonIds': [pokemons[0]['id']]}, token=author)
    check('POST /encounters/{id}/attack z miejsca przeciwnika: wynik won albo lost', status == 200 and result['outcome'] in ('won', 'lost'), result)
    status, body = call('POST', f'/encounters/{enemy["id"]}/attack', {'lat': enemy['lat'], 'lng': enemy['lng'], 'pokemonIds': [pokemons[0]['id']]}, token=author)
    check('druga próba od razu: 429 (limit częstotliwości) albo 409 (już pokonany)', status in (409, 429), body)
else:
    print('  - brak przeciwników w okolicy (losowanie dało 0), atak pominięty')

section('9. Administrator z danych demo (opcjonalnie)')
password = os.environ.get('DEMO_PASSWORD')
if not password:
    print('  - pominięto (ustaw DEMO_PASSWORD i uruchom wcześniej: python manage.py seed_demo)')
else:
    status, tokens = call('POST', '/auth/login', {'email': 'admin@demo.smartcity.example', 'password': password})
    check('login administratora z danych demo', status == 200, tokens)
    if status == 200:
        orgs = call('GET', '/admin/organizations', token=tokens['access'])
        check('GET /admin/organizations widzi zweryfikowaną fundację', orgs[0] == 200 and any(o['verificationStatus'] == 'verified' for o in orgs[1]), orgs)
        check('mieszkaniec nie ma dostępu do panelu administratora: 403', call('GET', '/admin/organizations', token=author)[0] == 403)

print(f'\nWynik: {steps["ok"]} ✔, {steps["fail"]} ✘')
sys.exit(1 if steps['fail'] else 0)
