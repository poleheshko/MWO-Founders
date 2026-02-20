# Rozwiązanie konfliktu merge w .replit na Replit

## Problem
Błąd: `.replit: Parse error: toml: line 6: expected '.' or '=', but got '<' instead`

To oznacza, że w pliku `.replit` są markery konfliktu merge Git (`<<<<<<<`, `=======`, `>>>>>>>`).

## Rozwiązanie

### Opcja 1: Usuń markery konfliktu ręcznie

Na Replit otwórz plik `.replit` i usuń wszystkie linie zawierające:
- `<<<<<<< HEAD`
- `=======`
- `>>>>>>> origin/main` (lub podobne)

Zostaw tylko poprawną wersję pliku.

### Opcja 2: Zresetuj plik do wersji zdalnej

```bash
# Pobierz najnowszą wersję z origin
git fetch origin

# Zresetuj plik .replit do wersji zdalnej
git checkout --theirs .replit

# Dodaj plik do staging
git add .replit

# Zakończ merge
git commit -m "Resolve merge conflict in .replit"
```

### Opcja 3: Zastąp cały plik .replit

Skopiuj poniższą zawartość do pliku `.replit` na Replit:

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

# Environment variables are set in Replit Secrets (Tools -> Secrets)

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

### Opcja 4: Zresetuj całe repozytorium (UWAGA: usuwa lokalne zmiany!)

```bash
git fetch origin
git reset --hard origin/main
```

## Po naprawie

```bash
# Sprawdź status
git status

# Jeśli wszystko OK, możesz kontynuować
npm install
npm run build
npm run start:prod
```
