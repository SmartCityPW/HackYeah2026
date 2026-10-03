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
| **Pinezki** | Zgłoszenie problemu, pomysł mieszkańca, cool miejsce, inicjatywa NGO, konsultacje. Formularze to dane (katalog 20 scenariuszy), nie kod. |
| **Zastaw** | Zgłaszając problem lub pomysł zostawiasz na nim jednego swojego pokemona. Wraca z premią exp, gdy zgłoszenie zbierze próg głosów lub zostanie rozwiązane, a bez premii po odrzuceniu lub wycofaniu. |
| **Głosowanie z bliska** | Głos „za/przeciw” działa tylko w promieniu 50 m od pinezki (liczy serwer). Za głos wybrany pokemon dostaje exp. Autor nie głosuje na własną pinezkę. |
| **Moderacja AI** | Zgłoszenia mieszkańców ocenia agent (odpowiedź tylko tak/nie). Odrzucone nie powstają. Awaria agenta też nie przepuszcza treści. |
| **Pokemony** | Każdy dostaje startowego. Poziom i moc rosną z exp. Typy dają mnożnik ×1,2 w walce. |
| **Walka** | Losowi przeciwnicy generowani przez serwer, drużyna do 3 pokemonów, wygrana daje exp, XP i nowego pokemona. *(Backend: jeszcze nie zaimplementowane, frontend ma atrapę.)* |
| **Ankiety i wydarzenia** | Odpowiedź na ankietę daje pokemona. Udział w wydarzeniu daje unikalnego. *(Backend: modele gotowe, brak logiki.)* |

## Stan projektu

| Część | Co działa | Co jest atrapą lub brakuje |
|---|---|---|
| **Backend** (`backend/`) | **25 z 36 operacji** kontraktu: konta, gość, organizacje, katalog, scenariusze, pinezki (tworzenie, głos, wycofanie, status, komentarze), kolekcja, postęp. 79 testów | 11 operacji odpowiada jawnym `501`: zdjęcia, ankiety, wydarzenia, walka, edycja scenariusza |
| **Frontend** (`frontend/`) | Cała aplikacja na **atrapach** (mapa 3D, trzy widoki, zgłaszanie, głosowanie, walka). 47 testów | Tryb prawdziwego backendu jest częściowy: lista pinezek, kolekcja, status i postęp działają, głos/zgłoszenie/komentarze/walka jeszcze nie ([`docs/frontend-adaptation.md`](docs/frontend-adaptation.md)) |
| **Kontrakt i baza** (`docs/`) | `openapi.yaml` (36 operacji), schemat 26 tabel, seedy | Schemat nie był wykonany na żywym PostgreSQL (testy lecą na SQLite) |

## Wymagania

- **Node.js LTS** (frontend), **Python 3.12 lub nowszy** (backend; Django 6.1 nie zainstaluje się na starszym). Docker jest opcjonalny.
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
.venv/bin/python manage.py seed_demo     # 8 kont, zweryfikowana fundacja, 6 pinezek w Krakowie
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

- **Mieszkaniec 👤:** mapa pokazuje Kraków w 3D z pinezkami i obracającymi się postaciami. Kliknij pinezkę → karta ze szczegółami, **Potwierdzam** → komunikat o nagrodzie. **➕ Zgłoś** → trzy kategorie (problem / inicjatywa / cool miejsce) → formularz (cool miejsce ma gwiazdki, koszt, klimat). Dolne menu: **Spryciaki** (kolekcja i poziom), **Inicjatywy** (moje, z filtrami).
- **Walka:** włącz **📍 GPS** (symuluje Twoją pozycję na Rynku). Czerwony przeciwnik obok jest w zasięgu, kliknij go → **⚔️ Walcz**. Pozostali są dalej i pokażą „Za daleko”.
- **Organizacja 🏢:** **🏢 Nowa inicjatywa** → szczegółowe scenariusze (przystanek ze wszystkimi polami, drzewo, mała architektura, szkoda na powierzchni). Zakładki: Inicjatywy (statystyki poparcia), Organizacja (profil).
- **Administrator 🛡️:** **Moderacja** (zmiana statusu, odrzucone znikają z mapy), **Organizacje** (weryfikacja), **Scenariusze** (podgląd katalogu), **Mapa** (bez przycisku zgłaszania).

> Ten przegląd wizualny nie był wykonany przeze mnie w przeglądarce, tylko sprawdzone testami i buildem. Zgłoś, co wygląda lub działa źle.

### 6. Frontend na prawdziwym backendzie (częściowo)

Z uruchomionym backendem z kroku 2 zmień w [`frontend/public/config/app-config.yaml`](frontend/public/config/app-config.yaml):

```yaml
api:
  mode:
    pokestops: http      # było: mock
```

Odśwież stronę. Aplikacja sama założy konto gościa, a mapa pokaże **6 pinezek z bazy**. Działa: lista pinezek, kolekcja, zmiana statusu (administrator).
Głosowanie, zgłaszanie i komentarze rzucą komunikat `NotAdaptedYet` w konsoli przeglądarki: to zamierzony znacznik tego, co jeszcze trzeba dopasować.

**Jak sprawdzić panel administratora na prawdziwych danych** (aplikacja nie ma jeszcze ekranu logowania): pobierz token i wstaw go do przeglądarki.

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.smartcity.example","password":"demo-haslo-1234"}'
```

W konsoli przeglądarki: `localStorage.setItem('scgo.access', '<access>'); localStorage.setItem('scgo.refresh', '<refresh>')`, odśwież stronę, przełącz na 🛡️ i w **Moderacji** zmień status pinezki.
Dla widoku organizacji zaloguj się jako `fundacja@demo.smartcity.example`.

### 7. Docker (jak na produkcji)

```bash
cp .env.example .env               # uzupełnij DJANGO_SECRET_KEY i DB_PASSWORD
docker compose up --build          # PostgreSQL + backend, migracje i słowniki przy starcie
```

> **Ta ścieżka nie była jeszcze uruchamiana** (na maszynie, na której powstała, nie było Dockera), więc to jej pierwszy test.
> Spójność `docker-compose.yml` z konfiguracją pilnują testy. Dane demo w Dockerze: `backend/config/demo.example.yaml`.

### 8. Kontrola dokumentacji względem kodu

Wykonuje się w kroku 1: każda operacja z `docs/openapi.yaml` ma trasę, tabele i kolumny zgadzają się ze `docs/db/schema.sql`, a `.env.example` zawiera dokładnie te sekrety, które czyta kod.

## Konfiguracja i sekrety

| Co | Gdzie |
|---|---|
| Wartości zmienne backendu (zasięgi, nagrody, limity, adresy, wybór agenta moderującego) | [`backend/config/default.yaml`](backend/config/default.yaml), nadpisania przez `APP_CONFIG_OVERRIDE` |
| Wartości zmienne frontendu (adres backendu, tryb mock/http, mapa, limity zdjęć) | [`frontend/public/config/app-config.yaml`](frontend/public/config/app-config.yaml) |
| **Sekrety**: `DJANGO_SECRET_KEY`, `DB_PASSWORD`, `AI_API_KEY`, `DEMO_PASSWORD` | wyłącznie zmienne środowiskowe ([`.env.example`](.env.example), plik `.env` jest ignorowany przez git) |

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
├── docker-compose.yml    PostgreSQL + backend
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
2. **Zdjęcia** (odblokowują zgłoszenia ze zdjęciem), potem **ankiety** i **wydarzenia**.
3. Dopasowanie frontendu do kontraktu: wybór pokemona przy głosie i zgłoszeniu, pozycja użytkownika, logowanie ([`docs/frontend-adaptation.md`](docs/frontend-adaptation.md)).

## Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| `No matching distribution found for Django<6.2,>=6.1` (lista wersji kończy się na 4.2.x) | Za stary Python (3.9 lub starszy). Zainstaluj 3.12+ (`brew install python@3.13`), usuń `backend/.venv` i utwórz go od nowa: `python3.13 -m venv .venv`. |
| `Brak wymaganej zmiennej środowiskowej DJANGO_SECRET_KEY` lub `DB_PASSWORD` | Nowy terminal nie ma zmiennych: wykonaj `source config/local.env` (krok 2). Sekrety są tylko w środowisku, nigdy w plikach YAML. |
| `Nie można połączyć się z http://localhost:8000` (skrypt) | Backend nie działa: uruchom `manage.py runserver` w osobnym terminalu. |
| Mapa pusta, w konsoli błąd CORS lub sieci | Tryb `http` bez działającego backendu albo inny adres w `api.baseUrl`. Backend zezwala na `http://localhost:4200` (`app.cors_allowed_origins`). |
| Mapa pusta w trybie `http` | Brak danych: uruchom `manage.py seed_demo`. |
| `Dane demo można ładować tylko w trybie debug` | Użyj `config/local.yaml` (krok 2) albo `config/demo.example.yaml` w Dockerze. |
| Port 4200 lub 8000 zajęty | Zatrzymaj poprzedni proces (`ng serve` / `runserver`) albo zmień port (`server.port` w YAML-u backendu). |
| `Konfiguracja: brak sekcji ...` w przeglądarce | Błąd w `app-config.yaml`: komunikat wskazuje dokładny klucz. |
