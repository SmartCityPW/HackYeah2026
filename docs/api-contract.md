# Kontrakt frontend ↔ backend

Źródłem prawdy jest **[`openapi.yaml`](openapi.yaml)** (OpenAPI 3.0.3, 23 operacje, 30 schematów). Ten dokument je omawia.
Kształt bazy danych: [`db/README.md`](db/README.md).

## Założenia

- **Serwer jest źródłem prawdy.** Klient nie liczy nagród, wyników walk ani XP, tylko wysyła intencję i pokazuje odpowiedź.
- REST + JSON, pola w **camelCase** (w Django np. `djangorestframework-camel-case`), daty ISO 8601 w UTC.
- Autoryzacja JWT (`Authorization: Bearer`). Konto gościa powstaje jednym wywołaniem (`POST /auth/guest`), później można je zapisać (`/auth/upgrade`) bez utraty postępu.
- Role: `resident`, `org`, `admin`. Uprawnienia egzekwuje serwer (np. administrator nie głosuje, scenariusze `org` tylko dla zweryfikowanych organizacji).
- Enumy w API są identyczne z typami ENUM w bazie (sprawdzone automatycznie).

## Mapa operacji

| Obszar | Operacje |
|---|---|
| Konta | `POST /auth/guest`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/upgrade`; `GET /me` |
| Scenariusze | `GET /scenarios?category=` (katalog dla roli); admin: `PUT /admin/scenarios/{code}` |
| Pinezki | `GET /pokestops?bbox=&type=&status=&organizationId=`, `POST /pokestops`, `GET /pokestops/{id}`, `POST /pokestops/{id}/vote`, `POST /pokestops/{id}/comments`, `POST /photos` |
| Użytkownik | `GET /me/collection`, `/me/progress`, `/me/interactions`, `/me/organization` |
| Gra | `GET /encounters?lat=&lng=&radius=`, `POST /encounters/{id}/attack` |
| Administracja | `PATCH /pokestops/{id}` (status), `GET /admin/organizations`, `PATCH /admin/organizations/{id}` |

## Reguły, które egzekwuje backend

- **Głosowanie:** jeden głos na użytkownika (klucz główny w bazie), bez zmiany. Pierwszy głos zwraca `awarded` (postać), kolejny `409`.
- **Zgłoszenie:** serwer ustala autora, status `open`, rodzaj pinezki (z scenariusza) i organizację (z członkostwa). `details` jest walidowane względem definicji scenariusza (pola wymagane, zakresy liczb, `showIf`). Błędy wracają w `fields` (klucz = `key` pola).
- **Walka:** serwer liczy odległość (dziś 50 m), ocenia wiarygodność pozycji, zapisuje każdą próbę (`game_attack`) i rozstrzyga. Zwycięstwo jest atomowe (unikalny indeks), więc dwóch graczy nie pokona tego samego przeciwnika. Klient sprawdza odległość tylko po to, by wyłączyć przycisk.
- **Przeciwnicy:** generuje wyłącznie serwer (losowanie z `game_enemy_type` wg wag, czas życia `expiresAt`).
- **Moderacja:** zmiana statusu zapisuje wpis w historii (`pokestops_status_change`). Odrzucona pinezka znika z mapy mieszkańców.

## Co musi zmienić frontend, żeby się spiąć z tym kontraktem

Dzisiejsze atrapy (`core/api/*.mock.ts`) działają inaczej w kilku miejscach. To lista do zrobienia przy podmianie na HTTP:

1. **Zdjęcia:** najpierw `POST /photos` (multipart), potem `photoIds` w `POST /pokestops`. Dziś frontend trzyma zdjęcia jako data URL w pamięci.
2. **Lista vs szczegóły:** lista ma tylko `commentCount`, komentarze przychodzą w `GET /pokestops/{id}` przy otwarciu pinezki.
3. **Nazwy:** `scenarioId` → `scenarioCode`. Odpowiedź na głos to `{stop, awarded}` (zgodnie z obecnym `VoteResult`).
4. **Pobieranie pinezek:** wg widocznego fragmentu mapy (`bbox`) i ze stronicowaniem, a nie "wszystkie naraz".
5. **Interakcje i kolekcja:** z `/me/interactions` i `/me/collection`, a nie wyliczane po stronie klienta.
6. **Katalog scenariuszy:** z `GET /scenarios` zamiast `scenario.catalog.ts` (ten plik zostaje źródłem seedu: `npm run db:seed-scenarios`).
7. **Rola i organizacja:** z `GET /me` i `/me/organization`, a tryb deweloperski (przełącznik ról, symulowany GPS) ma zniknąć lub zostać tylko w buildzie deweloperskim.
8. **Tokeny:** interceptor HTTP z JWT i odświeżaniem.

## Pytania otwarte (do rozmowy o backendzie)

1. **Wiele miast?** Schemat zakłada jedno wdrożenie. Jeśli aplikacja ma obsługiwać kilka miast, potrzebna jest tabela `city` i zakres (tenant) na pinezkach, organizacjach i przeciwnikach. To najtańsze zrobić teraz.
2. **Antyoszustwo w walce:** jakie sygnały uznajemy za podejrzane (skoki pozycji, nierealna prędkość, mock location, wiele kont z jednego urządzenia) i co robimy (odrzucenie, flaga, blokada)? Dziennik `game_attack` zbiera dane, a decyzje wymagają ustaleń.
3. **"Akcja na miejscu":** dziś weryfikuje się tylko obecność. Czy potrzebne jest potwierdzenie (zdjęcie, kod QR, czas pobytu)? Schemat ma `action_kind` na to miejsce.
4. **Reguła nagrody dla autora** ("jeśli dużo osób potwierdzi, autor dostaje pokemona"): jaki próg i czy zależy od typu? Tabela nagród ma na to źródło `report_confirmed`.
5. **Generowanie przeciwników:** gęstość, limity na obszar, odnawianie, zadanie okresowe (Celery beat albo cron). Czy mają zależeć od liczby graczy w okolicy?
6. **RODO i lokalizacja:** jak długo trzymamy pozycje z prób ataku, czy anonimizujemy użytkowników zamiast ich usuwać (klucze obce `RESTRICT` na autorach są pod to przygotowane).
7. **Moderacja treści:** zdjęcia i komentarze (dziś komentarz można ukryć, zdjęcia nie mają jeszcze statusu moderacji).
8. **Aktualizacje na żywo** (nowe pinezki, głosy): wystarczy odpytywanie, czy potrzebne WebSockety?
9. **Słownik postaci:** frontend trzyma jego opis (nazwy, ikony, modele 3D). Czy ma być też dostępny z API (`GET /characters`)?
10. **Podział na aplikacje Django (SRP):** `accounts`, `scenarios`, `pokestops`, `collection`, `game`. Granice w schemacie są dobrane tak, by każda miała własne tabele, a zależności szły w jedną stronę (`game` → `accounts`; `collection` → `pokestops`, `game`).
