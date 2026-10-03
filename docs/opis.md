# Aplikacja Pokemon Smart City Go!

> Treść przepisana z dokumentu Word (źródło wymagań). W razie rozbieżności z resztą dokumentacji ten plik ma pierwszeństwo.

## 5 głównych funkcji

1. Użytkownik zgłasza problem miejski (np. dziura w chodniku) lub pomysł (np. tutaj potrzeba kosz na śmieci) i inni ludzie widzą to jako pokestop. Inni podchodzą i potwierdzają/zaprzeczają. Jeśli dużo osób potwierdzi to autor dostaje pokemona.
2. Pomysły od NGO. Ludzie widzą to jako pokestop. Ludzie głosują za/przeciw i dostają za to pokemona lub coś.
3. Konsultacje społeczne od miasta. Ludzie widzą to jako pokestop. Ludzie głosują za/przeciw i dostają za to pokemona lub coś.
4. Walka z problemami miejskim: pokemon Rower Rower pokonuje miejski problem Korek Komunikacyjny. Problemy są losowe i użytkownik może walczyć pokemonami, które wcześniej zdobył, więc zależy mu na zdobywaniu ich. Za wygrane walki... trzeba wymyśleć co wygrywa.
5. NGO i samorząd mogą zgłaszać wydarzenia dla gen alpha, za uczestnictwo można dostać unikalnego pokemona.

Celujemy w gen alpha i młodych dorosłych - mają ciekawą rozrywkę i spędzają fajnie czas offline, a miasto i NGO mają narzędzie do partycypacji społecznej.

## Kwestie techniczne

- Backend: python django
- Front: Angular (tylko w tej nowej wersji!)
- Tworzymy PWA. Skorzystamy z możliwości zdefiniowania prostego manifestu i service workera, aby działało na wszystkich urządzeniach by default
- Front i back w tym samym repozytorium. Odrębne foldery
- Backend konteneryzowany

## [FEATURES]

- Użytkownicy rozwiązują ankiety, pytania zadane przez miasta i organizacje. Mają one odpowiadać temu co miasto/organizacja musiałaby zbierać podczas konsultacji społecznych. W zamian za to użytkownik dostaje pokemony.
- Użytkownicy zgłaszają problemy, propozycje. Podczas zgłaszania wybiera jakiego pokemona chce zostawić na problemie. Jeśli zostanie spełniony warunek wystarczających lików, propozycja zostaje na mapie ale użytkownik odzyskuje pokemona, a ten pokemon dostaje +exp.
- Za potwierdzanie / dislikowanie propozycji użytkowników wybierasz pokemona któremu zostanie przyznany Exp.
- Głosowanie może odbywać się tylko kiedy użytkownik jest w dopuszczonej odległości geograficznej od punktu.
- W obszarze danego użytkownika generują się wrogowie. Po kliknięciu na wroga rozpoczyna się walka. Wróg ma dany poziom mocy. Użytkownik może użyć trzech pokemonów żeby pokonać wroga. Wróg zostaje pokonany jeśli moc pokemonów przewyższa moc przeciwnika.
- Pokemony i przeciwnicy mają przypisane typy. Podczas walki jeśli wróg ma ten sam typ co dany pokemon, aplikowany jest mnożnik (np. 1.2) do mocy tego pokemona.
- Pod propozycjami mieszkańców i organizacji jest sekcja dyskusji. Użytkownicy mają możliwość zostawiania komentarzy i odpowiadania innym użytkownikom.
- Do moderacji zgłoszeń od użytkowników będzie używany agent AI ze zahardkodowanym promptem i doczepionym zgłoszeniem. Agent podejmie decyzję tak/nie czy dopuścić dane zgłoszenie do ukazania się publicznie. Agent zwraca tylko tak/nie lub 1/0 i na tej podstawie zgłoszenie jest akceptowane lub nie.
- Panel organizacji pozwala zobaczyć dane o organizacji.
- Panel użytkownika pozwala zobaczyć dane użytkownika.
- Użytkownik ma możliwość zobaczenia wszystkich swoich pokemonów i ich poziomów w zakładce pokemony.

## Endpointy

- tworzenie konta użytkownika
- tworzenie konta organizacji
- logowanie
- zwracanie wszystkich pokemonów użytkownika
- tworzenie zgłoszenia użytkownika (w tym cały prompt potem do agenta moderatora od razu na backendzie wysłany) -> odpowiedź z backendu czy akceptacja czy nie, potrzebna na front
- tworzenie zgłoszenia organizacja
- fetchowanie zgłoszeń w obszarze użytkownika
- wysyłanie odpowiedzi udzielonych na zgłoszenie organizacji
- likowanie/dislikowanie pomysłów ludzi
- zostawianie komentarzy
- fetchowanie komentarzy (przydałaby się paginacja przy tym fetchowaniu)
- co do decyzji czy front czy back generuje wrogów i obsługuje walkę to nie ma decyzji
- po zakończeniu walki updatowanie expa pokemonów
- fetchowanie info o użytkowniku
- fetchowanie info o organizacji

## Baza danych

- Konta
- Wydarzenia
- Pokemony
- Zgłoszenia
- Komentarze
- Walki
