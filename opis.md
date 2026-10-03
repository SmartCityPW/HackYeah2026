# Aplikacja Pokemon Smart City Go! 

## 5 główne funkcje: 

- Użytkownik zgłasza problem miejski (np. dziura w chodniku) lub pomysł (np. tutaj potrzeba kosz na śmieci) i inni ludzie widzą to jako pokestop. Inni podchodzą i potwierdzają/zaprzeczają.  Jeśli dużo osób potwierdzi to autor dostaje pokemona. 

- Pomysły od NGO. Ludzie widzą to jako pokestop. Ludzie głosują za/przeciw i dostają za to pokemona lub coś 

- Konsultacje społeczne od miasta. Ludzie widzą to jako pokestop. Ludzie głosują za/przeciw i dostają za to pokemona lub coś 

- Walka z problemami miejskim: pokemon Rower Rower pokonuje miejski problem Korek Komunikacyjny. Problemy są losowe i użytkownik może walczyć pokemonami, które wcześniej zdobył, więc zależy mu na zdobywaniu ich. Za wygrane walki... trzeba wymyśleć co wygrywa 

- NGO i samorząd mogą zgłaszać wydarzenia dla gen alpha, za uczestnictwo można dostać unikalnego pokemona  

Celujemy w gen alpha i młodych dorosłych - mają ciekawą rozrywkę i spędzają fajnie czas offline, a miasto i NGO mają narzędzie do partycypacji społecznej. 

 
## FEATURES 

 - Użytkownicy rozwiązyją ankiety, pytania zadane przez miasta i organizacje. Mają one odpowiadać temu co miasto/organizacja musiałaby zbierać podczas konsulacji społecznych. W zamian za to użytkownik dostają pokemony. 

Użytkownicy zgłaszają problemy, propozycje. Podczas zgłaszania wybiera jakiego pokemona chce zostawić na problemie. Jeśli zostanie spelnionyarunek wystarczających lików, propozycja zostaje na mapie ale użytkownik odzyskuje pokemona, a ten pokemon dostaje z expa.  

Za potwierdzanie / dislikowanie propozycji użytkowników wybierasz pokemona któremu zostanie przyznany Exp. 

Głosowanie może odbywać się tylko kiedy użytkownik jest w dopuszczonej odległości geograficznej od punktu. 

- w obszarze danego użytkownika generują się wrogowie . Po kliknięciu na wroga rozpoczyna się walka. Wróg ma dany poziom mocy. Użytkownik może użyc trzech pokemonów żeby pokonać wroga. Wróg zostaje pokonany jeśli moc pokemonów przewyższa moc przeciwnika 

- pokemony i przeciwnicy mają przypisane typy. Podczas walki jeśli wróg ma ten sam typ co dany pokemon, aplikowany jest mnożnik (np. 1.2) do mocy tego pokemona 

- pod propozycjqami mieszkancow i organizacji jest sekcja dyskusji. Użytkownicy maja możliwość zostawiania komentarzy i odpowiadania innym użytkownikom. 

- do moderacji zgloszen od uzytkownikow będzie używany agent ai ze schardkodowanym promptem i doczepionym zgłoszeniem. Agent podejmie decyzje tak nie czy dopuscic dane zgłoszenie do ukazania się publicznie. Agent zwraca tylko tak/nie lub 1 0 i na tej podstawie zgłoszenie jest akceptowane lub nie 

- panel organizacji pozwala zobaczyć dane o organizacji 

- panel użytkownika pozwala zobaczyć dane użytkownika 

- użytkownik ma możliwość zobaczenia wszystkich swoich pokemonów i ich poziomow w zakładce pokemony 


Endpointy: 

- tworzenie konta użytkownika 

- tworzenie konta organizacji 

- logowanie 

- zwracanie wszystkich pokemonów użytkownika 

- tworzenie zgłoszenia użytkownik 

- tworzenie zgłoszenia organizacja 

- fetchowanie zglozen w obszarze użytkownika 

- wysylanie odpowiedzi udzielonych na zgłoszenie organizacji 

- likowanie/dislikowanie pomyslow ludzi 

- zostawianie komentarzy 

- fetchowanie komentarzy (przydalaby się paginacja przy tym fetchowaniu) 