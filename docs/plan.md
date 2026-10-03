# Plan spinania całości

Żywy dokument: po każdym kroku odhaczamy `[x]` i dopisujemy, co faktycznie sprawdzono (a czego nie).
Zasady: wartości zmienne w YAML, sekrety w env, kontrakt = `docs/openapi.yaml`, `docs/opis.md` ma pierwszeństwo przy rozbieżnościach.

## Etap 0: porządek i pierwszy prawdziwy test

- [x] 0.1 Usunięty zdublowany `opis.md` z roota. README i dokumentacja wskazują na `docs/opis.md`
- [x] 0.2 `schema.sql` na prawdziwym Postgresie 18: 26 tabel, 1 widok, bez błędów. **Z zastrzeżeniem:** PostGIS nie ma na tej maszynie, więc sprawdzono kopię z `geography(Point, 4326)` zamienionym na `point` (reszta DDL bez zmian). Samo rozszerzenie PostGIS i indeksy `gist` na `geography` nie były testowane
- [x] 0.3 Seedy na tej bazie: 6 postaci, 20 scenariuszy, 163 pola, bez błędów
- [x] 0.4 Backend (Django, migracje zamiast `schema.sql`) na Postgresie: `bootstrap`, `seed_demo`, `contract_status` (25/36), 79 testów ✔, `api_walkthrough.py` 24 ✔. Dodatkowo start jak w kontenerze (gunicorn, `debug: false`): gość dostaje token, lista bez tokenu daje 401
- [x] 0.5 `Dockerfile`, `entrypoint.sh`, `gunicorn.py`, `docker-compose.yml` przejrzane statycznie, spójne ze sobą. **Docker nie był uruchamiany** (brak na maszynie), więc `docker compose up --build` nadal czeka na pierwszy prawdziwy test

**Uwagi z Etapu 0**
- `schema.sql` wymaga PostGIS, a `docker-compose.yml` używa `postgres:16` bez PostGIS. Nie jest to błąd działania, bo Django tworzy tabele migracjami i nie używa PostGIS. `schema.sql` jest dokumentacją. Do rozstrzygnięcia: albo dopisać to w `docs/db/README.md`, albo zmienić obraz na `postgis/postgis`
- Moderacja AI działa dziś w trybie `stub` (reguła ze znacznikiem w tekście), nie z prawdziwym agentem (Etap 2)
- Do uruchamiania na Postgresie lokalnie potrzebny jest sterownik `psycopg` (`requirements/prod.txt`). Brakował w `.venv`, doinstalowany

## Etap 1: główna pętla gry na `http`

- [x] 1.1 Rola i profil z `GET /me` (`api.mode.account: http`); przełącznik ról ukryty, gdy rola pochodzi z serwera. Sprawdzone na żywo: gość = mieszkaniec, token administratora = widok administratora
- [x] 1.2 Głosowanie: wybór pokemona (`/me/pokemons`), pozycja użytkownika, komunikat serwera przy `too_far`. Sprawdzone na żywo (głos przyjęty, exp 10, licznik +1)
- [x] 1.3 Zgłoszenie: wybór zastawianego pokemona, wynik moderacji. Sprawdzone na żywo: odrzucenie (422, formularz zostaje) i przyjęcie (201, karta otwarta, pokemon zastawiony)
- [x] 1.4 Komentarze: lista stronicowana (najnowsze pierwsze), odpowiedzi w wątku, „Pokaż starsze”. Na żywo sprawdzone: odczyt wątku z odpowiedzią z backendu. Wysyłanie komentarza i odpowiedzi sprawdzone tylko na atrapie i testami jednostkowymi
- [x] 1.5 Pinezki wg `?bbox=` (debounce z konfiguracji), plus `/me/interactions`, `GET /pokestops/{id}` dla linku `?stop=`, `loadAll` dla moderacji
- [x] 1.6 Testy: 70 ✔ (było 47). Próbki odpowiedzi w `backend-sample.json` odświeżone z prawdziwego backendu
- [x] 1.7 Przejście w przeglądarce na `pokestops: http` + `account: http` z żywym backendem (PostgreSQL), bez nowych błędów w konsoli
- [x] 1.8 Zaktualizowane: `docs/frontend-adaptation.md`, README (krok 5, 6, tabela stanu)

**Uwagi z Etapu 1**
- **Zmiana zachowania atrap:** `MockPokestopApi` egzekwuje zasady serwera (zasięg 50 m, jeden głos, brak głosu na własną pinezkę, exp dla pokemona zamiast „zdobycia postaci”). W demo na atrapach trzeba włączyć 📍 GPS; dodałem pinezkę „Zniszczona ławka przy Rynku” w zasięgu
- **Kolekcja nie rośnie od głosów**, bo w kontrakcie głos daje exp wybranemu pokemonowi, nie nowego pokemona (wcześniejsza atrapa to zmyślała). Karta inicjatywy nie pokazuje już „zdobytej postaci”
- **Zdjęcia:** `upload.enabled: false` ukrywa pola zdjęć w trybie `http` (backend: 501). W domyślnej konfiguracji zostało `true`, bo domyślnie są atrapy
- **Domyślna konfiguracja zostaje na atrapach** (`mock`): przełączenie na `http` wymaga działającego backendu, a bez niego aplikacja startuje pustą stroną. Przełączasz to sam w `app-config.yaml`
- **Poprawione po drodze:** błąd `NG0203` przy starcie (opisany wcześniej), brak trybu `account` w `AuthService.needsSession` (wykryty testem)
- **Niesprawdzone:** wysłanie komentarza/odpowiedzi na żywym backendzie z przeglądarki, „Pokaż starsze komentarze” na żywo (tylko testy), Spryciaki w trybie `http` po zmianach, układ na telefonie (nie robiłem zrzutów mobilnych)
- **Postać `festival`** z backendu nie jest znana frontendowi (Etap 4.4)

## Etap 2: moderacja AI
- [ ] agent z prawdziwym `AI_API_KEY`, zachowanie przy niedostępności agenta, ekran odrzucenia

## Etap 3: konta, organizacje, administrator
- [ ] rejestracja/logowanie/awans gościa w UI, rejestracja i akceptacja organizacji, panele, katalog scenariuszy z `/scenarios`

## Etap 4: brakujące operacje backendu (`501`) i ich ekrany
- [ ] `POST /photos`
- [ ] walka: `GET /encounters`, `POST /encounters/{id}/attack`
- [ ] ankiety: `survey-responses`, `survey-results`
- [ ] wydarzenia + `check-in` + postać `festival`

## Etap 5: wdrożenie i jakość
- [ ] weryfikacja PWA, `dev.tools: false` w produkcji, HTTPS, CI, jedno uruchomienie przez Docker, `docs/ASSETS.md`

## Otwarte decyzje
- Nagrody za wygraną walkę
- ~~Zachowanie moderacji, gdy agent AI jest niedostępny~~ rozstrzygnięte już w kontrakcie: `503 moderation_unavailable`, zgłoszenie nie powstaje, można ponowić (treść niezweryfikowana nie trafia na mapę)
