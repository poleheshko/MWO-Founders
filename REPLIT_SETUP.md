# Replit Setup Guide

## Quick Setup

Po sklonowaniu repozytorium na Replit, wykonaj następujące kroki:

### 1. Konfiguracja Git (rozwiązuje problem z divergent branches)

```bash
# Ustaw strategię pull na merge (zapobiega błędowi divergent branches)
git config pull.rebase false

# LUB użyj fast-forward only (bezpieczniejsze dla Replit)
git config pull.ff only
```

### 2. Alternatywnie: użyj skryptu setup

```bash
chmod +x replit-setup.sh
./replit-setup.sh
```

### 3. Pull z repozytorium

```bash
# Jeśli masz divergent branches, użyj:
git fetch origin
git reset --hard origin/main

# Normalnie wystarczy:
git pull origin main
```

### 4. Instalacja zależności

```bash
npm install
```

### 5. Build projektu

```bash
npm run build
```

### 6. Uruchomienie bota

```bash
npm run start:prod
```

## Konfiguracja zmiennych środowiskowych

W Replit przejdź do **Tools → Secrets** i dodaj wszystkie zmienne z `.env.example`:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DATABASE_URL`
- itd.

## Automatyczne uruchamianie

Plik `.replit` jest już skonfigurowany i automatycznie:
- Instaluje zależności (`npm install`)
- Buduje projekt (`npm run build`)
- Uruchamia bota (`npm run start:prod`)

## Rozwiązywanie problemów

### Problem: "divergent branches"

**Rozwiązanie:**
```bash
git config pull.rebase false
git fetch origin
git reset --hard origin/main
```

### Problem: npm audit vulnerabilities

Większość podatności pochodzi z dev dependencies (jest, eslint, etc.) i nie wpływa na działanie bota w produkcji. Możesz je zignorować lub użyć:

```bash
npm audit fix
```

**UWAGA:** Nie używaj `npm audit fix --force` - może to zepsuć zależności (jak pokazano w logach).

### Problem: Bot nie startuje

1. Sprawdź czy wszystkie zmienne środowiskowe są ustawione w Secrets
2. Sprawdź logi w konsoli Replit
3. Upewnij się, że baza danych jest dostępna

## Aktualizacja kodu z Git

```bash
# Pobierz najnowsze zmiany
git fetch origin

# Zresetuj lokalne zmiany do stanu zdalnego (UWAGA: usuwa lokalne zmiany!)
git reset --hard origin/main

# LUB użyj merge (zachowuje lokalne zmiany)
git pull origin main
```

## Uwagi

- Replit automatycznie uruchomi bota po skonfigurowaniu `.replit`
- Zmiany w kodzie wymagają rebuild: `npm run build`
- Wszystkie zmienne środowiskowe muszą być w Secrets (nie w `.env`)
