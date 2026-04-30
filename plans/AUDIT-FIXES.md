# AUDIT FIXES — decyzje przed implementacją

Po coherence audit (verdict: FIX-AND-GO). Te decyzje override'ują sprzeczności w planach 01-05.

## KRYTYCZNE (5)

### F1. Alarm vs Spider HIDDEN
**Decyzja:** Alarm BUDZI Spidera — wyrywa z `state='HIDDEN'` do `state='ACTIVE'`. Logika: alarm = wibracje, pajęczak je czuje.
**Implementacja:** w `triggerTrap('alarm')` (plan 01), iteruj enemies, dla każdego w radius 12: `e.awake = true; if (e.state === 'HIDDEN') e.state = 'ACTIVE';`

### F2. Dragon speed
**Decyzja:** Dragon = `SPEED.BLINK` (200), nie FAST. Final boss musi czuć się zabójczo.
**Implementacja:** w plan 03 ENEMY_DEFS Dragon.speed = SPEED.BLINK.

### F3. Stat double-count
**Decyzja:** Opcja A — `p.atk`/`p.def` to BASE + STATY z kart (recomputeStats wlicza CARD bonusy + status buffy). `getPlayerAtk()`/`getPlayerDef()` zwraca `p.atk + equippedWeapon.atk` (equipment dodawane na samej górze, nie w `recomputeStats`).
**Implementacja:** 
- `recomputeStats()` z planu 05: resetuje `p.atk = p.baseAtk; p.def = p.baseDef`, potem aplikuje karty (`brawn` → `p.atk += 2 * stacks`)
- `applyEquippedItemBonuses()` z planu 05 — USUNĄĆ. Bonusy z equipment liczy `getPlayerAtk()` z planu 04.
- `getPlayerAtk()`: `return p.atk + (equippedWeapon ? equippedWeapon.atk : 0) + accessoryAtk + statusAtk;`

### F4. torchBonus naming
**Decyzja:** jedno pole — `state.player.torchBonus`. Plan 05 używa `p.torchBonus` w karcie sharp_eyes.
**Implementacja:** plan 05 `recomputeStats` resetuje `p.torchBonus = 0`, karta `sharp_eyes` robi `p.torchBonus += 1 * stacks` (max 3 stacks → max +3).

### F5. Plan 01 auto-torch vs Plan 05 sharp_eyes
**Decyzja:** USUNĄĆ auto-torch upgrade z `gainXP` w planie 01. Sharp Eyes (karta plan 05) jest JEDYNĄ drogą do +torch radius. Konsekwencja: `recomputeStats` resetuje `p.torchBonus = 0` i odbudowuje z kart — bezpieczne.
**Implementacja:** plan 01 — pomijamy sekcję "Levelup torch upgrade", `gainXP` tylko zwiększa baseStats.

### F6. Resurrect pass przed filter
**Decyzja:** w `processWorld()` (plan 02) — resurrect pass MUSI być PRZED filtrem `e.hp > 0`.
**Implementacja:** kolejność w processWorld: `worldTick++` → energy charge → enemy actions → **resurrection pass (plan 03)** → tickStatusEffects → computeFOV → markExplored → filter dead.

## UMIARKOWANE (3)

### F7. Bat fallback w korytarzu
**Decyzja:** każdy NIE-ortogonalny pattern (DIAGONAL, OMNI, KNIGHT, LEAP, ZIGZAG) gdy wszystkie kandydaci zablokowani → fallback do ORTHOGONAL.
**Implementacja:** w `stepTowardWithPattern()` na końcu (przed `return null`): jeśli pattern !== ORTHOGONAL → recursive call z ORTHOGONAL.

### F8. maxDur naming
**Decyzja:** wszędzie `item.maxDur` (nigdy `maxArmorDur`). Karta `tough_skin` z planu 05: `equippedArmor.maxDur += 10 * stacks`.

### F9. Mimic + ensureMin kolejność
**Decyzja:** `populateFloor` order: 1) random items spawn → 2) mimic substitution (10% szansa) → 3) ensureMin (jeśli mniej niż 1 weapon/1 armor/2 potion → dodaj — i te NIE zamieniają się w mimicki).

## DROBNE

### F10. Anvil emoji
**Decyzja:** Anvil = `⚒️` (crossed hammers), War Hammer = `🔨`. Bez konfliktu wizualnego.

### F11. Pity counter
**Decyzja:** pity legendary co 7 leveli (nie 5) — żeby legendary zachowało "wow effect".

### F12. Karty do 52
**Decyzja:** plan 05 ma 40 kart. Akceptujemy — 40 kart jest realistyczne. Master plan zaktualizuję na "40+ kart". Nie blokuje implementacji.

### F13. Synergy minPlayerLevel
**Decyzja:** synergy karty (Hellfire, True Sight) wymagają `state.player.level >= 6` jako dodatkowy prereq (oprócz ich card prereqs). Nie pojawi się Hellfire na lvl 3.

### F14. Necromancer + Slime split
**Decyzja:** dzieci slime'a NIE wyzwalają `necromancer` ally summon (flagujemy `child=true` na splitted slimes; necromancer sprawdza `if (e.child) return;`). Limit 1 ally w sumie.
