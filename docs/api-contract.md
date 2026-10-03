# Kontrakt frontend ↔ backend

Źródłem prawdy jest **[`openapi.yaml`](openapi.yaml)** (OpenAPI 3.0.3, 24 operacje, 36 schematów). Ten dokument je omawia.
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
| Użytkownik | `GET /me/collection`, `/me/pokemons`, `/me/progress`, `/me/interactions`, `/me/organization` |
| Gra | `GET /encounters?lat=&lng=&radius=`, `POST /encounters/{id}/attack` |
| Administracja | `PATCH /pokestops/{id}` (status), `GET /admin/organizations`, `PATCH /admin/organizations/{id}` |

`GET /me/pokemons` jest nowe: zwraca listę posiadanych egzemplarzy (nie tylko liczbę per gatunek jak
`/me/collection`) — poziom, exp i moc każdego, do zakładki "Pokemony", do wyboru pokemona przy głosowaniu/zgłaszaniu
i do wyboru 3 pokemonów do walki.

## Reguły, które egzekwuje backend

- **Kółko interakcji (jak w Pokémon GO):** wokół gracza jest kółko o promieniu **50 m** (stała aplikacji, ta sama
  co zasięg ataku). Tylko w nim można **głosować, komentować, dodawać pinezki i walczyć**. Klient wysyła w tych
  akcjach swoją pozycję (`position: PlayerPosition` przy głosie, komentarzu i nowej pinezce; `lat`/`lng` przy
  ataku), a serwer sam liczy odległość od celu: przy głosie i komentarzu od pinezki, przy nowej pinezce od jej
  `lat`/`lng`. Poza kółkiem odpowiada `422` z kodem `too_far` (`TooFarError`: `distanceM`, `radiusM`) i niczego nie
  zapisuje (głos, exp, komentarz, pinezka). Podgląd pinezki (`GET /pokestops/{id}`) działa z każdej odległości.
  Na mapie kółko ma stały promień w metrach, więc przybliżanie mapy nie zwiększa zasięgu i trzeba podejść.
- **Głosowanie:** jeden głos na użytkownika (klucz główny w bazie), bez zmiany. Głosujący wskazuje `pokemonId`
  (jeden z własnych, dowolny — może być zastawiony) i **przy pierwszym głosie** ten pokemon dostaje +10 exp
  (`VoteResult.pokemon`, patrz niżej); kolejna próba głosu na tę samą pinezkę zwraca `409` i exp się nie powtarza.
  Administrator nie głosuje (`403`).
- **Zgłoszenie:** serwer ustala autora, status `open`, rodzaj pinezki (z scenariusza) i organizację (z członkostwa).
  Dla `report`/`idea` klient **musi** podać `stakedPokemonId` — jeden z własnych, niezastawionych pokemonów; serwer
  wymusza, że jego gatunek = `character` pinezki, i oznacza go jako zastawiony (nie da się go użyć do walki, dopóki
  nie wróci). `details` jest walidowane względem definicji scenariusza (pola wymagane, zakresy liczb, `showIf`).
  Błędy wracają w `fields` (klucz = `key` pola).
- **Zwrot zastawionego pokemona:** gdy `votesFor` zgłoszenia osiągnie próg scenariusza (`votesRequired`, domyślnie
  10), serwer automatycznie zwraca pokemona autorowi i dopisuje mu +50 exp — bez dodatkowego wywołania API, widoczne
  przy kolejnym `GET /pokestops/{id}` jako `stakeReleasedAt`.
- **Walka:** klient wybiera do 3 własnych, niezastawionych pokemonów (`pokemonIds`) i wysyła pozycję. Serwer liczy
  odległość (dziś 50 m; za daleko → `too_far`, pokemony się nie liczą), dla pokemonów w zasięgu liczy moc każdego
  (z jego exp) × **1.2, jeśli jego typ = typ przeciwnika**, sumuje i porównuje z mocą przeciwnika
  (`Encounter.power`). Suma większa → `won`: każdy użyty pokemon dostaje exp (= `xpReward`), gracz dostaje nową
  postać do kolekcji i XP. Suma mniejsza lub równa → `lost`: próba się zapisuje, nagrody nie ma, przeciwnik
  pozostaje aktywny i można próbować ponownie (także innymi pokemonami). Zwycięstwo jest atomowe (unikalny indeks),
  więc dwóch graczy nie pokona tego samego przeciwnika. Klient liczy odległość i podgląd mocy tylko na wyświetlanie —
  serwer rozstrzyga walkę od nowa.
- **Przeciwnicy:** generuje wyłącznie serwer (losowanie z `game_enemy_type` wg wag, czas życia `expiresAt`); moc i
  typ przeciwnika są widoczne w `GET /encounters`, żeby gracz mógł dobrać pokemony przed podejściem. Pojawiają się
  wokół gracza: w kółku interakcji krąży od **0 do 5** przeciwników. Serwer losuje docelową liczbę (na nowo po ~40 m
  marszu), dogenerowuje brakujących w losowych miejscach kółka, a ci, od których gracz odszedł, znikają. Klient
  pyta `GET /encounters?radius=50` po każdych ~10 m ruchu i co ~30 s na postoju.
- **Pokemon startowy:** `POST /auth/guest` i `POST /auth/register` przyznają jeden egzemplarz gatunku startowego —
  inaczej nowy gracz nie miałby czym głosować.
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
9. **Wybór pokemona przy głosowaniu i zgłaszaniu:** ekran głosu musi dać wybrać `pokemonId` z `/me/pokemons` (nie wysyłać samego `vote`), a formularz zgłoszenia problemu/pomysłu — `stakedPokemonId` (i pokazać, że ten pokemon jest "zablokowany" do zwrotu progu głosów).
10. **Pozycja gracza w akcjach na pinezkach:** atrapa (`MockPokestopApi`) już wymaga `position` i rzuca
    `TooFarError` poza kółkiem — implementacja HTTP ma wysyłać `position` w `POST /pokestops`, `/vote` i `/comments`
    oraz zamieniać odpowiedź `422 too_far` na `TooFarError`.
11. **Ekran walki:** ✔ zrobione na atrapie (`features/map/battle`). Przebieg: kliknięcie przeciwnika w kółku →
    tryb walki (kamera najeżdża na przeciwnika) → akcja na miejscu (20 s w kółku) → wybór 1–3 pokemonów z
    `/me/pokemons` z podglądem mocy i mnożnika ×1.2 → `POST /encounters/{id}/attack` → wynik `won` (exp dla drużyny,
    nowa postać, XP) albo `lost` (ponowna próba innym składem). Wyjście z kółka przed starciem przerywa walkę.
    Przy podmianie na HTTP: `MockGameApi` → implementacja HTTP, kształty odpowiedzi są już zgodne z `openapi.yaml`.

## Pytania otwarte (do rozmowy o backendzie)

1. **Wiele miast?** Schemat zakłada jedno wdrożenie. Jeśli aplikacja ma obsługiwać kilka miast, potrzebna jest tabela `city` i zakres (tenant) na pinezkach, organizacjach i przeciwnikach. To najtańsze zrobić teraz.
2. **Antyoszustwo w walce:** jakie sygnały uznajemy za podejrzane (skoki pozycji, nierealna prędkość, mock location, wiele kont z jednego urządzenia) i co robimy (odrzucenie, flaga, blokada)? Dziennik `game_attack` zbiera dane, a decyzje wymagają ustaleń.
3. **"Akcja na miejscu":** frontend wymaga 20 s pobytu w kółku przy przeciwniku przed wyborem drużyny, ale liczy to
   tylko klient. Żeby serwer to egzekwował, musiałby pamiętać pierwszą pozycję gracza w zasięgu przeciwnika (np.
   `POST /encounters/{id}/checkin`) i odrzucać atak wcześniej niż po 20 s. Czy to potrzebne na hackathon? Czy
   dla `action_kind = checkin` wystarczy sama obecność, a czas pobytu tylko dla `dwell`?
4. **Stałe gry (exp za głos = 10, za potwierdzone zgłoszenie = 50, mnożnik typu = 1.2, próg głosów = 10):** to
   wartości-placeholder do wytuningowania na podstawie testów, dziś stałe w kodzie backendu. Jeśli mają się zmieniać
   bez wdrożenia, potrzebna osobna tabela `game_config` (key/value) — czy to jest potrzebne na hackathon, czy można
   to zahardkodować?
5. **Farmienie walk:** gracz może dowolną liczbę razy przegrać i spróbować ponownie tym samym przeciwnikiem (nie ma
   cooldownu). Czy to problem (np. przy teście różnych trójek pokemonów), czy zostaje tak jak jest?
6. **Generowanie przeciwników:** zasada jest ustalona (0–5 w kółku gracza, patrz wyżej), otwarte zostaje, czy
   przeciwnicy są osobni dla każdego gracza, czy wspólni dla graczy stojących obok siebie (wtedy limit 5 dotyczy
   obszaru, nie gracza), oraz jak serwer ma się bronić przed "teleportowaniem" w celu losowania nowych przeciwników.
7. **RODO i lokalizacja:** jak długo trzymamy pozycje z prób walki, czy anonimizujemy użytkowników zamiast ich usuwać (klucze obce `RESTRICT` na autorach są pod to przygotowane).
8. **Moderacja treści:** zdjęcia i komentarze (dziś komentarz można ukryć, zdjęcia nie mają jeszcze statusu moderacji).
9. **Moderacja zgłoszeń przez agenta AI:** dziś nie ma dedykowanej tabeli na jego werdykt — zakładamy, że ocena
   dzieje się synchronicznie przy `POST /pokestops` (odrzucone przez agenta nigdy nie trafia do bazy jako widoczne;
   `pokestops_status_change` z `changedById = null` służy tylko do późniejszych zmian przez administratora). Czy to
   wystarczające, czy potrzebny jest log samych decyzji agenta (np. do testów/promptu)?
10. **Aktualizacje na żywo** (nowe pinezki, głosy, walki w okolicy): wystarczy odpytywanie, czy potrzebne WebSockety?
11. **Słownik postaci i typów:** frontend trzyma jego opis (nazwy, ikony, modele 3D). Czy ma być też dostępny z API (`GET /characters`, `GET /types`)?
12. **Podział na aplikacje Django (SRP):** `accounts`, `scenarios`, `pokestops`, `collection`, `game`. `collection` i
    `game` zależą teraz od siebie nawzajem (walka używa posiadanych pokemonów, wygrana tworzy nowego) — patrz
    [`db/README.md`](db/README.md) sekcja "Podział na aplikacje". To jest zamierzone, nie przeoczenie.
