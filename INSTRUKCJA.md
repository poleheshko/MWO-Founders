# Instrukcja użytkowania bota Discord - Tester Army

## Czym jest ten bot?

Bot Discord dla programu Tester Army w grze Monopoly World. Umożliwia:
- Zgłaszanie wkładu testerów (screenshoty, bugi, analizy)
- System punktów TC (Test Credits)
- Rankingi i profile testerów
- Zarządzanie tygodniowymi cyklami testowania
- Automatyczne przypisanie rang na podstawie osiągnięć

## Jak działa bot?

### System punktów TC (Test Credits)

Bot przyznaje punkty TC za różne rodzaje wkładu:
- **Quick Test**: 10 TC
- **Survey**: 3 TC
- **Screenshot**: 5 TC
- **Bug Report**: 25 TC
- **Bug Video**: 40 TC
- **Balance Analysis**: 30 TC
- **Retest**: 15 TC
- **Shipped Bonus**: 100 TC

Punkty mogą być w stanie:
- **Pending** (oczekujące) - czekają na zatwierdzenie przez admina
- **Confirmed** (potwierdzone) - zatwierdzone i dodane do konta

### System rang

Bot automatycznie przypisuje rangi na podstawie osiągnięć:

1. **Tester Recruit** - domyślna ranga dla nowych członków
2. **Explorer** - wymaga 60 TC potwierdzonych
3. **Test Pilot** - wymaga 250 TC potwierdzonych + 2 strukturalne raporty
4. **Founders Circle** - wymaga 900 TC potwierdzonych + miejsce w top 15

### Tygodniowe cykle

Bot działa w systemie tygodniowych cykli testowania:
- Admin tworzy cykl z wersją builda i linkiem
- Cykl jest publikowany i staje się aktywny
- Testerzy mogą zgłaszać wkład w ramach aktywnego cyklu
- Na końcu tygodnia generowany jest raport

## Komendy dla testerów

### `/profile`
Wyświetla Twój profil Tester Army:
- Potwierdzone TC
- Oczekujące TC
- Aktualna ranga
- Ostatnie zgłoszenia

**Przykład użycia:**
```
/profile
```

### `/leaderboard [scope]`
Wyświetla ranking testerów.

**Opcje:**
- `week` - ranking za bieżący tydzień
- `all` - ranking całkowity (domyślnie)

**Przykład użycia:**
```
/leaderboard
/leaderboard scope:week
```

### `/submit screenshot <text>`
Zgłasza screenshot z opisem/insightem.

**Parametry:**
- `text` (wymagane) - Twój opis lub insight dotyczący screenshotu

**Przykład użycia:**
```
/submit screenshot text:"Znalazłem ciekawy bug w interfejsie menu"
```

**Wartość TC:** 5 TC (po zatwierdzeniu)

### `/submit bug <title> <repro_steps> [video_or_link]`
Zgłasza raport błędu.

**Parametry:**
- `title` (wymagane) - Tytuł błędu
- `repro_steps` (wymagane) - Kroki reprodukcji błędu
- `video_or_link` (opcjonalne) - Link do wideo lub dowodu

**Przykład użycia:**
```
/submit bug title:"Gra crashuje przy otwieraniu sklepu" repro_steps:"1. Otwórz menu główne\n2. Kliknij ikonę sklepu\n3. Gra się zawiesza"
```

**Wartość TC:** 
- 25 TC za raport z opisem
- 40 TC za raport z wideo

### `/submit balance <text>`
Zgłasza analizę balansu gry.

**Parametry:**
- `text` (wymagane) - Twoja analiza balansu

**Przykład użycia:**
```
/submit balance text:"Uważam, że koszt ulepszeń jest zbyt wysoki w porównaniu do zysków"
```

**Wartość TC:** 30 TC (po zatwierdzeniu)

### `/submit retest <issue_id> <result>`
Potwierdza ponowne przetestowanie zgłoszonego błędu.

**Parametry:**
- `issue_id` (wymagane) - ID zgłoszonego błędu
- `result` (wymagane) - Wynik ponownego testu

**Przykład użycia:**
```
/submit retest issue_id:"BUG-123" result:"Błąd nadal występuje w wersji 1.2.3"
```

**Wartość TC:** 15 TC (po zatwierdzeniu)

## Komendy dla administratorów

Wszystkie komendy administracyjne wymagają uprawnień administratora serwera Discord.

### `/cycle create <build_version> <build_link> <week_start>`
Tworzy nowy tygodniowy cykl testowania.

**Parametry:**
- `build_version` (wymagane) - Wersja builda (np. "1.2.3")
- `build_link` (wymagane) - Link do builda
- `week_start` (wymagane) - Data rozpoczęcia tygodnia (format: YYYY-MM-DD)

**Przykład użycia:**
```
/cycle create build_version:"1.2.3" build_link:"https://example.com/build" week_start:"2026-02-17"
```

### `/cycle publish <cycle_id>`
Publikuje cykl, czyniąc go aktywnym. Bot automatycznie wyśle ogłoszenie na kanał ogłoszeń.

**Parametry:**
- `cycle_id` (wymagane) - ID cyklu do opublikowania

**Przykład użycia:**
```
/cycle publish cycle_id:"abc123"
```

### `/submission review <submission_id> <approve> [public_comment] [private_comment]`
Przegląda i zatwierdza/odrzuca zgłoszenie testera.

**Parametry:**
- `submission_id` (wymagane) - ID zgłoszenia do przeglądu
- `approve` (wymagane) - true/false - czy zatwierdzić
- `public_comment` (opcjonalne) - Komentarz publiczny widoczny dla testera
- `private_comment` (opcjonalne) - Komentarz prywatny tylko dla adminów

**Przykład użycia:**
```
/submission review submission_id:"sub123" approve:true public_comment:"Świetna praca! Zatwierdzam."
```

**Efekt:**
- Jeśli zatwierdzone: TC są dodawane do konta testera
- Jeśli odrzucone: zgłoszenie pozostaje bez punktów

### `/shipped <user> <public_message>`
Przyznaje bonus "Shipped" (+100 TC) testerowi za funkcję, która została wydana.

**Parametry:**
- `user` (wymagane) - Użytkownik Discord do nagrodzenia
- `public_message` (wymagane) - Wiadomość publiczna o nagrodzie

**Przykład użycia:**
```
/shipped user:@TesterName public_message:"Funkcja szybkiego testu została wydana!"
```

**Efekt:**
- +100 TC dodawane automatycznie
- Wiadomość wysyłana na kanał highlights

### `/tc adjust <user> <delta> <reason>`
Ręcznie koryguje TC użytkownika (może być dodatnie lub ujemne).

**Parametry:**
- `user` (wymagane) - Użytkownik Discord
- `delta` (wymagane) - Zmiana TC (może być ujemna, np. -10)
- `reason` (wymagane) - Powód korekty

**Przykład użycia:**
```
/tc adjust user:@TesterName delta:50 reason:"Bonus za szczególnie pomocny feedback"
/tc adjust user:@TesterName delta:-10 reason:"Korekta za błędnie przyznane punkty"
```

### `/report weekly <cycle_id>`
Generuje tygodniowy raport z rankingiem dla danego cyklu.

**Parametry:**
- `cycle_id` (wymagane) - ID cyklu do raportowania

**Przykład użycia:**
```
/report weekly cycle_id:"abc123"
```

## Ograniczenia i limity

### Rate limiting
- Maksymalnie **10 zgłoszeń na godzinę** na użytkownika
- Jeśli przekroczysz limit, bot poinformuje Cię i będziesz musiał poczekać

### Wymagania członkostwa
- Aby używać komend, musisz mieć rolę **Tester Recruit** lub wyższą
- Bot automatycznie synchronizuje członkostwo na podstawie ról Discord

## Automatyczne funkcje

### Synchronizacja członkostwa
- Bot automatycznie dodaje użytkowników do programu, gdy otrzymają rolę "Tester Recruit"
- Synchronizacja odbywa się codziennie w nocy

### Aktualizacja rang
- Rangi są automatycznie aktualizowane po zatwierdzeniu zgłoszeń
- Bot automatycznie przypisuje odpowiednie role Discord

### Integracja z Google Sheets
- Bot automatycznie pobiera dane z ankiet z Google Sheets (co 5 minut)
- Wymaga skonfigurowania Google Service Account

### Automatyczne przypomnienia
- **Środa** - przypomnienie o środku tygodnia
- **Piątek** - przypomnienie o zbliżającym się terminie

## Rozwiązywanie problemów

### Bot nie odpowiada na komendy
1. Sprawdź, czy bot jest online (zielona kropka obok nazwy)
2. Upewnij się, że masz odpowiednią rolę (Tester Recruit lub wyższą)
3. Sprawdź, czy używasz poprawnych nazw komend (wszystkie zaczynają się od `/`)

### Komendy nie pojawiają się w Discordzie
- Poczekaj do 1 godziny (dla globalnych komend)
- Lub użyj komend specyficznych dla serwera (wymaga ustawienia `DISCORD_GUILD_ID`)

### Zgłoszenie nie zostało zatwierdzone
- Zgłoszenia wymagają ręcznego przeglądu przez administratora
- Sprawdź status w `/profile` - zobaczysz "pending" dla oczekujących

### Nie widzę moich punktów TC
- Upewnij się, że zgłoszenia zostały zatwierdzone przez admina
- Sprawdź `/profile` - zobaczysz zarówno "Confirmed TC" jak i "Pending TC"

## Najlepsze praktyki

### Przy zgłaszaniu bugów:
- Opisz dokładnie kroki reprodukcji
- Dodaj screenshoty lub wideo, jeśli możesz
- Podaj informacje o środowisku (wersja gry, system operacyjny)

### Przy zgłaszaniu screenshotów:
- Dodaj wartościowy opis lub insight
- Nie zgłaszaj oczywistych rzeczy
- Skup się na znaleziskach, które mogą pomóc w rozwoju gry

### Przy analizie balansu:
- Podaj konkretne przykłady i liczby
- Wyjaśnij, dlaczego uważasz, że coś jest niezbalansowane
- Zaproponuj rozwiązania, jeśli możesz

## Kontakt i wsparcie

Jeśli masz pytania lub problemy:
1. Sprawdź tę instrukcję
2. Skontaktuj się z administratorem serwera Discord
3. Sprawdź kanał pomocy na serwerze (jeśli istnieje)

---

**Wersja:** 1.0  
**Ostatnia aktualizacja:** Luty 2026
