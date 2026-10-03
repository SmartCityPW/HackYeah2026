# Frontend: przejście z atrap na backend

Dla osoby, która dokańcza frontend. Aplikacja ma dziś dwa tryby danych **per obszar**, przełączane w jednym pliku,
a nie w kodzie. Dzięki temu można przechodzić z atrap na prawdziwy backend krok po kroku.

## Przełączanie

[`frontend/public/config/app-config.yaml`](../frontend/public/config/app-config.yaml):

```yaml
api:
  baseUrl: http://localhost:8000/api/v1
  mode:
    pokestops: mock     # mock | http
    game: mock          # mock | http
```

Zmiana wartości nie wymaga przebudowy kodu (plik jest ładowany przy starcie). Przy `http` aplikacja sama zakłada konto gościa
(`auth.autoGuest`) i dokleja token do wywołań. Wszystkie pozostałe wartości zmienne (adres mapy, domyślny widok, zasięg, limity zdjęć,
czas komunikatów, narzędzia deweloperskie) są w tym samym pliku, a kod nigdy nie ma ich na stałe.

Backend lokalnie: [`backend/README.md`](../backend/README.md). CORS dla `http://localhost:4200` jest już w jego konfiguracji.

## Jak to jest zbudowane (4 miejsca do znajomości)

| Plik | Rola |
|---|---|
| `src/app/core/config/` | wczytanie i walidacja YAML-a (błąd wskazuje dokładny klucz) |
| `src/app/core/api/api-providers.ts` | wybór implementacji `PokestopApi` i `GameApi` wg `api.mode` |
| `src/app/core/api/http/` | implementacje na prawdziwym backendzie + `pokestop.mapper.ts` (jedyne miejsce znające oba kształty danych) |
| `src/app/core/http/` | token JWT, konto gościa, interceptor, błędy w kształcie z kontraktu (`ApiHttpError`) |

Reszta aplikacji (strony, komponenty) rozmawia tylko z abstrakcjami `PokestopApi` i `GameApi`, więc **nie wie, czy dane są z atrapy, czy z bazy**.

## Stan adaptacji

| Operacja | `http` dziś | Co zrobić |
|---|---|---|
| Lista pinezek | działa | ładować wg widocznej części mapy (`?bbox=`) i stronicować; dziś jedna strona 200 sztuk |
| Kolekcja (`/me/collection`) | działa | brak |
| Zmiana statusu (admin) | działa | pole powodu przy odrzuceniu (dziś stały tekst) |
| Postęp gracza | działa | brak |
| Głosowanie | **`NotAdaptedYet`** | wybór pokemona z `GET /me/pokemons`, wysłanie pozycji użytkownika, obsługa `too_far` |
| Zgłoszenie | **`NotAdaptedYet`** | krok wyboru zastawianego pokemona (`stakedPokemonId`), wgranie zdjęć przez `POST /photos` (backend: 501) |
| Komentarze | **`NotAdaptedYet`** | `GET/POST /pokestops/{id}/comments` (stronicowane, z odpowiedziami) |
| Przeciwnicy i walka | **`NotAdaptedYet`** | backend zwraca jeszcze 501; ekran wyboru 3 pokemonów, wynik `lost` |
| Rola i profil | atrapa | rola z `GET /me` zamiast przełącznika (`SessionService`) |
| Ankiety, wydarzenia | brak | nowe ekrany (backend: 501) |

Pełna lista rozbieżności z numerami: [`api-contract.md`](api-contract.md), sekcja "Co musi zmienić frontend".
`NotAdaptedYet` rzuca czytelny komunikat z odwołaniem do punktu, więc po przełączeniu trybu widać dokładnie, czego jeszcze brakuje.

## Dostosowanie jednej operacji (wzór)

1. Zobacz kształt w `docs/openapi.yaml` i, jeśli trzeba, dopisz DTO w `core/api/http/contract.types.ts`.
2. Jeśli kształt różni się od modelu frontendu, zmapuj go w `pokestop.mapper.ts` (nie w komponentach).
3. Zaimplementuj metodę w `http-pokestop.api.ts` (zastąp `NotAdaptedYet`). Gdy interfejs `PokestopApi` nie niesie potrzebnych danych
   (np. `pokemonId`), rozszerz go i odpowiednio atrapę w `pokestop.api.mock.ts`, żeby oba tryby dalej działały.
4. Dodaj test z `HttpTestingController` (wzór: `http-pokestop.api.spec.ts`).
5. Ustaw tryb `http` dla tego obszaru i sprawdź w przeglądarce z włączonym backendem.

## Odświeżanie danych testowych z backendu

`src/app/core/api/http/testing/backend-sample.json` to **prawdziwe odpowiedzi** działającego backendu (testy mapowania opierają się na nich,
a nie na zgadywaniu kształtu). Po zmianie kontraktu odtwórz je: uruchom backend (`bootstrap` + `runserver`), utwórz kilka pinezek
przez dwóch użytkowników-gości i zapisz odpowiedzi `GET /pokestops`, `/me/collection`, `/me/progress` z perspektywy użytkownika, który zagłosował.

## Znane ograniczenia

- **Postać `festival`** (unikalna za wydarzenia) jest w odpowiedziach backendu, ale frontend zna 5 postaci (`CharacterId`). Kolekcja ją ignoruje, a potrzebuje modelu 3D lub wersji z kodu.
- **Tryb `http` w całości** wymaga jeszcze wyboru pokemona przy głosie i zgłoszeniu. Do tego czasu bezpiecznie jest zostawić `pokestops: mock` i przełączyć tylko to, co już działa.
- Narzędzia deweloperskie (przełącznik ról, symulator GPS) wyłącza `dev.tools: false`. W produkcji koniecznie.
