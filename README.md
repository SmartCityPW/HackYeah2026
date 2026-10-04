# Smart City Go

Aplikacja w stylu „Pokémon Go” dla **partycypacji społecznej**. Mieszkańcy (głównie gen alpha i młodzi dorośli) chodzą po mieście,
zgłaszają problemy i pomysły, głosują na miejscu, zbierają pokemony i walczą z miejskimi problemami. Miasta i organizacje (NGO) dostają
narzędzie do konsultacji, ankiet i wydarzeń. Wymagania źródłowe: [`docs/opis.md`](docs/opis.md).

## Jak to działa

```
 Przeglądarka (PWA)                     Backend                          Zewnętrzne
┌────────────────────┐   REST + JWT   ┌──────────────────────┐        ┌─────────────────────┐
│ Angular            │ ─────────────▶ │ Django REST          │ ─────▶ │ PostgreSQL          │
│ mapa 3D (MapLibre) │   JSON, camel  │ reguły w serwisach   │        └─────────────────────┘
│ 3 widoki wg roli   │ ◀───────────── │ moderacja AI (port)  │ ─────▶ │ agent AI (opcjonalnie)│
└────────────────────┘                └──────────────────────┘        └─────────────────────┘
      ▲ kafelki mapy: OpenFreeMap (publiczne, bez klucza)
```

**Trzy widoki w jednej aplikacji** (rola decyduje o nawigacji i uprawnieniach): **mieszkaniec** (mapa, Spryciaki, Inicjatywy), **zaufana organizacja**
(NGO, urząd: inicjatywy i panel organizacji) oraz **administrator** (moderacja, weryfikacja organizacji, katalog scenariuszy).

**Zasady gry, które egzekwuje serwer** (klient nigdy nie liczy nagród ani wyników):

| Mechanika | Jak działa |
|---|---|
| **Pinezki** | Zgłoszenie problemu, pomysł mieszkańca, cool miejsce, inicjatywa NGO, konsultacje. Formularze to dane (katalog 26 scenariuszy), nie kod. |
| **Zastaw** | Zgłaszając problem lub pomysł zostawiasz na nim jednego swojego pokemona. Wraca z premią exp, gdy zgłoszenie zbierze próg głosów lub zostanie rozwiązane, a bez premii po odrzuceniu lub wycofaniu. |
| **Głosowanie z bliska** | Głos „za/przeciw” działa tylko w promieniu 50 m od pinezki (liczy serwer). Za głos wybrany pokemon dostaje exp. Autor nie głosuje na własną pinezkę. |
| **Moderacja** | Dwie warstwy (`moderation.provider: layered`, domyślnie). 1) **Reguły** (`config/moderation_rules.yaml`, bez sieci i klucza): wulgaryzmy, mowa nienawiści, groźby, dane osobowe (telefon, e-mail, PESEL, karta), spam i linki, próby wstrzyknięcia instrukcji do AI; obejmują też warianty typu `k u r w a`, `ku*wa`, `kurwaaa`. 2) **Google Gemini** (klucz `AI_API_KEY`): ocenia, czy zgłoszenie dotyczy miasta. Bez klucza działają same reguły. Moderowane są: zgłoszenia mieszkańców (reguły + AI), komentarze, odpowiedzi tekstowe w ankietach i nazwy (konto, organizacja) (reguły). Odrzucone nie powstają i trafiają do logu z kategorią (`vulgar`, `spam`, `injection`, `ai`…). Awaria Gemini nie przepuszcza treści (zmienisz to w `moderation.layered.on_ai_error`). |
| **Pokemony** | Każdy dostaje startowego. Poziom i moc rosną z exp. Typy dają mnożnik ×1,2 w walce. |
| **Walka** | Losowi przeciwnicy generowani przez serwer, drużyna do 3 pokemonów, wygrana daje exp, XP i nowego pokemona. *(Backend: jeszcze nie zaimplementowane, frontend ma atrapę.)* |
| **Ankiety** | Odpowiedź na ankietę zaufanego podmiotu daje nowego pokemona (gatunek poznajesz dopiero po wysłaniu). |
| **Wydarzenia „cool thing”** | Zaufany podmiot ustawia wydarzenie na mapie (okres, godziny dzienne, rzadki pokemon z katalogu jako nagroda). Opis widać zawsze, a pokemona odbiera się **tylko w kółku 50 m i w czasie trwania**. Jeden pokemon na uczestnika. |

## Stan projektu

| Część | Co działa | Co jest atrapą lub brakuje |
|---|---|---|
| **Backend** (`backend/`) | **25 z 36 operacji** kontraktu: konta, gość, organizacje, katalog, scenariusze, pinezki (tworzenie, głos, wycofanie, status, komentarze), kolekcja, postęp. 79 testów | 11 operacji odpowiada jawnym `501`: zdjęcia, ankiety, wydarzenia, walka, edycja scenariusza |
| **Frontend** (`frontend/`) | Aplikacja na **atrapach** (mapa 3D, trzy widoki, zgłaszanie, głosowanie, walka) albo, per obszar, na prawdziwym backendzie. 70 testów | **Pętla gry działa na backendzie** (pinezki wg obszaru mapy, głos z wyborem pokemona i pozycją, zgłoszenie z zastawem i moderacją, komentarze z odpowiedziami, rola z `/me`). Walka, zdjęcia, ankiety, wydarzenia i logowanie jeszcze nie ([`docs/frontend-adaptation.md`](docs/frontend-adaptation.md)) |
| **Kontrakt i baza** (`docs/`) | `openapi.yaml` (36 operacji), schemat 26 tabel, seedy | Schemat nie był wykonany na żywym PostgreSQL (testy lecą na SQLite) |

## Wymagania

- **Node.js LTS** (frontend), **Python 3.12 lub nowszy** (backend; Django 6.1 nie zainstaluje się na starszym). Docker jest opcjonalny (uruchamia całość: `docker compose up --build`).
- Sprawdź wersję: `python3 --version`. Systemowy Python na macOS bywa 3.9, wtedy zainstaluj nowszy: `brew install python@3.13` i **w poleceniach poniżej wpisuj `python3.13` zamiast `python3`** (dotyczy tylko tworzenia środowiska `venv`).
- Przeglądarka z WebGL (mapa 3D). Lokalizacja przeglądarki jest opcjonalna (jest symulator GPS).

## Przetestuj całość po kolei

Każdy krok działa samodzielnie. Zacznij od 1 i 2 (automatyczne), a krok 5 to przegląd ręczny w przeglądarce.

### 1. Testy backendu (bez serwera)

```bash
cd backend
python3 --version                   # musi być 3.12 lub nowszy (inaczej: brew install python@3.13 i użyj python3.13)
python3 -m venv .venv && .venv/bin/pip install -r requirements/dev.txt
.venv/bin/python -m pytest          # oczekiwane: 79 passed
```

### 2. Backend na żywo + dane demo + automatyczne przejście przez API

Środowisko lokalne (SQLite zamiast PostgreSQL, tryb debug) i zmienne środowiskowe ustawiasz **raz na terminal**. Robi to gotowy plik:

```bash
cd backend
cp config/local.example.yaml config/local.yaml    # raz: konfiguracja lokalna
cp config/local.env.example config/local.env      # raz: zmienne (sekrety lokalne, plik ignorowany przez git)
source config/local.env                           # w KAŻDYM terminalu z manage.py
```

Terminal 1, serwer:

```bash
.venv/bin/python manage.py bootstrap     # migracje + słowniki + 20 scenariuszy
.venv/bin/python manage.py seed_demo     # 23 konta, 2 zweryfikowane organizacje, 42 pinezki w Krakowie (świeże dane: seed_demo --reset)
.venv/bin/python manage.py runserver     # http://localhost:8000/api/v1/
```

Terminal 2 (najpierw `cd backend && source config/local.env`), kontrola:

```bash
.venv/bin/python scripts/api_walkthrough.py   # oczekiwane: 24 ✔, 0 ✘
.venv/bin/python manage.py contract_status    # co z kontraktu jest gotowe (25 z 36)
```

Skrypt sam zakłada dwa konta gościa i sprawdza po kolei: słowniki, pokemona startowego, zgłoszenie z zastawem, **odmowę głosu z 1,1 km** i **przyjęcie z 11 m** (z exp),
duplikat głosu, zakaz głosowania na własną pinezkę, wątki komentarzy, listę z `bbox`, wycofanie ze zwrotem pokemona, `501` dla niegotowych funkcji i dostęp administratora.

Ręcznie, jeśli wolisz: `curl -X POST http://localhost:8000/api/v1/auth/guest`, a potem `GET /me`, `/me/pokemons`, `/scenarios`, `/pokestops?bbox=19.9,50.0,20.0,50.1` z nagłówkiem `Authorization: Bearer <access>`.

### 3. Testy i build frontendu

```bash
cd frontend
npm install
npm test -- --watch=false          # oczekiwane: 47 passed
npm run build
```

### 4. Aplikacja na atrapach (bez backendu)

```bash
cd frontend && npm start           # http://localhost:4200
```

Domyślnie wszystko działa na danych w pamięci, więc backend nie jest potrzebny.

### 5. Przegląd ręczny w przeglądarce (checklista)

Przełącznik w lewym górnym rogu (👤 / 🏢 / 🛡️ i 📍 GPS) to narzędzia deweloperskie (`dev.tools` w konfiguracji).

- **Mieszkaniec 👤:** mapa pokazuje Kraków w 3D z pinezkami i obracającymi się postaciami. Kliknij pinezkę → karta ze szczegółami. Żeby zagłosować, włącz **📍 GPS** (głos działa tylko w promieniu 50 m): wybierz pokemona, który dostanie exp, i kliknij **Potwierdzam** (w zasięgu GPS jest „Zniszczona ławka przy Rynku”). **➕ Zgłoś** → trzy kategorie (problem / inicjatywa / cool miejsce) → formularz (cool miejsce ma gwiazdki, koszt, klimat). Dolne menu: **Spryciaki** (kolekcja i poziom), **Inicjatywy** (moje, z filtrami).
- **Walka:** włącz **📍 GPS** (symuluje Twoją pozycję na Rynku). Czerwony przeciwnik obok jest w zasięgu, kliknij go → **⚔️ Walcz**. Pozostali są dalej i pokażą „Za daleko”.
- **Organizacja 🏢:** **🏢 Nowa inicjatywa** → szczegółowe scenariusze (przystanek ze wszystkimi polami, drzewo, mała architektura, szkoda na powierzchni). Zakładki: Inicjatywy (statystyki poparcia), Organizacja (profil).
- **Administrator 🛡️:** **Moderacja** (zmiana statusu, odrzucone znikają z mapy), **Organizacje** (weryfikacja), **Scenariusze** (podgląd katalogu), **Mapa** (bez przycisku zgłaszania).

> Ten przegląd wizualny nie był wykonany przeze mnie w przeglądarce, tylko sprawdzone testami i buildem. Zgłoś, co wygląda lub działa źle.

### 6. Frontend na prawdziwym backendzie

Z uruchomionym backendem z kroku 2 zmień w [`frontend/public/config/app-config.yaml`](frontend/public/config/app-config.yaml):

```yaml
api:
  mode:
    pokestops: http      # było: mock
    account: http        # było: mock
    # game zostaw na mock: walka czeka na backend (501)
upload:
  enabled: false         # backend nie ma jeszcze POST /photos, więc ukrywamy pola zdjęć
```

Odśwież stronę. Aplikacja sama założy konto gościa, pobierze rolę z `/me` (przełącznik 👤/🏢/🛡️ znika, bo rolę ustala serwer) i dociągnie pinezki z widocznej części mapy. Działa cała pętla gry:

- **Głos:** włącz 📍 GPS, otwórz pinezkę z Rynku, wybierz pokemona i zagłosuj. Serwer dolicza exp (toast pokazuje nowy poziom). Z innego miejsca dostaniesz „Jesteś za daleko (… m)”.
- **Zgłoszenie:** ➕ Zgłoś → problem → wybierz pokemona do zastawienia. Tytuł z wulgaryzmem, numerem telefonu albo linkiem zostanie odrzucony przez moderację: komunikat serwera, formularz zostaje wypełniony.
- **Komentarze:** pod pinezką, z odpowiedziami („Odpowiedz”) i „Pokaż starsze komentarze”.
- Zdjęcia są jeszcze tylko w kontrakcie (`POST /photos`: 501).

Aplikacja w trybie `http` wymaga działającego backendu już przy starcie: gdy go nie ma, strona zostaje pusta.

**Jak sprawdzić panel administratora na prawdziwych danych** (aplikacja nie ma jeszcze ekranu logowania): pobierz token i wstaw go do przeglądarki.

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.smartcity.example","password":"demo-haslo-1234"}'
```

W konsoli przeglądarki: `localStorage.setItem('scgo.access', '<access>'); localStorage.setItem('scgo.refresh', '<refresh>')`, odśwież stronę: rola (🛡️) przyjdzie z `/me`, więc w **Moderacji** zmienisz status pinezki.
Dla widoku organizacji zaloguj się jako `fundacja@demo.smartcity.example`.

### 7. Docker (cała aplikacja jedną komendą)

```bash
cp .env.example .env               # uzupełnij DJANGO_SECRET_KEY, DB_PASSWORD, ADMIN_PASSWORD (i ewentualnie DEMO_PASSWORD, AI_API_KEY)
docker compose up --build          # PostgreSQL + backend + frontend (nginx)
```

| Usługa | Adres | Co to |
|---|---|---|
| `frontend` | http://localhost:4200 | zbudowana aplikacja Angular w nginx (`frontend/Dockerfile`, `frontend/docker/nginx.conf`) |
| `backend` | http://localhost:8000/api/v1 | Django w gunicornie; migracje, słowniki, konto administratora i (opcjonalnie) dane demo przy starcie |
| `db` | tylko w sieci Dockera | PostgreSQL 16 |

- **Konfiguracja frontendu bez przebudowy:** `frontend/public/config/app-config.yaml` jest montowany z hosta, więc zmianę adresu backendu albo `api.mode.*` robisz w pliku i odświeżasz stronę.
- **Dane demo i Gemini:** w `.env` ustaw `APP_CONFIG_OVERRIDE=config/demo.example.yaml,config/gemini.example.yaml` (pliki po przecinku).
- **Port frontendu** zmienisz przez `FRONTEND_PORT`, ale musi być wtedy dopisany do `app.cors_allowed_origins` w `backend/config/default.yaml` (pilnuje tego test).
- Zmiana kodu frontendu wymaga `docker compose up --build`. Do pracy nad frontendem wygodniejszy jest `npm start` (krok 3).

> Przetestowane: `docker compose up --build` stawia wszystkie trzy usługi, frontend odpowiada na `/` i podstronach (`/inicjatywy` bez 404), a backend zakłada administratora i dane demo.
> **Niesprawdzone w przeglądarce:** czy mapa i modele 3D ładują się z nginx. Pliki odpowiadają z właściwymi typami (`.mjs` jako JavaScript, `.glb`).
> Spójność `docker-compose.yml` z konfiguracją pilnują testy (`backend/tests/test_deployment_files.py`).

### 7a. Wdrożenie prototypu dla graczy (HTTPS, moderacja, limity)

Cel: kilkaset osób na telefonach, jedna domena, HTTPS (przeglądarki dają lokalizację tylko na HTTPS, więc bez niego gra nie działa).

```bash
cp .env.example .env                                              # DJANGO_SECRET_KEY, DB_PASSWORD, ADMIN_PASSWORD, AI_API_KEY (Gemini; bez klucza same reguły)
cp backend/config/production.example.yaml backend/config/production.yaml   # wpisz swoją domenę w allowed_hosts i cors_allowed_origins
# w .env:  APP_CONFIG_OVERRIDE=config/production.yaml   DOMAIN=twoja-domena.example
docker compose --profile tls up -d --build                        # PostgreSQL + backend + frontend + Caddy (certyfikat sam)
```

- DNS domeny musi wskazywać na serwer, a porty 80 i 443 muszą być otwarte (Caddy wystawia certyfikat Let's Encrypt).
- Całość jest pod jednym adresem: nginx we frontendzie kieruje `/api/` do backendu, więc nie ma CORS ani adresu API do wpisywania. Port backendu (8000) jest dostępny tylko z serwera.
- Frontend czyta `frontend/public/config/app-config.production.yaml` (bez przełącznika ról i symulatora GPS, bez zdjęć). Do pokazu z symulowanym GPS ustaw w `.env` `FRONTEND_CONFIG=app-config.yaml` (i `location.allow_simulated: true` w YAML backendu).
- Bez Caddy (własny tunel albo proxy) ustaw `server.trusted_proxies` na liczbę proxy przed aplikacją (1 przy samym nginx), inaczej limity żądań liczą zły adres IP. Zostaw `docker compose up` bez `--profile tls`.
- Limity: konta gościa `auth.guest_rate` (na IP; na imprezie wiele osób siedzi w jednej sieci, stąd 300/h), logowanie i rejestracja `auth.login_rate`. Liczniki są w bazie, więc działają dla wszystkich procesów gunicorna.
- Konto administratora powstaje z `ADMIN_PASSWORD` (adres `admin@smartcity.local`); zaloguj się na `/logowanie`, moderuj w zakładce Moderacja, weryfikuj organizacje. Log odrzuceń: `GET /admin/moderation-log` (kategoria zamiast treści w polu `reason`).
- Kopia bazy: `./scripts/backup_db.sh` (zrób przed otwarciem dla graczy).
- Sprawdzenie moderacji na żywo (z kluczem): `cd backend && python manage.py moderation_eval --delay 3`; bez klucza pomija przypadki „nie na temat”.

**Czego prototyp nie ma:** zdjęć (`POST /photos` → 501), polityki prywatności i zgody rodziców dla osób poniżej 16 lat (do dopisania przed publicznym udostępnieniem), unieważniania tokenów po wylogowaniu, pewności co do lokalizacji (pozycję podaje telefon; serwer odrzuca złą dokładność, stare odczyty i teleportację, ale jej nie dowodzi).

### Windows (i inne systemy niż macOS)

Najprościej przez Dockera: zainstaluj **Docker Desktop** (z WSL2) i **Git**, a potem w PowerShell:

```powershell
git clone git@github.com:SmartCityPW/HackYeah2026.git
cd HackYeah2026
copy .env.example .env          # uzupełnij DJANGO_SECRET_KEY, DB_PASSWORD, ADMIN_PASSWORD (AI_API_KEY opcjonalnie)
docker compose up --build
```

Aplikacja: http://localhost:4200. Repozytorium ma `.gitattributes` wymuszające końce linii LF; jeśli sklonowałeś je **przed** tą zmianą i kontener backendu wywala
`exec docker/entrypoint.sh: no such file or directory`, to pliki mają CRLF. Napraw: `git add --renormalize .` albo sklonuj repozytorium od nowa (`git config --global core.autocrlf input`).

Bez Dockera (backend na SQLite, frontend `npm start`) w PowerShell, w `backend`:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements\dev.txt
copy config\local.example.yaml config\local.yaml
$env:DJANGO_SECRET_KEY = "dowolny-dlugi-ciag"
$env:APP_CONFIG_OVERRIDE = "config/local.yaml"
$env:DEMO_PASSWORD = "demo-haslo-1234"
python manage.py bootstrap; python manage.py seed_demo; python manage.py runserver
```

(zmienne ustawiasz w każdym oknie PowerShell; odpowiednik `source config/local.env`). Testy: `python -m pytest`. Kopię bazy w Dockerze zrobisz
`docker compose exec -T db pg_dump -U smartcity smartcity > backup.sql` (zamiast `scripts/backup_db.sh`). Frontend: `cd frontend; npm ci; npm start`.

### 8. Kontrola dokumentacji względem kodu

Wykonuje się w kroku 1: każda operacja z `docs/openapi.yaml` ma trasę, tabele i kolumny zgadzają się ze `docs/db/schema.sql`, a `.env.example` zawiera dokładnie te sekrety, które czyta kod.

## Konfiguracja i sekrety

| Co | Gdzie |
|---|---|
| Wartości zmienne backendu (zasięgi, nagrody, limity, adresy, wybór agenta moderującego) | [`backend/config/default.yaml`](backend/config/default.yaml), nadpisania przez `APP_CONFIG_OVERRIDE` |
| Wartości zmienne frontendu (adres backendu, tryb mock/http, mapa, limity zdjęć) | [`frontend/public/config/app-config.yaml`](frontend/public/config/app-config.yaml) |
| **Sekrety**: `DJANGO_SECRET_KEY`, `DB_PASSWORD`, `AI_API_KEY`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` | wyłącznie zmienne środowiskowe ([`.env.example`](.env.example), plik `.env` jest ignorowany przez git) |

Kod nie zawiera wartości zmiennych na stałe, a testy pilnują, że w plikach YAML nie ma kluczy wyglądających na sekrety.

## Struktura repozytorium

```
.
├── backend/              Django REST API (apps/: accounts, collection, scenarios, pokestops, events, game, moderation)
│   ├── config/           YAML: konfiguracja, seedy (słowniki, scenariusze, demo), prompt agenta moderującego
│   ├── core/             konfiguracja, błędy, uprawnienia, geografia, porównanie z kontraktem
│   ├── scripts/          api_walkthrough.py (test całego API z zewnątrz)
│   └── tests/            79 testów
├── frontend/             Angular 22, PWA
│   ├── public/config/    app-config.yaml (konfiguracja ładowana przy starcie)
│   └── src/app/          core (modele, serwisy, API: mock i http), features (mapa, widoki ról), shared
├── docs/                 kontrakt API, baza danych, wymagania, przewodnik adaptacji frontendu, licencje assetów
├── docker-compose.yml    PostgreSQL + backend + frontend (nginx)
└── .env.example          wzór pliku z sekretami
```

## Dokumentacja

| Plik | O czym |
|---|---|
| [`docs/opis.md`](docs/opis.md) | wymagania (źródło prawdy przy rozbieżnościach) |
| [`docs/api-contract.md`](docs/api-contract.md) | reguły backendu, **28 podjętych decyzji**, lista zmian we frontendzie, pytania otwarte |
| [`docs/openapi.yaml`](docs/openapi.yaml) | kontrakt API (36 operacji) |
| [`docs/db/README.md`](docs/db/README.md) | model bazy, diagram, decyzje projektowe, relacja do Django |
| [`docs/frontend-adaptation.md`](docs/frontend-adaptation.md) | jak przejść z atrap na backend krok po kroku |
| [`backend/README.md`](backend/README.md) | struktura backendu, jak dodać endpoint |
| [`docs/ASSETS.md`](docs/ASSETS.md) | licencje modeli 3D i bibliotek |

## Dalszy plan

1. **Walka** po stronie backendu (generowanie przeciwników, rozstrzyganie) i ekran wyboru drużyny we frontendzie.
2. **Zdjęcia** (odblokowują zgłoszenia ze zdjęciem).
3. Logowanie i rejestracja w interfejsie (dziś rolą jest gość, a organizację lub administratora ustawia wklejony token), moderacja AI z prawdziwym agentem ([`docs/plan.md`](docs/plan.md)).

## Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| `No matching distribution found for Django<6.2,>=6.1` (lista wersji kończy się na 4.2.x) | Za stary Python (3.9 lub starszy). Zainstaluj 3.12+ (`brew install python@3.13`), usuń `backend/.venv` i utwórz go od nowa: `python3.13 -m venv .venv`. |
| `Brak wymaganej zmiennej środowiskowej DJANGO_SECRET_KEY` lub `DB_PASSWORD` | Nowy terminal nie ma zmiennych: wykonaj `source config/local.env` (krok 2). Sekrety są tylko w środowisku, nigdy w plikach YAML. |
| `Nie można połączyć się z http://localhost:8000` (skrypt) | Backend nie działa: uruchom `manage.py runserver` w osobnym terminalu. |
| Mapa pusta, w konsoli błąd CORS lub sieci | Tryb `http` bez działającego backendu albo inny adres w `api.baseUrl`. Backend zezwala na `http://localhost:4200` (`app.cors_allowed_origins`). |
| Mapa pusta w trybie `http` | Brak danych: lokalnie `manage.py seed_demo`; w Dockerze w `.env` ustaw `APP_CONFIG_OVERRIDE=config/demo.example.yaml` i `DEMO_PASSWORD`, a potem `docker compose up --build`. |
| Nie ma jak wejść do widoku administratora | Konto administratora IT zakłada `bootstrap` z adresu `admin.email` (`backend/config/default.yaml`) i hasła `ADMIN_PASSWORD` z `.env`. Zaloguj się na ten adres na ekranie `/logowanie`. |
| `Dane demo można ładować tylko w trybie debug` | Użyj `config/local.yaml` (krok 2) albo `config/demo.example.yaml` w Dockerze. |
| Port 4200 lub 8000 zajęty | Zatrzymaj poprzedni proces (`ng serve` / `runserver`) albo zmień port (`server.port` w YAML-u backendu). |
| `Konfiguracja: brak sekcji ...` w przeglądarce | Błąd w `app-config.yaml`: komunikat wskazuje dokładny klucz. |
