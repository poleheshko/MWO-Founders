# Zmiany przygotowujące do wdrożenia na Replit

## Utworzone pliki

1. **`replit-setup.sh`** - Skrypt automatycznej konfiguracji dla Replit
   - Konfiguruje git (pull.rebase false)
   - Instaluje zależności
   - Buduje projekt

2. **`REPLIT_SETUP.md`** - Szczegółowy przewodnik wdrożenia na Replit
   - Instrukcje konfiguracji git
   - Rozwiązywanie problemów
   - Konfiguracja zmiennych środowiskowych

3. **`REPLIT_COMMANDS.txt`** - Szybka lista komend do skopiowania
   - Gotowe komendy do wykonania na Replit

4. **`.gitconfig.example`** - Przykładowa konfiguracja git
   - Można skopiować do ~/.gitconfig na Replit

## Zaktualizowane pliki

1. **`.replit`** - Zaktualizowana konfiguracja Replit
   - Uproszczony run command
   - Dodane komentarze o konfiguracji git

2. **`README.md`** - Dodana sekcja o wdrożeniu na Replit
   - Link do szczegółowego przewodnika

## Rozwiązany problem

**Problem:** Błąd "divergent branches" przy `git pull origin main` na Replit

**Rozwiązanie:** 
```bash
git config pull.rebase false
```

To ustawienie mówi git, aby używał strategii merge zamiast rebase przy pull, co rozwiązuje problem z divergent branches.

## Co dalej?

1. **Commit i push zmian:**
   ```bash
   git add .
   git commit -m "Add Replit deployment configuration"
   git push origin main
   ```

2. **Na Replit:**
   - Sklonuj repozytorium
   - Wykonaj: `git config pull.rebase false`
   - Ustaw zmienne środowiskowe w Secrets
   - Uruchom bota (Replit zrobi to automatycznie dzięki `.replit`)

## Uwagi

- **NIE używaj** `npm audit fix --force` - może zepsuć zależności (jak pokazano w logach)
- Większość podatności z `npm audit` pochodzi z dev dependencies i nie wpływa na działanie bota
- Wszystkie zmienne środowiskowe muszą być w Replit Secrets (nie w `.env`)
