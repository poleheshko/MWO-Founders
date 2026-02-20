# Rozwiązanie problemu "npm: command not found" w trybie recovery Replit

## Problem
Replit jest w trybie recovery i nie może znaleźć komendy `npm`. To oznacza, że środowisko Nix nie zostało zbudowane poprawnie.

## Przyczyna
Najczęściej jest to spowodowane błędem w pliku `.replit` (np. markery konfliktu merge), który uniemożliwia zbudowanie środowiska.

## Rozwiązanie krok po kroku

### Krok 1: Napraw plik `.replit`

Upewnij się, że plik `.replit` nie ma markerów konfliktu merge (`<<<<<<<`, `=======`, `>>>>>>>`).

Skopiuj poniższą zawartość do pliku `.replit`:

```toml
# Replit configuration file
# This file configures how Replit runs your project

# Language and runtime
language = "nodejs"

# Entry point
entrypoint = "dist/main.js"

# Always run commands (run before the run command)
# npm install will install dependencies, then build will compile TypeScript
alwaysRun = ["npm install", "npm run build"]

# Run command - starts the production server
run = "npm run start:prod"

# Environment variables are set in Replit Secrets (Tools → Secrets)

# Build command - this runs automatically before 'run' command
# The prestart:prod script will also ensure build runs if dist is missing
build = "npm run build"

# LSP (Language Server Protocol) configuration
[languages.nodejs]
pattern = "**/*.{js,ts,json}"

# Nix environment (optional, but recommended)
[nix]
channel = "stable-23_11"
```

### Krok 2: Upewnij się, że plik `replit.nix` istnieje

Plik `replit.nix` powinien zawierać:

```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.nodePackages.typescript
    pkgs.nodePackages.npm
    pkgs.postgresql
  ];
}
```

### Krok 3: Wyjdź z trybu recovery

1. **Kliknij przycisk "Recover original configuration files"** (jeśli jest dostępny)
   LUB
2. **Zamknij i otwórz ponownie Replit** - to powinno zbudować środowisko na nowo
   LUB
3. **Usuń i ponownie sklonuj repozytorium** na Replit

### Krok 4: Sprawdź czy środowisko się zbudowało

Po wyjściu z trybu recovery, sprawdź czy npm działa:

```bash
npm --version
node --version
```

Jeśli te komendy działają, środowisko jest gotowe.

### Krok 5: Zainstaluj zależności

```bash
npm install
```

### Krok 6: Zbuduj projekt

```bash
npm run build
```

### Krok 7: Uruchom bota

```bash
npm run start:prod
```

## Alternatywne rozwiązanie: Ręczne wyjście z trybu recovery

Jeśli powyższe nie działa:

1. **Zapisz wszystkie zmiany** w plikach (jeśli są)
2. **Zamknij Replit**
3. **Otwórz Replit ponownie** - powinien automatycznie wykryć poprawiony `.replit` i zbudować środowisko
4. Jeśli nadal jest problem, **usuń Repl i utwórz nowy**, sklonuj repozytorium ponownie

## Sprawdzenie konfiguracji

Po naprawie, upewnij się że:
- ✅ Plik `.replit` jest poprawny (bez markerów konfliktu)
- ✅ Plik `replit.nix` istnieje i jest poprawny
- ✅ Zmienne środowiskowe są ustawione w Secrets
- ✅ `npm --version` zwraca numer wersji
- ✅ `node --version` zwraca numer wersji

## Jeśli nadal nie działa

Spróbuj użyć prostszej konfiguracji `.replit` (bez sekcji Nix):

```toml
language = "nodejs"
entrypoint = "dist/main.js"
run = "npm run start:prod"
alwaysRun = ["npm install", "npm run build"]
```
