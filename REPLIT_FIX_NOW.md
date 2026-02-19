# Szybka naprawa problemu z git pull na Replit

## Wykonaj te komendy na Replit (w terminalu):

```bash
# 1. Skonfiguruj git, aby używał merge zamiast rebase
git config pull.rebase false

# 2. Teraz możesz bezpiecznie wykonać pull
git pull origin main
```

## Alternatywnie, jeśli nadal masz problemy:

```bash
# Opcja A: Zresetuj lokalne zmiany do stanu zdalnego (UWAGA: usuwa lokalne zmiany!)
git fetch origin
git reset --hard origin/main

# Opcja B: Użyj merge explicite
git fetch origin
git merge origin/main
```

## Po naprawie:

```bash
# Zainstaluj zależności (jeśli jeszcze nie)
npm install

# Zbuduj projekt
npm run build

# Uruchom bota
npm run start:prod
```

## Ustawienie globalne (opcjonalnie, dla wszystkich repozytoriów):

```bash
git config --global pull.rebase false
```
