# Parallel Sessions Plan — Obsidian Depths

Cel: równolegle odpalić 5 sesji Claude Code, każda robi NIEZALEŻNE zadanie. Brak race condition (różne pliki / branche). Każda sesja ma briefing self-contained — wklej w nową sesję i lecisz.

## Zasady izolacji

| Sesja | Edytuje | Czyta | NIE rusza |
|-------|---------|-------|-----------|
| **1 — User playtest** | `production/qa/bugs/*.md` (ręcznie) | `index.html` w przeglądarce | nic w kodzie |
| **2 — Code: nowy feature** | `index.html` (single-file owner) | wszystkie plany | `parallel-tasks/`, `production/qa/` |
| **3 — Balance audit** | `production/qa/balance-report.md` | `index.html` (read-only) | sam `index.html` |
| **4 — Content: nowe potwory + itemy** | `parallel-tasks/04-content-pack.md` | `index.html` (read-only), CCGS templates | `index.html` |
| **5 — Design: nowy system (biomes/crafting/hub)** | `design/systems/*.md` | wszystkie GDD | `index.html` |

**Single-file rule:** TYLKO sesja 2 edytuje `index.html`. Reszta zwraca specyfikacje / dane / raporty w osobnych plikach. Po skończeniu wszystkich → ja (sesja-koordynator) integruję content z sesji 4 i system z sesji 5 do `index.html` w jednym commit.

---

## SESJA 1 — User Manualny Playtest

**Ty grasz w grę, raportujesz bugi.**

```
Otwórz `index.html` lokalnie:
  cd /home/krzysztof/Projects/Personal/Roguelike/obsidian-depths
  python3 -m http.server 8000
  → http://localhost:8000

Graj 30-60 minut, próbując dotrzeć do floor 10. Notuj:
- Bugi (co, jak odtworzyć, oczekiwane vs aktualne)
- Frustracje (co irytuje, co jest niejasne)
- Win moments (co działa świetnie)
- Balance feels (co za łatwe/trudne, czego brakuje, co przesadzone)

Format raportu: `production/qa/bugs/playtest-YYYY-MM-DD.md`
Sekcje: Bugs, Frustrations, Wins, Balance Notes, Suggestions
```

**Definition of done:** plik `playtest-YYYY-MM-DD.md` z min 5 obserwacjami.

---

## SESJA 2 — KOD: Implementacja jednego z 4 features

**WYBIERZ JEDEN i wklej tylko ten brief w nową sesję:**

### 2A — Sound System (Web Audio API)

```
Zaimplementuj sound system w `index.html`:
- AudioContext + sample bank (proceduralne tony, bez external assets)
- Dźwięki: walk, attack hit, attack miss, enemy death, item pickup, level up,
  card draft open, door open, trap trigger, low HP warning, victory
- Volume slider w stats panel (0/50/100%)
- Mute toggle (M key)
- localStorage save volume preference

Plik do edycji: ONLY `index.html`
Branch: `feature/sound-system`
Commit: `Add Web Audio sound system + volume control`

Test: graj, słuchaj czy dźwięki nie trzeszczą. Mobile: tap unlocks audio context.
```

### 2B — Save / Continue System

```
Zaimplementuj save/load w `index.html`:
- Auto-save do localStorage co każde piętro (po `enterFloor`)
- "Continue" button na title screen (jeśli save istnieje)
- Save zawiera: floor, player stats/cards/equipment, dungeon seed (musi być
  deterministic — patrz `state.seed` already exists)
- Restart przy game over → kasuje save
- "Abandon run" przycisk (manual delete save)

Plik do edycji: ONLY `index.html`
Branch: `feature/save-continue`
Commit: `Add save/continue system with localStorage`
```

### 2C — Daily Seed Challenge

```
Zaimplementuj daily seed challenge:
- Title screen: button "Daily Challenge" — generuje seed z aktualnej daty
  (YYYY-MM-DD → hash → seed)
- Wszyscy gracze mają identyczny dungeon w danym dniu
- Po zwycięstwie: zapisz wynik (floor reached, kills, time) do localStorage
- Leaderboard lokalny: top 10 daily runs
- Share button: generuje text "I reached floor X in Y turns on daily 2026-04-30 — try it!"

Plik do edycji: ONLY `index.html`
Branch: `feature/daily-seed`
Commit: `Add daily seed challenge + local leaderboard`
```

### 2D — Crafting System

```
Zaimplementuj crafting:
- Nowy item type "Material" (🔩 scrap metal, 🪵 wood, 🪶 feather, 💀 bone, 💎 gem)
- Materiały dropują z odpowiednich wrogów (skeleton→bone, slime→gem, bat→feather)
- Crafting station tile 🛠️ (spawns 30% from floor 4)
- Stojąc na nim → ekran craftingu z 6-8 recipes:
  * 2x scrap → Iron Knife 🔪
  * 1x scrap + 1x wood → Wooden Shield 🛡️
  * 3x bone → Bone Armor 🦴 (def+3)
  * 1x feather + 1x scrap → Short Bow 🏹
  * 2x gem → Health Potion 🧪
  * 1x gem + 1x bone → Magic Wand 🪄
- UI: lista recipes z highlight gdy masz materiały
- Klawisz C otwiera modal craftingu (gdy obok stacji)

Plik do edycji: ONLY `index.html`
Branch: `feature/crafting-system`
Commit: `Add crafting station + 6 recipes + 5 materials`
```

---

## SESJA 3 — Balance Audit (CCGS skill)

**Wykorzystuje skill `/balance-check` z CCGS.**

```
Uruchom `/balance-check` na obecnej grze. Cel: znaleźć degenerate strategies,
broken combos, dominant builds, zbyt łatwe/trudne piętra.

Analizuj w szczególności:
1. Czy 6-tile torch radius nie jest za duży (tracimy "torchowy klimat")?
2. Czy starting Rusty Dagger (atk+1) wystarczy na floor 1-3?
3. Czy 40 kart z drafta nie ma dominant strategy (np. samo Brawn 5x)?
4. Czy Dragon (BLINK speed) na floor 10 jest fair?
5. Czy ekonomia itemów: 2-3/room + ensureMin (1 weapon, 1 armor, 2 potion) wystarczy?
6. Czy combo Fire Aura + Ice Aura + Hellfire jest broken?
7. Czy Mythril Body (armor nie traci durability) trywializuje grę?
8. Czy Necromancer (30% spawn ally) snowballuje?
9. Spawn rate 5 typów pułapek per floor — fair czy frustrujące?

Output: `production/qa/balance-report.md`
Sekcje:
- Outliers (10+ punkty na 1-10 skali)
- Dominant strategies (jeśli istnieją)
- Underused content (karty/itemy/wrogi które nigdy nie chcesz)
- Floor-by-floor difficulty curve assessment
- Specific tuning recommendations (z liczbami: "zmień X z 10 na 7 bo Y")
- Risk: high/medium/low per znalezisko

Branch: `audit/balance-2026-04-30`
Commit: `Add balance audit report`
NIE EDYTUJ index.html — tylko raport.
```

**Definition of done:** plik raportu z min 8 znaleziskami i 5 konkretnymi recommendations.

---

## SESJA 4 — Content Pack: 10 nowych potworów + 10 itemów

**Tworzy specyfikację, NIE edytuje kodu. Ja zintegruję później.**

```
Zaprojektuj content pack: 10 nowych potworów (każdy z unikatowym AI) + 10 nowych itemów.

Wykorzystaj skill `/asset-spec` z CCGS.

Output: `parallel-tasks/04-content-pack.md`
Format dla każdego potwora:
- emoji, nazwa, klucz id
- HP, ATK, DEF, speed, XP, floor range, weight
- movementPattern (z istniejących: ORTHO/DIAG/OMNI/KNIGHT/LEAP/ZIGZAG)
- aiType (z istniejących + ewentualnie nowy)
- specjalne abilities (1-3)
- spawn-conditions (specific floor / room type / odsetek)

Format dla każdego itemu:
- emoji, nazwa, slot (weapon/armor/offhand/accessory/consumable)
- atk/def/effect, maxDur, minFloor, weight
- description (1 zdanie)
- (jeśli weapon) damage type / range / two-handed

Pomysły do rozwinięcia (wybierz 10+10 najciekawszych):
Potwory: 🦀 Cave Crab (heavy armor frontal), 🐺 Dire Wolf (pack hunter),
🪲 Beetle Swarm (5 small bugs spawn together), 🐛 Worm (burrows underground),
🦂 Scorpion (poison sting), 🦑 Tentacle (grabs from walls), 🐉 Wyrm Hatchling,
🧟 Zombie (slow, infectious), 🦊 Trickster Fox (illusion clones), 👻 Banshee
(scream stuns), 🦌 Stag Spirit, 🐍 Two-Headed Snake (2 attacks/turn),
🕷️ Giant Spider (web shot ranged), 🦅 Harpy (dive attack), 🌳 Treant (regen).

Itemy: 🪦 Cursed Sword (huge atk, drains HP), 🌿 Herbal Tea (cure all status),
🦴 Bone Armor (immunity to poison), 🪨 Throwing Stones (ranged consumable),
🌟 Star Charm (+lucky %), 🧪 Polymorph Potion (turn enemy into rat),
🪞 Mirror Shield (reflect 1 attack), 🕯️ Eternal Candle (+2 torch radius),
🥖 Hardtack (+5 max HP per use, max 3), 🪙 Gold Coins (currency for shop),
📿 Prayer Beads (+regen), 🎺 War Horn (panic enemies r3), 🎲 Dice of Fate
(random buff or debuff), 🪶 Quill of Wisdom (re-roll 1 levelup card).

Branch: `content/pack-1`
Commit: `Add content pack 1 spec: 10 mobs + 10 items`
NIE EDYTUJ index.html — ja zintegruję.
```

**Definition of done:** plik z 10 potworami + 10 itemami, każdy z pełną specyfikacją.

---

## SESJA 5 — Design: Nowy System (Biomes / Hub / Permanent Progression)

**Tworzy GDD przez `/design-system` z CCGS. NIE edytuje kodu.**

**WYBIERZ JEDEN i wklej tylko ten brief:**

### 5A — Biomy / piętra tematyczne

```
Wykorzystaj skill `/design-system` z CCGS żeby napisać GDD dla:

System "Biomes" — zamiast 10 generycznych pięter, gra ma 5 biomów po 2 piętra:
- Floor 1-2: Crypt 🪦 (zombie/skeleton/wraith heavy, dim lighting)
- Floor 3-4: Cave 🪨 (bat/spider/cave crab, lots of corridors)
- Floor 5-6: Lava 🔥 (demon/lava elemental, fire damage tiles)
- Floor 7-8: Forest 🌲 (wolf/treant/harpy, lit lots of trees)
- Floor 9-10: Lair 🐉 (dragon kin, boss-like every floor)

Każdy biom ma:
- Unikatową kolorystykę kafelek (FLOOR/WALL kolor variant)
- Tematyczne mob spawn pool (override standard ENEMY_DEFS distribution)
- Tematyczne traps / pułapki
- Boss room na 2-gim piętrze biomu
- Theme music cue (dla future sound system)
- Visual ambience (particle effects: dust/embers/leaves/smoke)

Output: `design/systems/biomes-system.md`
Sekcje: Overview, Player Goals, Mechanics, Data Schema, Visual Design,
Audio Direction, Difficulty Curve, Acceptance Criteria

Branch: `design/biomes-system`
Commit: `Add Biomes System GDD`
```

### 5B — Hub miasta + permanent progression

```
GDD dla "Town Hub":
- Po śmierci gracz wraca do miasta zamiast title screen
- W mieście NPCs: blacksmith (przesyła starting equipment level up za gold),
  alchemist (przepisy potionów), trainer (perma-perki za XP)
- Permanent meta-progression: % gold zachowuje się między runami
- 5-10 perma upgrade'ów za gold:
  * +5 starting HP
  * Start with extra potion
  * +1 starting card from previous run
  * Identify all items
  * Anvil starts repaired
- Title screen → "Enter Town" zamiast "New Run"

Output: `design/systems/town-hub-system.md`
Branch: `design/town-hub`
Commit: `Add Town Hub System GDD`
```

### 5C — Hunger / Food / Survival

```
GDD dla survival mechanics:
- Hunger meter (0-100), spada o 1 co 20 worldTick
- Food items: 🍞 Bread (+30 hunger), 🍖 Meat (+50), 🍎 Apple (+20)
- Hunger 0 → start losing 1 HP per 5 turns
- Hunger 80+ → +5% regen per turn
- Mobs drop food (rat→meat, goblin→bread)
- Cooking station: raw food → cooked (more hunger value)

Output: `design/systems/hunger-system.md`
Branch: `design/hunger`
Commit: `Add Hunger System GDD`
```

**Definition of done:** GDD ma minimum 800 słów + sekcje Mechanics, Data Schema, Acceptance Criteria.

---

## Koordynacja po skończeniu

Gdy 2-5 sesji skończą:

1. **Ja (koordynator)** zbieram:
   - Sesja 1: bugi → osobny issue w GitHub / lub od razu fix
   - Sesja 2: ten branch jest już zmergowalny (pojedynczy feature)
   - Sesja 3: balance recommendations → tuning patches w `index.html`
   - Sesja 4: content spec → integracja do `ENEMY_DEFS` + `ITEM_DEFS`
   - Sesja 5: GDD → kolejny implementation cycle

2. Mergujemy branche w kolejności: 2 (feature) → 4 (content) → 3 (tuning) → 5 (system).

3. `/smoke-check` (CCGS) potwierdza że wszystko działa razem.

## Quick start dla każdej sesji

```bash
cd /home/krzysztof/Projects/Personal/Roguelike/obsidian-depths
git pull
git checkout -b <branch-name>  # widoczne w briefingu sesji
# wklej briefing sesji do Claude Code
# po skończeniu: git push origin <branch-name>
```

## Rekomendacja kolejności odpalania

Najlepiej:
- **Teraz:** sesja 1 (Ty grasz) + sesja 3 (audit, leci samodzielnie) + sesja 4 (content spec) + sesja 5 (GDD)
- **Po Twoim feedbacku:** sesja 2 (decydujesz który feature 2A/2B/2C/2D na podstawie balance audit)

Dzięki temu 4 sesje pracują, jedna decyzja czeka na Twoje wyniki testów.
