# Deployment & Workflow

Dwie środowiska: **production** (publiczne, stabilne) i **development** (live testy).

## Production — GitHub Pages

**Public URL:** https://travel-wire.github.io/obsidian-depths/

- Auto-deploy z `main` branch (push → ~1 min build → live)
- Jeśli build nie doszedł: sprawdź `gh run list -R Travel-Wire/obsidian-depths --limit 3`
- HTTPS wymuszony, brak setupu DNS — działa od razu

**Reguła:** na `main` lądują TYLKO sprawdzone i zmergowane zmiany.

## Development — branch `dev` + Tailscale

Workflow:

```bash
# rano: zacznij dev
git checkout dev
git pull

# kod, kod, kod...
git add -A
git commit -m "wip"

# push do dev branch (NIE main, więc nie deployuje)
git push origin dev

# lokalnie odpal serwer
cd /home/krzysztof/Projects/Personal/Roguelike/obsidian-depths
python3 -m http.server 8443
```

### Wystaw dev publicznie przez Tailscale

Dwie opcje:

**Opcja 1 — Tailscale Serve (tylko twoje urządzenia w tailnet):**
```bash
tailscale serve --bg --https=8443 http://localhost:8443
tailscale serve status   # sprawdź URL
```

Adres będzie typu `https://vmi3151069.tail0c39a9.ts.net/` — dostępny TYLKO z twoich tailscale devices (laptop, telefon, znajomi w twoim tailnet).

**Opcja 2 — Tailscale Funnel (publicznie w internecie):**

Wymaga włączenia funnel w ACL: https://login.tailscale.com/admin/acls

```bash
tailscale funnel --bg --https=8443 http://localhost:8443
tailscale funnel status
```

Adres typu `https://vmi3151069.tail0c39a9.ts.net/` — publicznie dostępny dla każdego.

**Stop serving:**
```bash
tailscale serve --https=8443 off
# albo
tailscale funnel --https=8443 off
```

## Promote dev → production

Gdy `dev` jest stabilny:

```bash
git checkout main
git pull
git merge dev
git push origin main   # auto-deploy na GitHub Pages w ~1 min
```

Lub via Pull Request na GitHub (preferowane jeśli chcesz code review):

```bash
gh pr create --base main --head dev --title "Promote dev → main"
```

## Rollback production

Jeśli main się zepsuje:

```bash
git checkout main
git revert HEAD              # cofnij ostatni commit (czysty rollback)
git push origin main         # GH Pages re-deployuje poprzedni stan
```

Lub twardy reset do konkretnego commit (destruktywne):
```bash
git reset --hard <commit-hash>
git push --force origin main
```

## Status dashboards

- **GitHub Pages build:** https://github.com/Travel-Wire/obsidian-depths/actions
- **Latest commits:** https://github.com/Travel-Wire/obsidian-depths/commits/main
- **Issues / TODO:** https://github.com/Travel-Wire/obsidian-depths/issues

## Branch strategy

```
main         ←─ production, auto-deploy GH Pages
  │
  └─ dev     ←─ development, lokalny test + tailscale dev URL
       │
       └─ feature/X  (opcjonalnie dla większych zmian)
```

Większe zmiany robimy w worktrees per feature (jak w v3 sprint), mergujemy do `dev` → testujemy → mergujemy do `main`.

## Tip: Auto-reload przy local dev

Standardowy `python3 -m http.server` wymaga manual reload w przeglądarce. Dla auto-reload:

```bash
npm i -g live-server
live-server --port=8443 --no-browser
```

Każda zmiana w pliku → przeglądarka się odświeża automatycznie.
