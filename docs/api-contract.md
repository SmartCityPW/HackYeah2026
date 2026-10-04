# Kontrakt frontend ↔ backend

Źródłem prawdy jest **[`openapi.yaml`](openapi.yaml)** (OpenAPI 3.0.3, 36 operacji, 51 schematów). Ten dokument je omawia.
Wymagania: [`opis.md`](opis.md). Kształt bazy danych: [`db/README.md`](db/README.md).

## Założenia

- **Serwer jest źródłem prawdy.** Klient nie liczy nagród, wyników walk ani XP, tylko wysyła intencję i pokazuje odpowiedź.
- REST + JSON, pola w **camelCase** (w Django np. `djangorestframework-camel-case`), daty ISO 8601 w UTC.
- Autoryzacja JWT (`Authorization: Bearer`). Konto gościa powstaje jednym wywołaniem (`POST /auth/guest`), później można je zapisać (`/auth/upgrade`) bez utraty postępu.
- Role: `resident`, `org`, `admin`. Uprawnienia egzekwuje serwer (np. administrator nie głosuje, scenariusze `org` tylko dla zweryfikowanych organizacji).
- Enumy w API są identyczne z typami ENUM w bazie (sprawdzone automatycznie).

## Mapa operacji

| Obszar | Operacje |
|---|---|
| Konta | `POST /auth/guest`, `/auth/register`, `/auth/register-organization`, `/auth/login`, `/auth/refresh`, `/auth/upgrade`; `GET /me` |
| Scenariusze i słowniki | `GET /scenarios?category=` (katalog dla roli), `GET /catalog` (postacie i typy); admin: `PUT /admin/scenarios/{code}` |
| Pinezki | `GET /pokestops?bbox=&type=&status=&organizationId=`, `POST /pokestops`, `GET /pokestops/{id}`, `POST /pokestops/{id}/vote`, `POST /pokestops/{id}/withdraw`, `POST /photos` |
| Dyskusja | `GET /pokestops/{id}/comments` (stronicowane, z odpowiedziami), `POST /pokestops/{id}/comments` |
| Ankiety | `POST /pokestops/{id}/survey-responses`, `GET /pokestops/{id}/survey-results` (organizacja i administrator) |
| Wydarzenia | `GET /events?bbox=&from=&to=`, `POST /events`, `GET /events/{id}`, `PATCH /events/{id}` (odwołanie), `POST /events/{id}/check-in` |
| Użytkownik | `GET /me/collection`, `/me/pokemons`, `/me/progress`, `/me/interactions`, `/me/organization`; publicznie `GET /organizations/{id}` |
| Gra | `GET /encounters?lat=&lng=&radius=`, `POST /encounters/{id}/attack` |
| Administracja | `PATCH /pokestops/{id}` (status), `GET /admin/organizations`, `PATCH /admin/organizations/{id}` |

`GET /me/pokemons` jest nowe: zwraca listę posiadanych egzemplarzy (nie tylko liczbę per gatunek jak
`/me/collection`) — poziom, exp i moc każdego, do zakładki "Pokemony", do wyboru pokemona przy głosowaniu/zgłaszaniu
i do wyboru 3 pokemonów do walki.

## Reguły, które egzekwuje backend

- **Kółko interakcji** (`opis.md`, jak w Pokémon GO): wokół gracza jest kółko o promieniu **50 m** (konfiguracja
  `game.interaction_range_m`, ten sam zasięg co atak). Tylko w nim można **głosować, dodawać pinezki, walczyć** (oraz
  wypełniać ankiety i meldować się na wydarzeniach). **Komentować można z dowolnego miejsca**, podgląd pinezki
  (`GET /pokestops/{id}`) też. Klient wysyła w tych akcjach swoją pozycję: `position` (`PositionRequest`) przy głosie i
  nowej pinezce, `lat`/`lng` przy ataku. Serwer liczy odległość sam: przy głosie od pinezki, przy nowej pinezce od jej
  `lat`/`lng`. Poza kółkiem odpowiada `422` z kodem `too_far` (`TooFarError`: `distanceM`, `radiusM`) i niczego nie
  zapisuje (głos, exp, pinezka, zastaw). Na mapie kółko ma stały promień w metrach, więc przybliżanie nie zwiększa
  zasięgu i trzeba podejść. (Decyzja 2026-10-03: kółko ogranicza głos, walkę i nowe pinezki, a komentarze nie.)
- **Głosowanie:** jeden głos na użytkownika (klucz główny w bazie), bez zmiany. Głosujący wskazuje `pokemonId`
  (jeden z własnych, dowolny — może być zastawiony) i **przy pierwszym głosie** ten pokemon dostaje +10 exp
  (`VoteResult.pokemon`, patrz niżej); kolejna próba głosu na tę samą pinezkę zwraca `409` i exp się nie powtarza.
  Administrator nie głosuje (`403`), autor nie głosuje na własną pinezkę (`403`, kod `own_pokestop`).
- **Zgłoszenie:** serwer ustala autora, status `open`, rodzaj pinezki (z scenariusza) i organizację (z członkostwa).
  Dla `report`/`idea` klient **musi** podać `stakedPokemonId` — jeden z własnych, niezastawionych pokemonów; serwer
  wymusza, że jego gatunek = `character` pinezki, i oznacza go jako zastawiony (nie da się go użyć do walki, dopóki
  nie wróci). `details` jest walidowane względem definicji scenariusza (pola wymagane, zakresy liczb, `showIf`).
  Błędy wracają w `fields` (klucz = `key` pola).
- **Zwrot zastawionego pokemona.** Decyzję i wysokość premii podejmuje aplikacja w jednej transakcji, bez zadań w tle:
  - `votesFor` osiąga próg scenariusza (`votesRequired`, domyślnie 10) → zwrot **+50 exp**, w tej samej transakcji co głos,
  - administrator ustawia `resolved` → zwrot **+50 exp** (zgłoszenie zrobiło swoje), o ile zwrot nie nastąpił wcześniej,
  - administrator ustawia `rejected` albo autor wycofuje zgłoszenie (`POST /pokestops/{id}/withdraw`) → zwrot **bez premii**.

  Bez ostatnich dwóch punktów pokemon zastawiony na odrzuconym lub martwym zgłoszeniu byłby zablokowany na zawsze.
  Skutek jest widoczny w `GET /pokestops/{id}` jako `stakeReleasedAt`.
- **Walka:** klient wybiera do 3 własnych, niezastawionych pokemonów (`pokemonIds`) i wysyła pozycję. Serwer liczy
  odległość (dziś 50 m; za daleko → wynik `too_far`, pokemony się nie liczą), dla pokemonów w zasięgu liczy moc każdego
  (z jego exp) × **1.2, jeśli jego typ = typ przeciwnika**, sumuje i porównuje z mocą przeciwnika
  (`Encounter.power`). Suma większa → `won`: każdy użyty pokemon dostaje exp (= `xpReward`), gracz dostaje nową
  postać do kolekcji i XP. Suma mniejsza lub równa → `lost`: próba się zapisuje, nagrody nie ma, przeciwnik
  pozostaje aktywny i można próbować ponownie (także innymi pokemonami). Zwycięstwo jest atomowe (unikalny indeks),
  więc dwóch graczy nie pokona tego samego przeciwnika. Klient liczy odległość i podgląd mocy tylko na wyświetlanie —
  serwer rozstrzyga walkę od nowa. Nowa postać za wygraną jest losowana z aktywnych postaci poza unikalnymi za
  wydarzenia (`festival`), a XP gracza = `xpReward`. Kody błędów: `403` administrator, `409` `encounter_defeated` /
  `encounter_expired`, `422` `validation_error` (drużyna) lub kod weryfikacji pozycji (`gps_inaccurate`, `implausible_movement` itd., próba zapisana jako
  `rejected`), `429` `too_many_requests` (próba niezapisana).
- **Przeciwnicy:** generuje wyłącznie serwer (losowanie z `game_enemy_type` wg wag, czas życia `expiresAt`); moc i
  typ przeciwnika są widoczne w `GET /encounters`, żeby gracz mógł dobrać pokemony przed podejściem. Są
  **generowani indywidualnie dla każdego gracza** i przypisani do miejsc: teren dzieli się na kwadraty 100 × 100 m, a kwadrat
  danego gracza przy pierwszym odwiedzeniu losuje 0–6 przeciwników, którzy stoją w miejscu do pokonania albo wygaśnięcia, a wyczyszczony
  kwadrat zasiedla się na nowo po ~60 s. Gracze stojący obok siebie widzą różnych przeciwników, a cudzego nie da się zaatakować (`404`). `GET /encounters?radius=50` zwraca najbliższych w kółku, **najwyżej 5** (może nie być żadnego). Klient
  pyta po każdych ~10 m ruchu i co ~30 s na postoju. Wartości są konfiguracją (`game.encounters`).
- **Pokemon startowy:** `POST /auth/guest` i `POST /auth/register` przyznają jeden egzemplarz gatunku startowego —
  inaczej nowy gracz nie miałby czym głosować.
- **Moderacja AI (tylko zgłoszenia mieszkańców):** przed zapisem agent ze zahardkodowanym promptem dostaje treść zgłoszenia i
  zwraca wyłącznie tak/nie (`opis.md`). Nie → `422` z kodem `moderation_rejected` i ogólnym komunikatem (agent nie podaje
  powodu), nic się nie zapisuje, pokemon nie jest zastawiany. Brak odpowiedzi w 5 s → `503` z kodem `moderation_unavailable`,
  zgłoszenie nie powstaje i użytkownik może ponowić. Zgłoszenia zweryfikowanych organizacji agenta nie przechodzą.
  Każdy werdykt trafia do `pokestops_moderation_log`.
- **Ankiety:** pinezka `ngo`/`consultation` może mieć pytania (typy: tekst, liczba, wybór, wielokrotny wybór, tak/nie,
  ocena). Jedno wypełnienie na użytkownika (`409`). Odpowiedzi walidowane względem pytań. Za wypełnioną ankietę serwer
  przyznaje **nowego pokemona** gatunku pinezki. Organizacja widzi zbiorcze wyniki (`survey-results`): to, co zbierałaby
  w konsultacjach.
- **Wydarzenia:** tworzy je zweryfikowana organizacja albo samorząd. Udział to zameldowanie na miejscu, w czasie trwania i w
  zasięgu (`check-in`), z limitem miejsc i jednorazowością. Nagroda: **unikalny pokemon** (gatunek oznaczony `is_event_exclusive`,
  który nie wypada z walk ani ankiet).
- **Dyskusja:** komentarze nadrzędne i odpowiedzi (jeden poziom). Lista jest stronicowana po komentarzach nadrzędnych.
- **Rejestracja organizacji:** `POST /auth/register-organization` tworzy konto `org` i organizację `pending`. Do weryfikacji przez
  administratora nie można publikować inicjatyw, ankiet ani wydarzeń.
- **Moderacja administratora:** zmiana statusu zapisuje wpis w historii (`pokestops_status_change`). Odrzucona pinezka znika z mapy mieszkańców.

## Co musi zmienić frontend, żeby się spiąć z tym kontraktem

Dzisiejsze atrapy (`core/api/*.mock.ts`) działają inaczej w kilku miejscach. To lista do zrobienia przy podmianie na HTTP:

1. **Zdjęcia:** najpierw `POST /photos` (multipart), potem `photoIds` w `POST /pokestops`. Dziś frontend trzyma zdjęcia jako data URL w pamięci.
2. **Lista vs szczegóły:** lista ma tylko `commentCount`, komentarze przychodzą w `GET /pokestops/{id}` przy otwarciu pinezki.
3. **Nazwy i odpowiedzi:** `scenarioId` → `scenarioCode`. Odpowiedź na głos to `{stop, pokemon}` (pokemon po doliczeniu exp), a nie `{stop, awarded}` jak w dzisiejszej atrapie.
4. **Pobieranie pinezek:** wg widocznego fragmentu mapy (`bbox`) i ze stronicowaniem, a nie "wszystkie naraz".
5. **Interakcje i kolekcja:** z `/me/interactions` i `/me/collection`, a nie wyliczane po stronie klienta.
6. **Katalog scenariuszy:** z `GET /scenarios` zamiast `scenario.catalog.ts` (ten plik zostaje źródłem seedu: `npm run db:seed-scenarios`).
7. **Rola i organizacja:** z `GET /me` i `/me/organization`, a tryb deweloperski (przełącznik ról, symulowany GPS) ma zniknąć lub zostać tylko w buildzie deweloperskim.
8. **Tokeny:** interceptor HTTP z JWT i odświeżaniem.
9. **Wybór pokemona przy głosowaniu i zgłaszaniu:** ekran głosu musi dać wybrać `pokemonId` z `/me/pokemons` (nie wysyłać samego `vote`), a formularz zgłoszenia problemu/pomysłu — `stakedPokemonId` (i pokazać, że ten pokemon jest "zablokowany" do zwrotu progu głosów).
10. **Ekran walki:** ✔ zrobione (`features/map/battle`). Kliknięcie przeciwnika w kółku → tryb walki (kamera najeżdża na
    przeciwnika) → akcja na miejscu (czas z `app-config.yaml`) → wybór 1–3 pokemonów z `/me/pokemons` z podglądem mocy
    i mnożnika → `POST /encounters/{id}/attack` → wynik `won` (exp dla drużyny, nowa postać, XP) albo `lost` (ponowna
    próba innym składem). Wyjście z kółka przed starciem przerywa walkę po krótkim czasie łaski.
11. **Słownik z API:** postacie i typy z `GET /catalog` zamiast stałych `CHARACTERS` w kodzie (modele 3D zostają we frontendzie, wiązane po `code`).
12. **Zgłoszenie z pokemonem:** postać na pinezce `report`/`idea` to gatunek zastawionego pokemona, a nie pole scenariusza. Wymaga to kroku wyboru pokemona w formularzu i przycisku "Wycofaj zgłoszenie".
13. **Odrzucenie przez moderację:** błąd `moderation_rejected` pokazać użytkownikowi (komunikat ogólny, bez powodu) bez utraty wpisanych danych, a `moderation_unavailable` jako "spróbuj ponownie".
14. **Pozycja w akcjach na pinezkach:** ✔ zrobione. `POST .../vote` i `POST /pokestops` wysyłają `position`, a `422 too_far` jest zamieniane na `TooFarError` (komunikat „Za daleko: 112 m. Podejdź na mniej niż 50 m”). Przycisk głosu i dodawania pinezki jest nieaktywny poza kółkiem.
15. **Ankiety:** wyświetlenie `questions` na karcie pinezki `ngo`/`consultation`, formularz odpowiedzi (z nagrodą-pokemonem) oraz po stronie organizacji kreator pytań i widok wyników.
16. **Wydarzenia:** nowy rodzaj pinezki na mapie, szczegóły, przycisk zameldowania i panel organizacji do tworzenia wydarzeń.
17. **Komentarze:** `GET .../comments` ze stronicowaniem i odpowiedziami zamiast pełnej listy w szczegółach pinezki (dziś `comments` siedzą w obiekcie pinezki).
18. **Rejestracja organizacji:** formularz zakładania konta organizacji i widok "oczekuje na weryfikację".
19. **Postać `festival`** (unikalna za wydarzenia) dochodzi do słownika postaci frontendu: potrzebuje modelu 3D albo wersji z kodu.

## Decyzje

Podjęte na podstawie założeń: hackathon (liczy się działające demo, nie pełna produkcyjność), jeden zespół i jedno wdrożenie,
reguły w jednym miejscu (SRP). Gdzie decyzja ma świadomy koszt, jest on wypisany.

| # | Kwestia | Decyzja | Uzasadnienie / koszt |
|---|---|---|---|
| 1 | Wiele miast | **Nie w MVP.** Jedno wdrożenie, bez tabeli `city`. | Dodanie `city_id` do pinezek, organizacji i przeciwników to później zmiana addytywna (nowa kolumna z domyślną wartością). Dziś tylko komplikuje każde zapytanie. |
| 2 | Antyoszustwo w walce | **Limity częstotliwości w walce:** 1 próba na 5 s i 20 na godzinę (`429`). Wiarygodność pozycji (dokładność, aktualność, tempo ruchu, źródło) sprawdza od decyzji 38 jeden mechanizm dla wszystkich akcji; odrzucona próba walki zapisuje się jako `rejected` z powodem w `game_attack`. | Wykrywanie sztucznej lokalizacji z poziomu PWA jest niemożliwe, więc nie obiecujemy tego. Ryzyko znane. |
| 3 | "Akcja na miejscu" | **Tylko obecność** (`action_kind = 'checkin'` dla wszystkich). `actionLabel` to instrukcja w interfejsie, bez weryfikacji. | Weryfikacja zdjęciem lub kodem QR to osobna funkcja. Kolumna zostaje na przyszłość. W demo mówimy to otwarcie. |
| 4 | Stałe gry | **Wartości w pliku YAML** (`backend/config/default.yaml`, sekcja `game`): exp za głos 10, premia za zwrot 50, mnożnik typu 1.2, zasięg interakcji 50 m (głos, ankieta, zameldowanie, atak), drużyna 3, poziomy, limity antyoszustwa. **Bez tabeli `game_config`.** | Pierwotnie zahardkodowane w module, ale zasada projektu mówi, że wszystkie wartości zmienne leżą w YAML-u (sekrety w zmiennych środowiskowych). Zmiana = edycja pliku, bez migracji i bez przebudowy. Triggery nagród usunięte, baza zapisuje tylko wynik (`exp_granted`, `stake_bonus_exp`, `type_multiplier_applied`), więc zmiana wartości nie psuje historii. Test sprawdza, że zmiana w konfiguracji rzeczywiście zmienia zachowanie. |
| 5 | Farmienie walk | **Bez cooldownu po porażce.** | Moc przeciwnika jest jawna, a próba kosztuje tylko czas i mieści się w limicie z pkt 2. Cooldown utrudniałby testowanie różnych trójek. |
| 6 | Generowanie przeciwników | **Leniwie przy `GET /encounters`, bez Celery** (decyzja 2026-10-03: zasady z brancha `enemy_and_point_of_interest_range_detection`). Kwadraty **100 × 100 m**, **osobne dla każdego gracza** (decyzja 39: zmiana ze wspólnych kwadratów 2026-10-04); kwadrat gracza przy pierwszym odwiedzeniu losuje **0–6** przeciwników wg `spawn_weight`, życie 30 min, wyczyszczony kwadrat odnawia się po **60 s**, odpowiedź zawiera **najwyżej 5** najbliższych w kółku. Wygasłe odfiltrowane po `expires_at` i oznaczane `expired`. Wartości w YAML (`game.encounters`). | Zero infrastruktury w tle. Gracze obok siebie widzą różnych przeciwników. Koszt: pierwsze zapytanie w nowym kwadracie jest wolniejsze, a wiersze rosną z liczbą graczy (czyści je `prune_encounters`). |
| 7 | RODO i lokalizacja | **Pozycje z `game_attack` kasowane po 30 dniach** (komenda zarządzania uruchamiana z crona). Usunięcie konta = anonimizacja (nazwa "Usunięty użytkownik", e-mail `NULL`), historia i pokemony zostają. Zgoda na lokalizację przy pierwszym użyciu. | Zgodne z kluczami `RESTRICT` na autorach. Na hackathon wystarczy komenda, nie harmonogram. |
| 8 | Moderacja treści | **Agent AI przy tworzeniu zgłoszeń mieszkańców** (tytuł, opis, pola tekstowe). Zgłoszenia zweryfikowanych organizacji agenta nie przechodzą. Komentarze: administrator może je ukryć, brak automatu. **Zdjęcia: tylko limity techniczne** (typ, 5 MB), bez analizy treści. | `opis.md`: agent moderuje zgłoszenia od użytkowników. Organizacje są weryfikowane przez administratora, więc im ufamy. Brak analizy zdjęć to świadomie zaakceptowane ryzyko na demo, do dodania przed produkcją. |
| 9 | Log agenta AI i awaria agenta | **Log: tak** (`pokestops_moderation_log`: treść, werdykt tak/nie/błąd, model, czas). **Awaria lub timeout 5 s: zgłoszenie nie powstaje** (`503`, ponowienie przez użytkownika), a nie przechodzi bez oceny. | Agent zwraca tylko tak/nie, więc bez logu nie da się ocenić ani poprawić promptu. Wcześniejszy pomysł "przepuść przy awarii" odrzucony: treść bez oceny nie powinna trafić na publiczną mapę, a wymuszone ponowienie kosztuje użytkownika kilka sekund. |
| 10 | Aktualizacje na żywo | **Odpytywanie:** pinezki co 30 s i po przesunięciu mapy, przeciwnicy co 20 s. **Bez WebSocketów.** | Prostsze i wystarczające dla demo. |
| 11 | Słownik postaci i typów | **Tak:** `GET /catalog`. | Frontend potrzebuje nazw i typów pokemonów, a trzymanie ich w dwóch miejscach się rozjeżdża. |
| 12 | Podział na aplikacje Django | **Bez cykli.** `collection` nie zna już `game`: nagrodą za walkę jest pokemon wskazany z `game_attack.reward_pokemon_id`, a nie z dziennika po stronie `collection`. | Dwustronny związek `collection` ↔ `game` łamał SRP i wymuszał cykliczne FK. Po zmianie zależności idą w jedną stronę (`db/README.md`). |

Decyzje dodatkowe, wynikające z przeglądu:

| # | Kwestia | Decyzja |
|---|---|---|
| 13 | Zastaw na odrzuconym lub martwym zgłoszeniu | Zwrot przy progu głosów i przy `resolved` (z +50 exp) oraz przy `rejected` i wycofaniu (bez premii). Nowy endpoint `POST /pokestops/{id}/withdraw`. |
| 14 | Głos na własną pinezkę | **Zabroniony** (`403`, `own_pokestop`). Inaczej autor sam odblokowywałby swojego pokemona. |
| 15 | Konta gościa a oszustwa | **Ryzyko zaakceptowane.** Gość głosuje i liczy się do progu, bo wymuszona rejestracja zabija wejście. Ograniczenie: limit zakładania kont gościa na adres IP (5/h). Pełna ochrona przed wieloma kontami wykracza poza MVP. |
| 16 | Wzór poziomu pokemona | **100 exp na poziom** (jak u gracza), moc `base_power + power_growth × (poziom − 1)`, przeliczana przez serwer. Placeholdery mocy w `backend/config/seed/reference.yaml` do strojenia po pierwszych testach. |

Decyzje wynikające z `opis.md` (funkcja 5, ankiety, głosowanie z bliska):

| # | Kwestia | Decyzja |
|---|---|---|
| 17 | Walka i generowanie wrogów | **Backend.** `opis.md` zostawiał to otwarte, tu jest rozstrzygnięte: serwer generuje przeciwników i rozstrzyga walkę, żeby klient nie mógł oszukiwać. |
| 18 | Zasięg głosowania | **50 m, ten sam co zasięg ataku** (jedna stała `INTERACTION_RANGE_M`). Dotyczy głosu, ankiety i zameldowania na wydarzeniu. Pozycja i odległość zapisywane przy każdym z nich (audyt). Komentarze bez ograniczeń. |
| 19 | Nagroda za głos w pomysłach NGO i konsultacjach | **Exp dla wybranego pokemona**, jak przy każdym głosie. `opis.md` w punktach 2 i 3 mówi "pokemona lub coś", ale sekcja funkcji precyzuje, że głos daje exp. Nowego pokemona dają ankiety, walki, wydarzenia i start. |
| 20 | Ankiety | **Jeden nowy pokemon (gatunku pinezki) za jedną wypełnioną ankietę**, jedna ankieta na użytkownika. Pytania typowane (7 rodzajów), odpowiedzi znormalizowane (`pokestops_survey_answer`), żeby organizacja dostała zbiorcze wyniki bez przetwarzania tekstu. Odpowiedzi tylko w zasięgu punktu. |
| 21 | Wydarzenia | **Zameldowanie na miejscu w czasie trwania** = udział = jeden unikalny pokemon. Gatunek wyłączny dla wydarzeń (`is_event_exclusive`). Opcjonalny limit miejsc i przedział wieku. Tworzy zweryfikowana organizacja lub samorząd. W bazie osobna aplikacja `events`. |
| 22 | Dyskusja | **Jeden poziom odpowiedzi**, stronicowanie po komentarzach nadrzędnych (zgodnie z uwagą w `opis.md` o paginacji). |
| 23 | Rejestracja organizacji | **Konto `org` powstaje od razu, ale ma status `pending`** do weryfikacji przez administratora. Może oglądać panel, nie może publikować. |

Decyzje wdrożeniowe backendu (Django):

| # | Kwestia | Decyzja |
|---|---|---|
| 24 | Konfiguracja i sekrety | **Wartości zmienne w YAML** (`backend/config/`, frontend: `public/config/app-config.yaml`), **sekrety wyłącznie w zmiennych środowiskowych** (`DJANGO_SECRET_KEY`, `DB_PASSWORD`, `AI_API_KEY`). Konfiguracja jest walidowana przy starcie, a testy pilnują, że w YAML-ach nie ma kluczy wyglądających na sekrety i że `.env.example` zgadza się z kodem. Ścieżki względne liczone od katalogu aplikacji, brak ścieżek na stałe. |
| 25 | Współrzędne | **Bez GeoDjango:** `lat`/`lng`, odległość liczona w Pythonie (haversine), widok mapy jako prostokąt. Bez GDAL w obrazie. `schema.sql` zachowuje `geography` na przyszłość, a różnica jest jawna i pilnowana testem. |
| 26 | Źródło prawdy dla bazy | **Migracje Django wykonują schemat, `docs/db/schema.sql` jest wzorcem**, a test porównuje tabele i kolumny (dozwolone tylko trzy opisane rodzaje różnic). Rozjazd oblewa testy. |
| 27 | Wdrażanie kontraktu | **Kontrakt najpierw:** każda operacja z `openapi.yaml` ma trasę, a niezaimplementowane odpowiadają `501 not_implemented` w kształcie błędu z kontraktu (nigdy 404). `manage.py contract_status` pokazuje postęp. |
| 28 | Przejście frontendu z atrap na dane | **Przełącznik `api.mode` per obszar** w konfiguracji (mock \| http), bez zmian w komponentach. Szczegóły: [`frontend-adaptation.md`](frontend-adaptation.md). |
| 29 | Losy inicjatywy | **Oś czasu = wpisy organizatora + automatyczny ślad zmian statusu.** Wpis (`pokestops_update`: tytuł do 120 znaków, treść do 1000) dodaje, edytuje i usuwa organizator (zweryfikowana organizacja, która opublikowała inicjatywę) lub administrator. Zmiany statusu (`pokestops_status_change`, już w bazie) wchodzą na oś czasu z notatką. Mieszkaniec widzi jedną listę (`GET /pokestops/{id}/timeline`). `Załatwione` (`resolved`) znaczy: sprawę zamknięto (organizator lub administrator), a opis tego, co się stało, jest we wpisie. Nie dodajemy własnych statusów: "statusami" w rozumieniu organizatora ("Dziś rada miasta spotkała się w sprawie ...") są wpisy osi czasu, a cztery statusy formalne zostają dla filtrów i moderacji. |
| 30 | Pola własne inicjatywy | **`customFields`: lista par etykieta-wartość** (do 10, etykieta do 40 znaków, wartość do 300, etykiety unikalne), zastępowana w całości przez `PATCH /pokestops/{id}`. Tylko dla inicjatyw organizacji; edytuje je wyłącznie organizacja-autor (administrator nie zmienia cudzej treści). Limity w YAML (`pokestops.timeline`). |
| 31 | Kto odrzuca | **Odrzucić inicjatywę może tylko administrator**, organizacja ustawia `open`/`in_progress`/`resolved`. Administrator nie edytuje treści zgłoszeń mieszkańców i organizacji (może dopisać wpis na osi czasu, podpisany "Administrator"). |
| 32 | Ankieta: kształt i zamknięcie | **Ciało `{position, answers}`** (pozycja jako obiekt, jak przy głosie i nowej pinezce). Ankietę wypełniają wyłącznie mieszkańcy (także goście). **Zamyka się ją statusem `resolved`** (`409 survey_closed`); zwykłe `open`/`in_progress` przyjmują odpowiedzi. Wyniki (`survey-results`) widzi organizator-autor i administrator. |
| 33 | Ukryty gatunek zaufanych podmiotów | **Gatunek nagrody za ankietę jest znany dopiero po jej wypełnieniu**: aplikacja pokazuje inicjatywy `ngo`/`consultation` jako wykrzyknik (generyczny model 3D), a gatunek odsłania ekran nagrody. Pole `character` zostaje w odpowiedzi API (dane są nieutajnione; to wyłącznie decyzja prezentacyjna, bez znaczenia dla bezpieczeństwa). |
| 34 | Odrzucenia AI widoczne dla administratora | **`GET /admin/moderation-log`** (odrzucone i awarie domyślnie, filtr `verdict`, `since` do odznaki). Tylko informacja, **bez przywracania** odrzuconych zgłoszeń (przywrócenie wymagałoby pinezki i ponownego zastawu pokemona autora). Autor widoczny jako nazwa wyświetlana. **Retencja:** `moderation.log_retention_days` (YAML, 90), czyszczenie przy starcie i `manage.py moderation_prune_log`. Wpis można dopisać do zestawu regresyjnego agenta: `manage.py moderation_log_to_cases <id> --expect approve\|reject`. |
| 35 | Wydarzenie "cool thing" i jego nagroda | **Zaufany podmiot wybiera nagrodę z katalogu rzadkich gatunków** wyłącznych dla wydarzeń (`isEventExclusive`, w YAML-u `reference.yaml`; dziś 6, po jednym na typ). Nie tworzy własnego gatunku (wymagałoby modelu 3D i kontroli nazw). Za udział: **jeden nowy pokemon na uczestnika na wydarzenie**, także wielodniowe. |
| 36 | Okres wydarzenia | **Okno ciągłe `startsAt`-`endsAt`** (do `events.max_duration_days` dni) i opcjonalnie **godziny dzienne** `dailyFrom`-`dailyTo` w strefie `app.timezone` (bez przechodzenia przez północ). Odbiór tylko, gdy `activeNow` (okres i godziny) **oraz** gracz stoi w kółku 50 m; opis można obejrzeć zawsze. `phase`: `upcoming`/`ongoing`/`ended`/`cancelled`, `nextWindowStart` mówi, od kiedy można odebrać. Wydarzenie jest `ongoing` także poza godzinami dziennymi, ale wtedy `activeNow` = false. |
| 37 | Zameldowanie: kształt i kolejność kontroli | **Ciało `{position}`** (jak głos i ankieta). Kolejność: rola (tylko mieszkańcy) → odwołane (`event_cancelled`) → już odebrane (`already_checked_in`) → czas (`outside_time_window`) → odległość (`too_far`) → dokładność GPS (`gps_inaccurate`, ten sam próg co w walce) → limit miejsc (`capacity_reached`). Wiek (`ageMin`/`ageMax`) jest tylko informacją: serwer nie zna wieku graczy. Odwołane wydarzenia widzi tylko organizator i administrator. |
| 38 | Weryfikacja pozycji gracza | **Jeden mechanizm (`apps/game/location.py`) dla każdej akcji związanej z miejscem** (głos, nowa pinezka, ankieta, odbiór nagrody z wydarzenia, walka, `GET /encounters`). Sprawdza kolejno: źródło (`simulated` tylko przy `location.allow_simulated`), dokładność (`accuracyM` wymagana i ≤ 50 m), aktualność odczytu (`takenAt` wymagany, nie starszy niż 30 s i nie z przyszłości) oraz tempo ruchu względem ostatniej zweryfikowanej pozycji gracza (> 40 m/s = teleportacja; szum GPS tolerowany). Osobne kody błędów (`422`): `accuracy_required`, `gps_inaccurate`, `timestamp_required`, `stale_position`, `implausible_movement`, `simulated_location_not_allowed`. Odrzucona pozycja nie jest zapamiętywana. Progi w YAML (`location`). Nadal nie da się wykryć sztucznej lokalizacji z poziomu PWA: serwer wierzy temu, co klient deklaruje, ale nie przyjmie odczytu niedokładnego, starego ani niemożliwego fizycznie. |
| 39 | Przeciwnicy indywidualni | **Każdy gracz ma własne kwadraty i własnych przeciwników** (`game_encounter_cell.user_id`, `game_encounter.user_id`). Ten sam punkt daje różnym graczom różne wyniki, typy kolejnych przeciwników się nie powtarzają (także względem ostatniego tego gracza), cudzego przeciwnika nie widać ani nie da się zaatakować (`404`). API bez zmian (kontrakt `Encounter` ten sam). Stare wiersze ze wspólnych kwadratów (`user_id` NULL) wygasają i są czyszczone. |
| 40 | Mockowanie lokalizacji | **Tylko jawnie i tylko tam, gdzie wolno:** klient oznacza pozycję `source: simulated` (parametr `?gps=lat,lng` w narzędziach deweloperskich; przycisk 📍 prosi o prawdziwą pozycję), a serwer przyjmuje ją wyłącznie przy `location.allow_simulated: true` (lokalnie, `demo.example.yaml`, testy). Pozycje symulowane nie podlegają kontroli tempa ruchu (w trybie deweloperskim można się "teleportować") i nie wymagają dokładności ani czasu odczytu. W produkcji `allow_simulated: false`, więc narzędzia deweloperskie nie służą do oszukiwania. W testach backendu domyślnie włączone jest łagodne sprawdzanie (autouse w `conftest.py`), a `tests/test_location.py` sprawdza pełną weryfikację. |

## Co zostaje otwarte

1. **Co dzieje się ze zgłoszeniem, które nie zbiera głosów?** `opis.md` mówi tylko, co po spełnieniu warunku (pokemon wraca z exp, propozycja zostaje na mapie). Przyjąłem, że do tego czasu pokemon jest zastawiony, a wyjściem są wycofanie, odrzucenie lub rozwiązanie. Automatyczne wygasanie po N dniach wymagałoby zadania w tle, więc na razie go nie ma.
2. **Jaki dokładnie zasięg "dopuszczonej odległości"?** `opis.md` go nie podaje. Przyjęte 50 m jest do sprawdzenia w terenie (dokładność GPS w mieście bywa gorsza).
3. **Nagroda za ankietę:** `opis.md` mówi "pokemony" w liczbie mnogiej. Przyjęty jeden nowy pokemon na ankietę. Jeśli ma być więcej lub losowy, zmienia się tylko logika aplikacji.
4. **Strojenie liczb gry** (moc postaci i przeciwników, exp, próg głosów): wymaga kilku prób na działającym demo.
5. **Kreator ankiet i wydarzeń po stronie frontendu** to osobna, spora funkcja (patrz punkty 15 i 16 powyżej).
