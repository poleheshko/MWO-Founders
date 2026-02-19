# Wdrożenie na Replit - Instrukcja

Ten przewodnik pomoże Ci wdrożyć projekt Discord bota na Replit.

## Krok 1: Przygotowanie projektu na Replit

1. **Utwórz nowy Repl na Replit:**
   - Zaloguj się na [Replit](https://replit.com)
   - Kliknij "Create Repl"
   - Wybierz "Import from GitHub" lub "Upload files"
   - Jeśli używasz GitHub, podaj URL repozytorium
   - Wybierz język: **Node.js**

2. **Replit automatycznie wykryje projekt:**
   - Plik `.replit` jest już skonfigurowany
   - Projekt użyje Node.js 18

## Krok 2: Konfiguracja zmiennych środowiskowych

W Replit, zmienne środowiskowe są przechowywane jako **Secrets**. Aby je skonfigurować:

1. W Replit, kliknij ikonę **🔒 Secrets** (lub Tools → Secrets)
2. Dodaj wszystkie zmienne z pliku `.env` jako Secrets:

### Wymagane zmienne:

```
DISCORD_BOT_TOKEN=twoj_discord_bot_token
DISCORD_GUILD_ID=twoj_guild_id
DATABASE_URL=postgresql://user:password@host:port/database
CHANNEL_ANNOUNCEMENTS=channel_id
CHANNEL_HIGHLIGHTS=channel_id
CHANNEL_ADMIN_LOGS=channel_id
GOOGLE_SHEETS_SPREADSHEET_ID=spreadsheet_id
GOOGLE_SHEETS_RANGE=Sheet1!A:Z
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_SHEETS_STRUCTURED_REPORT_BUILDS=2.10:id,2.11:id,...
GOOGLE_SHEETS_RECORD_SESSION_SPREADSHEET_ID=spreadsheet_id
PROGRAM_ROLES=MWO Founder
FORM_SCREENSHOT=https://forms.gle/...
FORM_BUG_REPRO=https://forms.gle/...
FORM_BUG_VIDEO=https://forms.gle/...
FORM_BALANCE_ANALYSIS=https://forms.gle/...
FORM_RETEST=https://forms.gle/...
FORM_RECORD_SESSION=https://forms.gle/...
FORM_STRUCTURED_REPORT=https://forms.gle/...
FORM_STRUCTURED_REPORT_LINKS=https://forms.gle/...
FORM_STRUCTURED_REPORT_BUILDS=2.10:https://forms.gle/...,2.11:https://forms.gle/...
RATE_LIMIT_SUBMIT_PER_HOUR=10
BUILD_MAX_TC_PER_USER=200
TC_QUICK_TEST=10
TC_SURVEY=3
TC_SCREENSHOT=5
TC_BUG_REPRO=25
TC_BUG_VIDEO=40
TC_BALANCE_ANALYSIS=30
TC_RETEST=15
TC_SHIPPED_BONUS=100
RANK_EXPLORER_TC=60
RANK_TEST_PILOT_TC=250
RANK_TEST_PILOT_STRUCTURED=2
RANK_FOUNDERS_CIRCLE_TC=900
RANK_FOUNDERS_CIRCLE_TOP_N=15
```

### ⚠️ Ważne: Google Service Account Key

Dla `GOOGLE_SERVICE_ACCOUNT_KEY` musisz przekonwertować plik JSON na string:

1. Otwórz plik `credentials/mwo-founders-02a1503a4bee.json`
2. Skopiuj całą zawartość JSON (jako jeden ciąg, bez przełamań linii)
3. W Replit Secrets, wklej cały JSON jako wartość dla `GOOGLE_SERVICE_ACCOUNT_KEY`

**Przykład:**
```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"mwo-founders",...}
```

Lub możesz użyć narzędzia online do konwersji JSON na string (escape quotes).

## Krok 3: Konfiguracja bazy danych

Replit oferuje kilka opcji dla PostgreSQL:

### Opcja A: Użyj istniejącej bazy danych (Neon, Supabase, itp.)
- Jeśli już masz bazę danych (np. Neon), użyj jej URL w `DATABASE_URL`
- To jest najprostsze rozwiązanie

### Opcja B: Utwórz bazę danych w Replit
1. W Replit, kliknij "Tools" → "Database"
2. Utwórz nową bazę PostgreSQL
3. Skopiuj connection string i użyj go w `DATABASE_URL`

### Opcja C: Użyj zewnętrznej usługi
- [Neon](https://neon.tech) - Darmowa baza PostgreSQL
- [Supabase](https://supabase.com) - Darmowa baza PostgreSQL
- [Railway](https://railway.app) - Darmowa baza PostgreSQL

## Krok 4: Uruchomienie projektu

1. **Zainstaluj zależności:**
   - Replit automatycznie uruchomi `npm install` przy pierwszym uruchomieniu
   - Możesz też uruchomić ręcznie w konsoli: `npm install`

2. **Zbuduj projekt:**
   ```bash
   npm run build
   ```

3. **Uruchom projekt:**
   - Kliknij przycisk **"Run"** w Replit
   - Lub uruchom w konsoli: `npm run start:prod`

4. **Sprawdź logi:**
   - W konsoli powinieneś zobaczyć: `✅ NestJS application is running on port 3000`
   - Bot powinien połączyć się z Discord

## Krok 5: Uruchamianie migracji bazy danych

Po pierwszym uruchomieniu, uruchom migracje:

```bash
npm run migration:run
```

## Krok 6: Utrzymanie projektu działającego

### Always-On (dla płatnych planów)
- Replit automatycznie utrzyma projekt działający
- Projekt będzie działał nawet gdy zamkniesz przeglądarkę

### Keep-Alive (dla darmowych planów)
- Replit może zatrzymać projekt po okresie nieaktywności
- Możesz użyć serwisu typu [UptimeRobot](https://uptimerobot.com) do pingowania projektu co 5 minut
- Dodaj endpoint health check w aplikacji (opcjonalnie)

## Rozwiązywanie problemów

### Bot nie odpowiada
- Sprawdź czy `DISCORD_BOT_TOKEN` jest poprawny
- Sprawdź czy bot ma uprawnienia "Message Content Intent" w Discord Developer Portal
- Sprawdź logi w konsoli Replit

### Błędy bazy danych
- Sprawdź czy `DATABASE_URL` jest poprawny
- Sprawdź czy baza danych jest dostępna z internetu
- Uruchom migracje: `npm run migration:run`

### Błędy Google Sheets
- Sprawdź czy `GOOGLE_SERVICE_ACCOUNT_KEY` jest poprawnym JSON stringiem
- Sprawdź czy service account ma dostęp do spreadsheetów
- Sprawdź czy `GOOGLE_SHEETS_SPREADSHEET_ID` jest poprawny

### Port już zajęty
- Replit automatycznie przypisze port
- Jeśli aplikacja próbuje użyć portu 3000, możesz zmienić to w `src/main.ts`

## Dodatkowe wskazówki

1. **Backup:** Regularnie rób backup bazy danych
2. **Logi:** Monitoruj logi w konsoli Replit
3. **Aktualizacje:** Aktualizuj zależności regularnie: `npm update`
4. **Bezpieczeństwo:** Nigdy nie commituj pliku `.env` do repozytorium
5. **Performance:** Monitoruj użycie zasobów w Replit dashboard

## Struktura plików dla Replit

```
.
├── .replit              # Konfiguracja Replit
├── replit.nix           # Konfiguracja środowiska Nix
├── package.json         # Zależności Node.js
├── tsconfig.json        # Konfiguracja TypeScript
├── src/                 # Kod źródłowy
├── dist/                # Skompilowany kod (generowany)
└── REPLIT_DEPLOYMENT.md # Ten plik
```

## Wsparcie

Jeśli napotkasz problemy:
1. Sprawdź logi w konsoli Replit
2. Sprawdź dokumentację NestJS: https://docs.nestjs.com
3. Sprawdź dokumentację Discord.js: https://discord.js.org

Powodzenia! 🚀
