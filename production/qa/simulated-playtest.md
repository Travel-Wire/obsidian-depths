# Simulated Playtest Report — Obsidian Depths
Date: 2026-04-30
Tester: QA-Tester (CCGS, simulated)

## Methodology
Symulacja w glowie na podstawie pelnej lektury kodu `index.html` (4706 linii) — liczby HP/ATK/DMG/turn budgets sa odczytywane bezposrednio z `ENEMY_DEFS`, `ITEM_DEFS`, `CARD_DEFS`, `CFG`, `triggerTrap`, `aiDragon` i `gainXP`. Nie odpalono fizycznie gry.

---

## Run 1 — Casual / first-time
**Player profile:** new, learns by doing, czyta intro
**Started:** floor 1, Rusty Dagger 🗡️ (+1 ATK, dur 50) + Tattered Robes 🥋 (+1 DEF, dur 30) → total ATK 5, DEF 2, HP 25/25
**Outcome:** death floor 3-4

### Timeline
- **Floor 1 (turny 1-80):** Title screen jest ladny ale prompt mowi tylko "WASD/Arrows — Move & Attack, 1-9 — Use Item, G — Pick Up, > — Stairs, R — Repair". Gracz nie wie czym jest `+` ani co robi anvil, nie wie tez ze "attack" odbywa sie przez wejscie na wroga (bump combat). Pierwszy rat (6 HP) — gracz nadeptuje na tile, walka idzie auto. ATK 5 vs DEF 0 → 4-6 dmg, rat pada w 2 tury, oddaje 1-2 dmg. OK. Snake daje poison (3 ticks * 2 dmg = 6 HP straty po walce — gracz panikuje bo nie wie skad, "POISON: 3" sie wyswietla ale legacy `state.player.poisoned` daje 2-4 dmg/turn = 6-15 HP dodatkowo). Skeleton (12 HP) zajmuje 3-4 ture. Drzwi (`+`) — gracz po 30 sekundach dochodzi ze idzie na nie i sie otwieraja (kosztuje 1 ture). Stairs `>` znalezione, ale gracz nie wie ze trzeba nacisnac `>` — przez ~10 sek stoi na nich i nic. Pierwsze sukcesy: 1 level up, kart-modal otwiera sie i to JEST highlight runu — psychologicznie czuc nagrode ("+10 max HP" wybiera).
- **Floor 2 (turny 80-160):** Pojawia sie Pit Trap (`o`). Gracz nadeptuje **pierwsza pulapke** ktorej nie widzial (revealed dopiero w FOV) → instant fall na floor 3. Frustracja #1: "co sie stalo? czemu sie zmienil floor?". Brak komunikatu typu "TRAP — back away?" — pulapka jest revealed dopiero gdy w FOV (radius 6). Spike trap zabiera 4-8 dmg.
- **Floor 3:** Pojawia sie spider (ambusher, hidden) i mimic (disguised jako 📦). Gracz widzi item 📦 i podchodzi pickupowac → mimic atakuje za 8 dmg ATK (z scale 1.3x → 10 dmg). Frustracja #2: "to byl item!". Ghost (5 ATK, ignoresDef) ignoruje DEF gracza → pelne 5-7 dmg/hit. Anvil moze sie pojawic (50% chance, floor 3+) ale gracz nie wie ze trzeba nacisnac R, w tooltipie pisze "R — Repair" ale nie wie ze trzeba stac NA anvilu.
- **Floor 4 (death):** Goblin throws (range 3, 35% chance, 3 dmg) + orc charger (3-tile charge + bleed) → gracz przy 8/25 HP, weapon dur ~5/50 (zuzyl bo crit kosztuje 3x dur). Ghost atakuje przez sciane (phaseWalls), gracz traci ostatnie 8 HP. **Death floor 4, ~250 turow, level 3-4.**

### Key observations
- Tutorial bardzo skapy — brak in-game objasnienia anvila, doors, traps, mimic, poison
- Pit trap = instant floor descent — feels jak bug/punisher pierwszy raz
- Bump-to-attack jest standardem rogue ale gracz casualowy moze nie wiedziec
- `+` (drzwi) i `>` (stairs) sa ASCII, w grze 2026 to reads jak ze byla porzucona estetyka
- Kart modal pierwsze level up = highlight, ale gracz nie wie ze synergy/active sa ograniczone (tylko 2 active naraz)
- `POISON:` wyswietla sie ale gracz nie wie ze ticks lecza co 1 ture i zabieraja 2-4 dmg

---

## Run 2 — Experienced / 5th run
**Player profile:** zna mechaniki, wie o drzwiach + bump combat, wie o pit trap (omija `o`), wie ze anvil = stand on R
**Build choices:** Floor 1 lvl up → Brawn (+2 ATK), Floor 2 → Vigor (+10 maxHP), Floor 3 → Lifesteal (10% melee→heal), Floor 4 → Resilience (+2 DEF), Floor 5 → Lucky (+5% crit), Floor 6 → legendary popup (pity przy 7) → King's Resolve (+20 maxHP, full heal)
**Outcome:** floor 7-8

### Timeline
- **Floor 1-3:** Pewnie. ATK 5→7 (Brawn) → 9 (Brawn II), DEF 2→4. Iron Sword (atk 4) zamiast dagger = 11 ATK total. Tempo: ~30 turow/floor. Lifesteal po Floor 3 daje ~1 HP/hit → gracz nie potrzebuje potions.
- **Floor 4-6 (tension):** Wraith (xpdrainer, drainXp 5) — gracz wpada w pulapke "uciekam czy walcze" bo wraith **drenuje XP** ktory mu blokuje pity counter. Demon (floor 7+, ale moze w ostatnim) teleportuje co 5 turow + AoE 6 dmg r2 → trzeba uciec. Doors blokuja tempo: kazdy door = 1 tura, AI chase memory (15 ticks) sprawia ze pozostawione za toba enemies caly czas ida za toba i otwieraja drzwi za toba. Frustracja #3: gracz nie moze "zgubic" wrogow.
- **Floor 6 — pity legendary:** Gracz po 7 non-leg cards dostaje guaranteed legendary slot. Wybiera King's Resolve = full heal + 20 max HP. To **jest** highlight — czuje sie boski.
- **Floor 7-8 (crucial):** Demon (35 HP scaled to ~70, ATK 8 scaled to ~16) atakuje w stanie krytycznym. Gracz uzywa Whirlwind active (CD 10, hit all 8 adjacent for 1.5x ATK) — to OK clutch. Ale: gracz osiagnal `pendingLevelups` przy stairs i nie moze zejsc dopoki nie wybierze karty — to dobre scoping.
- **Floor 8 death:** Wizard caster (range 5, fireDmg 4 + freeze 2 ticks) + golem juggernaut (50 HP→117 HP, ATK 7→16, DEF 5→11) — golem jest immune POISON/BLEED. Gracz przy 12/55 HP, wizard rzuca freeze, gracz traci ture, golem dochodzi i 1-shotuje przy 16 dmg vs ~9 DEF = 7 dmg. **Death floor 8, ~600 turow, level 6-7.**

### Key observations
- Buildy konsystentne — Brawn/Vigor/Lifesteal stack feels strong
- AI chase memory daje moments-of-tension ale tez frustration "nie moge sie wymknac"
- Doors blokuja tempo szczegolnie w corridor traps — gracz musi uwazac na floor ALE drzwi go zatrzymuja w FOV-y trap zone
- Pity counter (7) = good — gracz czeka i czuje nagrode
- Frozen by wizard = death sentence przy juggernaucie — felt unfair (lost-turn = lost-game)

---

## Run 3 — Speedrun / 20+ runs, optimal
**Build:** Floor 1 → Brawn, Floor 2 → Sword Mastery (po pickup Iron Sword), Floor 3 → Lifesteal, Floor 4 → Vigor, Floor 5 → Resilience, Floor 6 → King's Resolve (pity), Floor 7 → Mythril Body (legendary, armor never breaks), Floor 8 → Dragon's Blood (immune fire, +50% vs bosses), Floor 9 → Berserker (lub Doppelganger, 25% dmg twice), Floor 10 → Stardust (CD -50%) lub Whirlwind active
**Equipment plan:** Iron Sword (atk 4) → Battle Axe na floor 4+ (atk 6, 20% crit, 2H) lub Iron Sword + Kite Shield (block 15%) — w idealnym build: Battle Axe + Berserker = +100% dmg under 50% HP. Chain Mail floor 4+. Crystal Amulet (+5 maxHP), Silver Ring (+1/+1).
**Outcome:** floor 10 victory possible, ~25-35 minut

### Optimal turn budget
- Floor 1: ~40 turn (1-2 levels gained, all rooms cleared for items)
- Floor 2-5: ~50-70 turow/floor (clear, stairs)
- Floor 6-9: ~80-100 turow/floor (more enemies, doors slow)
- Floor 10 boss: 8-15 turn na zabicie dragona w optymalnym buildzie

### Key observations
- **Dragon viability:** Dragon scaled to floor 10 = HP 80 * 2.35 = **188 HP**, ATK 12*2.35 = **28**, DEF 6*2.35 = **14**. Speed BLINK (200) = 2 turny per gracz. Breath cone range 5, dmg 8 (scaled? — checked: dmg w breath jest fixed `e.breathDmg || 8`, NIE scaled — to **bug/balance issue**), CD 3. Player optimal: ATK ~5 base + Brawn II (+4) + Iron Sword (+4) + Silver Ring (+1) = 14 ATK. Sword Mastery +30% = 18. vs Dragon DEF 14 → 4 dmg/hit, crit (lucky 25%) = 8 dmg. **Need 24-47 hits NON-crit, ~24 z critem mixed.** Z lifesteal 30% = 1-2 HP heal/hit, manageable. Z Battle Axe + Berserker: dmg 6+8 = 14, lvl up cards +10 ATK total → 24, 1.3x = 31, vs DEF 14 = 17, crit 2x = 34, berserker 2x sub-50%HP = 68. Realistycznie **6-10 hitow.** Dragon breath: 8 dmg, gracz przy DEF 9 → 1 dmg minimum (Math.max(1, dmg - DEF)). Z Dragon's Blood = immune fire → 0 dmg breath. **TO** jest critical — bez Dragon's Blood breath cone je 8/turn cd 3 = ~2-3 dmg/turn. Z DB = trywialne.
- **Optimal floor strategy:** floor 1-3 — Brawn/Sword Mastery/Lifesteal stack. Floor 4 = Battle Axe pickup (atk 6, 2H, 20% crit). Floor 6 pity = legendary (Mythril/King's). Floor 10 = jezeli pity counter 7+ ponownie w tym runie nie. Stardust gdy masz Whirlwind = clutch wave clear.
- **Skroty/exploity:** Pit trap = darmowy floor descent (skip floor 2 lub 3 jezeli nie zniszczyl HP, ale damage 0 dla pit). Blink Scroll przed dragonem = skok do losowej rooms. Fire Scroll AOE dmg 15 (range 5) — 1-shot wyniszcza demony. Mimic dropping NIE — mimics gubia oryginalny item.
- **Floor 10 victory:** **REALISTIC** w optimal build z Dragon's Blood + Berserker + Battle Axe + Lifesteal. Bez DB — 50/50, bez berserker/sword mastery — niezeanky.

---

## Aggregate Frustrations (top 5 across all runs)

1. **Pit traps = instant floor descent bez ostrzezenia** — pierwszy gracz interpretuje jako bug. Nawet doswiadczony nie widzi `o` przed nadepnieciem (revealed dopiero w FOV r6, czesto identyczne z zwykla podloga w cieniu).
2. **Brak in-game tutorial: anvil (`R` na tile), doors (`+` = otworz), bump combat, mimic disguise** — gracz uczy sie przez deathy, nie przez intro.
3. **AI chase memory (15 ticks) + doors blokuja ucieczke** — gracz nie moze "zgubic" wrogow nawet po skipie 15 turow, bo doors otwarte przez wrogow zostaja open i chain memory podaza.
4. **Wizard freeze + golem combo = lost-turn = lost-game** — freeze 2 ticks oznacza 2 wraith ataki za free; juggernaut DEF 11 + immune do POISON/BLEED.
5. **Weapon durability — twoHanded zuzywa 2x, crit zuzywa 3x** — Battle Axe (dur 50) zlamie sie po ~16 critach. Bez anvila gracz traci damage spike.

## Aggregate Wins (top 5)

1. **Card system z pity counter** — guaranteed legendary co 7 picks daje psychological reward loop, motywuje continue.
2. **Lit rooms vs torch radius** — przyjemna napiecie eksploracji, momenty "ah tu jest wszystko widac".
3. **Synergy cards (Hellfire, True Sight)** wymaga prereqs (lvl 6 + 2 inne cards) = nagroda za commit do build, real RPG depth.
4. **Active skills (Q/E)** — Whirlwind/Frost Nova/Death Touch daja agency w trudnych momentach.
5. **Visual feedback** — particle effects, screen shake na crit, floating damage text — combat feels good.

## UX Recommendations (priority order)

- [ ] 1. Add intro tutorial overlay floor 1: "Walk into enemy = attack", "Press > on stairs", "Press G to pick up", "+ = closed door" — 5-7 hint bubbles
- [ ] 2. Reveal pit traps z **alarmu** (audio cue) zanim gracz nadepnie, lub dodaj +1 turn warning ("Pit ahead — step?")
- [ ] 3. Anvil — onfirst-discovery floating text "Press R to repair" (jak w Hades)
- [ ] 4. Mimic — first encounter dac subtle wisible cue (eyes blink, slight wobble) zeby gracz mial szanse zauwazyc
- [ ] 5. Freeze — kapeczka "You are frozen for X turns" na HUD + countdown bar
- [ ] 6. AI chase memory — limit do 8 turow lub dodac "dropped scent" mechanic (rzucanie itemu odciaga)
- [ ] 7. Weapon durability indicator — przy <20% pulsowac czerwonym, ostrzec **proaktywnie** (juz jest komunikat ale tylko co 5 turow)
- [ ] 8. Dragon's Blood card — drop weight cards ktore sa critical przed floor 10 (obecnie pure RNG czy gracz dostanie immune fire)
- [ ] 9. Stat panel pokazac aktywne synergy/cards z tooltipami (icons sa, ale tooltip dopiero na hover na desktop)
- [ ] 10. Death screen — pokazac "killed by [enemy]" + "tip: [contextual hint]" zeby uczyc na bledach

## Replayability Score

**7/10** — Po pierwszym deathu gracz **prawdopodobnie** wraca (kart-system kusi), ale po 10 runach bez Dragon's Blood na pickup przed floor 10 frustracja rosnie. Pity counter daje rythm ale bez **deterministic** access do anti-fire cards floor 10 jest RNG-checkpoint. Buildy sa rozne (sword/axe/bow synergies), 40+ kart, 7 active skills — variety jest. Brak meta-progresji (unlocks po smierci) ogranicza grind motivation w 20+ runach. Single-file HTML5 = niskie tarcie zapuszczenia (browser, no install). **Werdykt: solid 1-week obsessive replay, potem zaleznie od nowego content/meta-progression.**
