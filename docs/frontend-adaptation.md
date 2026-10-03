# Frontend: przejście z atrap na backend

Dla osoby, która dokańcza frontend. Aplikacja ma dziś dwa tryby danych **per obszar**, przełączane w jednym pliku,
a nie w kodzie. Dzięki temu można przechodzić z atrap na prawdziwy backend krok po kroku.

## Przełączanie

[`frontend/public/config/app-config.yaml`](../frontend/public/config/app-config.yaml):

```yaml
api:
  baseUrl: http://localhost:8000/api/v1
  mode:
    pokestops: mock     # mock | http   (pinezki, głosy, komentarze, kolekcja, pokemony)
    game: mock          # mock | http   (postęp, przeciwnicy, walka)
    account: mock       # mock | http   (rola i profil z GET /me; z http przełącznik ról jest ukryty)
    catalog: mock       # mock | http   (słownik postaci: catalog.mock.json albo GET /catalog)
```

**Postacie (Spryciaki) nie są wpisane w kodzie.** Jedynym źródłem jest `backend/config/seed/reference.yaml` (kod, nazwa, typ, moc,
postać startowa, model 3D glTF w `modelPath` względem `frontend/public/`). Backend ładuje go do bazy (`manage.py bootstrap`) i zwraca
przez `GET /catalog`; dla atrap `python manage.py export_reference` generuje `frontend/src/app/core/catalog/catalog.mock.json`
(oraz `docs/db/seed_reference.sql`). Frontend czyta postacie wyłącznie przez `CatalogService`. Wymiana zestawu: edycja YAML-a,
modele do `frontend/public/models/`, `export_reference`, a testy (`test_reference_catalog.py`, `catalog.service.spec.ts`) wskażą
nieaktualne pliki i scenariusze albo atrapy pinezek wskazujące usunięte postacie.

Zmiana wartości nie wymaga przebudowy kodu (plik jest ładowany przy starcie). Przy `http` (w którymkolwiek obszarze) aplikacja sama zakłada konto gościa
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

| Operacja | `http` dziś | Co zostało |
|---|---|---|
| Rola i profil (`GET /me`) | działa (`account: http`) | brak logowania w UI: bez niego rolą jest zawsze gość (resident). Organizacja i administrator wymagają tokenu wklejonego ręcznie (patrz README, krok 6) |
| Lista pinezek | działa, **wg widocznego obszaru mapy** (`?bbox=`, strony pobierane do końca) | brak |
| „Moje inicjatywy” | działa (`GET /me/interactions`) | brak |
| Pinezka po linku `?stop=ID` | działa (`GET /pokestops/{id}`) | brak |
| Kolekcja, postęp | działa | brak |
| Pokemony (`GET /me/pokemons`) | działa: wybór pokemona przy głosie i przy zastawie | zakładka „Pokemony” z poziomami (opis.md) |
| Głosowanie | działa: wybrany pokemon dostaje exp, wysyłana jest pozycja, błąd `too_far` pokazuje komunikat serwera | pozycja pochodzi z GPS przeglądarki, więc bez zgody na lokalizację nie da się głosować |
| Zgłoszenie | działa: zastaw pokemona, wynik moderacji (`moderation_rejected`, `moderation_unavailable`), formularz zostaje przy błędzie | **zdjęcia**: `POST /photos` w backendzie to 501, więc pola zdjęć są ukryte przez `upload.enabled: false` |
| Komentarze | działa: lista stronicowana (najnowsze pierwsze), odpowiedzi w wątku, „Pokaż starsze” | brak |
| Zmiana statusu (admin) | działa | pole powodu przy odrzuceniu (dziś stały tekst) |
| Przeciwnicy i walka | `NotAdaptedYet` | backend zwraca jeszcze 501; ekran wyboru 3 pokemonów, wynik `lost` |
| Losy inicjatywy (oś czasu, pola własne, status z komentarzem) | działa: `GET /pokestops/{id}/timeline`, `POST/PATCH/DELETE .../updates`, `PATCH /pokestops/{id}`; karta inicjatywy rozwija się, a organizator ma panel prowadzenia (`features/org/initiative-manager`) | brak |
| Ankiety zaufanych podmiotów | działa: formularz i ekran nagrody (`features/map/survey`), kreator pytań (`shared/question-builder`), wyniki w panelu organizatora | brak |
| Wydarzenia | brak | nowe ekrany (backend: 501) |

Pełna lista rozbieżności z numerami: [`api-contract.md`](api-contract.md), sekcja "Co musi zmienić frontend".
`NotAdaptedYet` rzuca czytelny komunikat z odwołaniem do punktu, więc po przełączeniu trybu widać dokładnie, czego jeszcze brakuje.

### Jak frontend pokazuje błędy serwera

Błędy w kształcie z kontraktu (`{ code, message }`) trafiają do `ApiHttpError`, a `describeError()` zamienia je na tekst dla użytkownika.
Backend zwraca czytelne polskie komunikaty (np. „Jesteś za daleko (1112 m), podejdź na mniej niż 50 m”), więc pokazujemy je wprost, bez
własnych tłumaczeń kodów. Własny tekst jest tylko dla braku połączenia i błędów spoza kontraktu. Strona mapy łapie błędy w jednym miejscu
(`MapPage.run`) i pokazuje je w toaście, a szkic komentarza i wypełniony formularz zgłoszenia zostają, żeby można było poprawić i ponowić.

### Atrapa zachowuje się jak backend

`MockPokestopApi` egzekwuje te same reguły co serwer: zasięg głosu (z `game.interactionRangeM`), jeden głos na pinezkę, zakaz głosu na własną,
exp dla wybranego pokemona, zastaw przy zgłoszeniu, odpowiedzi tylko pod komentarzem nadrzędnym tej samej pinezki. Dzięki temu logika ekranów
jest ta sama w obu trybach. **Konsekwencja dla demo na atrapach:** żeby zagłosować, włącz 📍 GPS (pozycja na Rynku); w zasięgu jest pinezka
„Zniszczona ławka przy Rynku”.

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

- **Postać za wydarzenia:** obecny zestaw Spryciaków nie ma postaci `is_event_exclusive` (dawna `festival` jest wyłączona). Do ustalenia przy wydarzeniach (Etap 4).
- **Tryb `http` dla `pokestops` i `account` jest kompletny dla pętli gry** (głos, zgłoszenie, komentarze). Walka (`game: http`) i zdjęcia czekają na backend, więc `game` zostaje na `mock`.
- **Tryb `http` wymaga działającego backendu już przy starcie** (zakłada konto gościa i pobiera `/me`). Gdy backend nie odpowiada, aplikacja się nie uruchomi (biały ekran). Ekran błędu startu to zadanie na etap wdrożeniowy.
- Narzędzia deweloperskie (przełącznik ról, symulator GPS) wyłącza `dev.tools: false`. W produkcji koniecznie.
