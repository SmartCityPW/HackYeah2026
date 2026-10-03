# Plan spinania całości

**Kolejność wykonania:** Etap 0 ✔, Etap 1 ✔, Etap 6 ✔ (paleta; poza 6.6 i 6.7), Etap 2, 3, 4, 5. Numery zostały bez zmian, żeby odwołania w README i dokumentacji się zgadzały. Paleta idzie przed Etapami 2 i 3, żeby nowe ekrany (odrzucenie zgłoszenia, logowanie, rejestracja) powstawały od razu w palecie.

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

## Etap 6: paleta graficzna projektu (dopisane 2026-10-03, wykonany przed Etapami 2 i 3)

Źródło: [`docs/paleta-hackyeah.pdf`](paleta-hackyeah.pdf) (5 kolorów). Docelowo cały interfejs ma się jej trzymać.

| Rola (propozycja) | Kolor | Uwagi |
|---|---|---|
| tekst, ciemne powierzchnie | `#4F345A` śliwka | na `#F5EFFF` kontrast 9,5:1 ✔ |
| tło aplikacji, karty | `#F5EFFF` mgła | |
| obramowania, chipy, tła drugoplanowe | `#CDC1FF` lawenda | tekst `#4F345A` na niej 6,4:1 ✔ |
| akcent, główne wezwanie do działania | `#EA638C` róż | biały tekst 3,15:1 ✘ (AA dla zwykłego tekstu to 4,5) |
| marka, aktywne elementy, linki | `#7371FC` fiolet | biały tekst 3,82:1 ✘ |

- [x] 6.1 Tokeny w `styles.css`: 5 kolorów palety (`@theme static`) i role (`--text`, `--bg`, `--surface`, `--border`, `--tint`, `--brand`, `--brand-strong`, `--accent`, `--accent-strong`, `--accent-ink`, `--accent-tint`, cienie). Odcienie „-strong” i „-ink” to mieszanki palety z śliwką, nie nowe kolory
- [x] 6.2 Zaszyte kolory zamienione na tokeny we wszystkich CSS, szablonach i modelu. Zostały tylko w `styles.css` (rejestr), `index.html` (`theme-color`) i modelach 3D
- [x] 6.3 Kontrast: białego tekstu nie ma na `#EA638C` ani `#7371FC`. Przyciski używają ciemniejszych mieszanek (`--brand-strong` 6:1, `--accent-strong` 5,3:1). Audyt w przeglądarce (każdy element z tekstem, 6 widoków + karta pinezki + panel i formularz zgłoszenia z błędami): 0 naruszeń poza emoji w znacznikach (mają własne kolory)
- [x] 6.4 Typy pinezek i statusy: wyłącznie kolory palety + ikona. Statusy: 🗳️ głosowanie (fiolet), 🔧 w realizacji (lawenda), ✔ załatwione (śliwka), ✕ odrzucone (róż). Przyciski głosu 👍/👎, błędy ⚠. Konsultacje mają podwójne obramowanie pinezki
- [x] 6.5 Mapa: styl OpenFreeMap `liberty` zostaje bez zmian (zielony). Decyzja 2026-10-03
- [ ] 6.6 Postacie 3D (`features/map/three`): bez zmian. Rowerzysta i Stworek Kosz budowane w kodzie mają własne kolory, a modele Kenneya własne tekstury. Do decyzji, czy dwie postacie z kodu przemalować na paletę
- [ ] 6.7 Manifest PWA (`theme_color`, `background_color`, ikony z palety): po Etapie 5. `<meta name="theme-color">` w `index.html` już jest
- [x] 6.8 Przegląd w przeglądarce (tryb atrap): mapa, karta pinezki, Inicjatywy, Moderacja, formularz z błędem. Test `palette.spec.ts` pilnuje (a) że poza `styles.css` nie ma zaszytych kolorów, (b) że pary tekst/tło z tokenów mają ≥ 4,5:1

**Uwagi z Etapu 6**
- **Regresja z Etapu 1, naprawiona:** moja zmiana „zmniejszająca CSS mapy” usunęła style przeciwników (znacznik z pulsowaniem, `.fight`, `.enemy-action`) i trafiła do commita `414bf46`. Przywrócone w palecie. Style znaczników (pinezki, przeciwnicy, pozycja użytkownika) przeniesione do globalnego `map-markers.css`, bo tworzy je `MapController`, nie szablon Angulara
- Przeciwnik to śliwkowe koło z różową obwódką i pulsem, żeby nie mylił się z różową pinezką problemu
- Biała powierzchnia kart (`--surface: #fff`) to jedyny kolor poza paletą: neutralne tło pod tekstem. Jeśli ma być ściśle z palety, można zamienić na mgłę (karty zlałyby się wtedy z tłem)
- **Niesprawdzone:** układ na telefonie, stany hover i disabled poza tym, co widać na zrzutach, tryb `http` po zmianach stylów, ciemny motyw (nie istnieje)

**Decyzje (2026-10-03):** zostajemy przy **5 kolorach z palety**, bez dodatkowych zieleni, czerwieni i bursztynu. Różnice między typami i statusami niesie ikona, nie sam kolor. Styl mapy `liberty` zostaje.

**Propozycja przypisania** (do zatwierdzenia przy 6.4). Do wypełnień są 4 kolory (mgła to tło), a typów pinezek jest 5, więc dwa typy dzielą kolor i różnią się ikoną i kształtem znacznika:

| Status | Kolor | Ikona |
|---|---|---|
| Głosowanie trwa | fiolet `#7371FC` | 🗳️ |
| W realizacji | lawenda `#CDC1FF` (tekst śliwka) | 🔧 |
| Załatwione | śliwka `#4F345A` | ✔ |
| Odrzucone | róż `#EA638C` | ✕ |

Typy pinezek: problem (róż), pomysł (fiolet), cool miejsce (lawenda), NGO (śliwka), konsultacje (fiolet z obwódką). Błąd i ostrzeżenie w formularzach to róż z ikoną ⚠, a sukces to fiolet z ✔.

**Konsekwencja:** róż oznacza i „problem”, i „odrzucone”/„błąd”. To spójne (coś wymaga uwagi), ale trzeba pilnować, żeby nigdy nie był jedynym nośnikiem znaczenia.


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
- [ ] **PWA nie jest skonfigurowane:** w `frontend/public/` nie ma manifestu, a w `angular.json`, `index.html` i `app.config.ts` nie ma service workera (`ng add @angular/pwa` nie było wykonane). Specyfikacja wymaga PWA. Do zrobienia razem z paletą (`theme_color`, ikony)
- [ ] weryfikacja PWA, `dev.tools: false` w produkcji, HTTPS, CI, jedno uruchomienie przez Docker, `docs/ASSETS.md`

## Otwarte decyzje

- Nagrody za wygraną walkę
- ~~Zachowanie moderacji, gdy agent AI jest niedostępny~~ rozstrzygnięte już w kontrakcie: `503 moderation_unavailable`, zgłoszenie nie powstaje, można ponowić (treść niezweryfikowana nie trafia na mapę)
