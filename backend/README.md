# Backend (Django)

REST API aplikacji Smart City Go. Kontrakt: [`../docs/openapi.yaml`](../docs/openapi.yaml), omówienie: [`../docs/api-contract.md`](../docs/api-contract.md),
baza: [`../docs/db/README.md`](../docs/db/README.md).

## Stan

`python manage.py contract_status` pokazuje, które operacje z kontraktu są gotowe. Dziś: **27 z 36 zaimplementowanych**, reszta
to jawne `501 not_implemented` (ankiety, zdjęcia, wydarzenia, edycja scenariusza). Nic z kontraktu nie zwraca 404.

| Gotowe | Atrapy (501), kolejne wycinki do zrobienia |
|---|---|
| konta (gość, rejestracja, organizacja, logowanie, odświeżanie, zapis konta), profil, organizacje, weryfikacja | `POST /photos` |
| `GET /catalog`, `GET /scenarios` | `POST /pokestops/{id}/survey-responses`, `GET .../survey-results` |
| pinezki: lista z `bbox`, szczegóły, tworzenie (scenariusze, zastaw, moderacja AI), głos (zasięg, exp, zwrot zastawu), wycofanie, status, komentarze | `GET/POST /events`, `/events/{id}`, `/events/{id}/check-in` |
| kolekcja, pokemony, postęp gracza, interakcje | `PUT /admin/scenarios/{code}` |
| walka: przeciwnicy w kwadratach terenu (`GET /encounters`), atak z antyoszustwem (`POST /encounters/{id}/attack`) | |

## Uruchomienie

**Docker (jak na produkcji)** z katalogu głównego repozytorium (dane demo w Dockerze: `config/demo.example.yaml`):

```bash
cp .env.example .env     # uzupełnij DJANGO_SECRET_KEY i DB_PASSWORD
docker compose up --build
```

**Lokalnie, bez Dockera** (SQLite, tryb debug). Wymagany **Python 3.12+** (`python3 --version`; na macOS `brew install python@3.13` i `python3.13` zamiast `python3`):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements/dev.txt
cp config/local.example.yaml config/local.yaml
cp config/local.env.example config/local.env
source config/local.env      # DJANGO_SECRET_KEY, APP_CONFIG_OVERRIDE, DEMO_PASSWORD (w każdym nowym terminalu)
.venv/bin/python manage.py bootstrap     # migracje + słowniki + scenariusze
.venv/bin/python manage.py runserver     # http://localhost:8000/api/v1/
```

**Lokalizacja gracza** jest weryfikowana przy każdej akcji związanej z miejscem (głos, pinezka, ankieta, wydarzenie, walka, przeciwnicy): dokładność, aktualność odczytu, tempo ruchu i źródło (`location` w `config/default.yaml`).
Pozycje symulowane (tryb deweloperski frontendu) przyjmuje tylko konfiguracja z `location.allow_simulated: true` (`local.example.yaml`, `demo.example.yaml`). Przeciwnicy są generowani osobno dla każdego gracza; `prune_encounters` czyści stare wiersze.

Odrzucenia moderacji AI widzi administrator w aplikacji (karta „Odrzucenia AI”, `GET /admin/moderation-log`). Fałszywe odrzucenie albo przepuszczony atak dopisujesz do zestawu regresyjnego:
`python manage.py moderation_log_to_cases <id> --expect approve` (albo `reject`), a stare wpisy (`moderation.log_retention_days`) czyści `moderation_prune_log` (też przy starcie).

Konto administratora IT zakłada `bootstrap` (a ręcznie `manage.py ensure_admin`) z adresu `admin.email` w YAML i hasła `ADMIN_PASSWORD` ze środowiska.

Dane demo (23 konta + 100 głosujących, dwie zweryfikowane organizacje i 42 zmyślone pinezki rozsiane po Krakowie i okolicy; tylko tryb debug, hasło z `DEMO_PASSWORD`):
`DEMO_PASSWORD=... .venv/bin/python manage.py seed_demo`. Seed jest idempotentny i niczego nie kasuje, więc po zmianie `config/seed/demo.yaml` użyj `manage.py seed_demo --reset`: usuwa wszystkie pinezki (z głosami, komentarzami i ankietami), zdejmuje zastawy i ładuje listę od nowa (konta i wydarzenia zostają). Głosy (`votes: [za, przeciw]`), odpowiedzi ankiet (`survey_responses`), komentarze i statusy powstają **prawdziwymi funkcjami gry** (konta z puli `voters`, exp za głos, zwrot zastawu po progu, walidacja odpowiedzi), więc liczniki zgadzają się z wierszami w bazie, a suma głosów na pinezce nie przekroczy wielkości puli. **Zgłoszenia mieszkańców przechodzą moderację** skonfigurowanym agentem (reguły i AI, wpis w logu jak w grze), więc do seeda potrzebny jest `AI_API_KEY` (np. w `config/local.env`); odrzucone zgłoszenie nie powstaje i seed wypisuje jego tytuł (do poprawy w `demo.yaml`), a bez dostępnej moderacji kończy się czytelnym błędem. `--skip-moderation` pomija ją (praca bez klucza, testy). Pominięte jest tylko sprawdzanie GPS (`verify_location=False`), a daty zgłoszeń są postarzane (`days_ago`). Test "z zewnątrz" na działającym serwerze: `.venv/bin/python scripts/api_walkthrough.py`.

Testy: `.venv/bin/python -m pytest` (117 testów, SQLite w pamięci, bez zewnętrznych usług).

> Dockerfile i `docker-compose.yml` zostały napisane, ale **nie uruchamiane** (na maszynie, na której powstały, nie było Dockera).
> Pierwsze `docker compose up --build` to ich pierwszy test. Spójność compose z konfiguracją sprawdza `tests/test_deployment_files.py`.

## Konfiguracja i sekrety

| Co | Gdzie |
|---|---|
| Wszystkie wartości zmienne (zasięgi, limity, nagrody, adresy, porty, ścieżki, wybór agenta moderującego) | `config/default.yaml` |
| Nadpisania per środowisko | plik wskazany w `APP_CONFIG_OVERRIDE` (scalany klucz po kluczu) |
| **Sekrety**: `DJANGO_SECRET_KEY`, `DB_PASSWORD`, `AI_API_KEY` | wyłącznie zmienne środowiskowe (`.env.example`) |

Zasady, których pilnują testy: konfiguracja jest walidowana przy starcie (brakujący, nieznany lub źle otypowany klucz kończy się czytelnym błędem),
w YAML-ach nie ma kluczy wyglądających na sekrety, `.env.example` zawiera dokładnie te sekrety, które czyta kod, a ścieżki względne są liczone od katalogu `backend/`.
Kod czyta konfigurację przez `settings.APP` (typowane dataclassy w `core/config.py`), nigdy z literałów.

**Zmiana wartości** (np. zasięgu głosowania): edytuj `config/default.yaml`, a nie kod. Testy sprawdzają, że zmiana działa.

## Struktura

```
backend/
├── config/           YAML: default, test, local.example, moderation_prompt.txt, gunicorn.py, seed/ (słowniki i scenariusze)
├── core/             wspólne: konfiguracja, sekrety, błędy w kształcie z kontraktu, uprawnienia, geografia, stronicowanie
├── smartcity/        projekt Django (settings budowane z konfiguracji, urls)
└── apps/
    ├── accounts/     użytkownicy, role, organizacje
    ├── collection/   typy, postacie, posiadane pokemony (poziom i moc liczone z exp)
    ├── scenarios/    katalog formularzy i walidacja pól
    ├── pokestops/    pinezki, głosy, komentarze, ankiety, moderacja
    ├── events/       wydarzenia (modele gotowe, brak serwisów)
    ├── game/         przeciwnicy, walki, postęp (modele gotowe, częściowo serwisy)
    └── moderation/   moderacja: reguły (rules.py) + agent AI (port + adaptery stub/rules/layered/http/gemini)
```

Zależności między aplikacjami idą w jedną stronę (bez cykli): `accounts ← collection ← scenarios ← pokestops`, `events` i `game` zależą od `accounts` i `collection`.

## Jak dodać lub dokończyć endpoint

Warstwy w każdej aplikacji (od wejścia HTTP do bazy): `urls.py` → `views.py` (tłumaczy HTTP, bez reguł) → `services.py` (reguły i transakcje) → `models.py`.

1. Znajdź atrapę w `apps/<app>/urls.py` (`NotImplementedView.as_view(feature=...)`) albo dodaj trasę zgodnie z `docs/openapi.yaml`.
2. Reguły napisz w `services.py` (wzorzec: `apps/pokestops/services.py`). Wartości bierz z `settings.APP`, a nowe dodaj do `config/default.yaml` i do dataclass w `core/config.py`.
3. Widok ma tylko: zwalidować wejście serializerem, wywołać serwis, zwrócić odpowiedź. Błędy domenowe zgłaszaj przez `ApiError(status, 'kod_maszynowy', 'komunikat')`.
4. Serializery dziedziczą po `CamelSerializer` (pola w snake_case, JSON w camelCase; zawartość słowników jak `details` zostaje nietknięta).
5. Napisz testy (wzorzec: `tests/test_pokestops.py`) i sprawdź `python manage.py contract_status`.

Co pilnują testy poza logiką: `tests/test_contract_and_schema.py` (każda operacja z `openapi.yaml` ma trasę, a atrapy odpowiadają 501 w kształcie błędu z kontraktu;
tabele i kolumny zgadzają się z `docs/db/schema.sql` z wyjątkiem opisanych różnic).

## Decyzje, o których warto wiedzieć

- **Bez GeoDjango.** Współrzędne to `lat`/`lng`, odległość liczy `core/geo.py` (haversine), a widok mapy to filtr po prostokącie. Dla skali hackathonu wystarcza i nie wymaga GDAL w obrazie ani na komputerach zespołu. `schema.sql` zachowuje `geography` na przyszłość (indeksy przestrzenne).
- **Moderacja to port z adapterami** (`moderation.provider`: `layered` domyślnie, `rules`, `gemini`, `http`, `stub`). **`layered`** najpierw stosuje reguły z `config/moderation_rules.yaml` (`apps/moderation/rules.py`: wulgaryzmy, nienawiść, groźby, dane osobowe, spam, wstrzykiwanie instrukcji; bez sieci i klucza), a potem, jeśli jest `AI_API_KEY`, Gemini (ocena tematu). Odrzucenie przez reguły kończy sprawę, więc model nie widzi prób wstrzyknięcia. Komentarze, odpowiedzi tekstowe w ankietach i nazwy (konto, organizacja) przechodzą tylko przez reguły. Log odrzuceń ma kategorię w `reason`. `stub` (znacznik `[odrzuć]`) służy już tylko testom. Awaria agenta nie przepuszcza zgłoszenia (`503`). **`gemini`** to Google Gemini API: model i adres w `moderation.gemini` (YAML), klucz tylko w `AI_API_KEY` (nagłówek `x-goog-api-key`), odpowiedź ograniczona schematem do `0`/`1`, a odmowa filtrów bezpieczeństwa Gemini liczy się jako odrzucenie, nie awaria. Do modelu trafia tylko treść zgłoszenia (scenariusz, tytuł, opis, pola), bez danych autora. Sprawdzenie klucza i modelu: `python manage.py moderation_check`. Ocena jakości (poprawne zgłoszenia, niedozwolona treść, próby wstrzyknięcia instrukcji): `python manage.py moderation_eval --delay 6` na przypadkach z `config/moderation_cases.yaml`.
- **Seedy w YAML** (`config/seed/`), ładowane idempotentnie przez `manage.py bootstrap` (w kontenerze automatycznie, gdy `seed.on_start: true`). `scenarios.yaml` jest **generowany** z katalogu we frontendzie (`cd ../frontend && npm run db:seed-scenarios`) do czasu, aż backend przejmie jego edycję.
- **Brak panelu Django (`admin`).** Moderacja idzie przez API (`PATCH /pokestops/{id}`), tak jak w kontrakcie.
