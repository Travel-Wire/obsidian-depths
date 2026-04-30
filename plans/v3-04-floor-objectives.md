# v3-04 — Floor Objectives System
Designer: Game-Designer + Level-Designer (CCGS)
Reference plans: `plans/03-mobs-ai.md`, `design/systems/biomes-system.md`
Status: Draft v1.0
Last updated: 2026-04-30

## Problem statement

Aktualnie gracz schodzi po schodach na kolejne piętro bez żadnego celu poza eksploracją. Brakuje **gameplay loop**, **variety** między piętrami i **tension/reward feel**. Każde piętro to ten sam loop: "wejdź → zabij co się da → znajdź schody → zejdź". Brakuje mini-celu który nadaje kierunek decyzjom (po co iść do tamtego pokoju? po co ryzykować?), brakuje **bossów** którzy markują postęp, brakuje też kontrastu między piętrami eksploracji a piętrami "płatnymi" (boss/skarbiec).

Bez celu na piętro permadeath nie boli — śmierć na F5 czuje się tak samo jak na F3, bo gracz nie zostawia po sobie undone-stuff. Z celami: śmierć na "Boss Floor" boli inaczej niż na "Find the Key Floor". To jest filozofia tego planu.

## Design philosophy

> **Each floor = mini-narrative.** Gracz wchodzi → widzi cel w HUD → improwizuje pod ten cel → spełnia → schody się aktywują (gold glow + chime) → schodzi z poczuciem **"ja TO zrobiłem"**.

Trzy filary:

1. **Variety przez constraint.** Nie zmieniamy core'a (combat + exploration), zmieniamy *pytanie które gracz sobie zadaje*. "Czy pójdę za tymi mobami?" → "Czy zostało jeszcze 3 mobów do Slay the Beast?". To cheap-to-build, deep-in-impact zmiana.
2. **Pętla dwustopniowa.** Co 2 piętra: piętro eksploracji (Find Key / Cleanse / Reach Altar / Survive) → piętro bossa (jednoznaczny cel, wzmocniony reward). To trzyma się 1-do-1 z `biomes-system.md` — boss floor = drugi floor biome'a.
3. **Bonus optional zawsze.** Każde piętro ma drugi cel ukryty (No Damage / Pacifist / 100% Explored), nieobowiązkowy, z mini-rewardem. Daje powtarzalność i flow dla speed-runnerów bez karania casuali.

Anti-patterns które ten plan zabija:
- "Po co tu zostać po pokonaniu wrogów?" → bo cel jeszcze niespełniony.
- "Schody są od razu, więc lecę" → schody zablokowane do completion.
- "Boss w roguelike jak loteria" → 5 stałych bossów, predictable arc.

## Objective catalog (10)

Wszystkie objectives mają wspólny shape: `{ id, name, target, progress, complete, bonus?, hudText, completeFx }`. Spawnowane przez `pickObjectiveForFloor(floor)` — deterministyczne (patrz Floor-by-floor) z drobnym room-tweakiem (np. ile pools, ile chestów).

| # | ID | Name | Mechanic | Difficulty | Reward | Failure-safe |
|---|----|------|----------|------------|--------|--------------|
| 1 | `slay_beast` | Slay the Beast | Zabij wszystkich enemies na piętrze (count → 0). Liczy też mobki spawnowane w trakcie | Easy (F1) → Medium (F3+) | Standard: stairs unlock | Mob stuck behind wall? Po 30 turach od ostatniej śmierci → spawn ekstra mob na visible tile gracza |
| 2 | `find_key` | Find the Key | Klucz 🗝️ ukryty losowo w 1 z 3-5 chestów. Otwórz właściwy → key na pasek inwentarza → schody otwiera się "key icon used" | Medium | Standard: stairs unlock + 1 random potion | Map marker (z minimap-system) na chestach + klucz "guaranteed" w jednym z nich; jeśli gracz zabuguje chest wszystkich aut-mark |
| 3 | `survive_tide` | Survive the Tide | Wytrzymaj X tur (40-60). Co 8 tur spawn wave 3-5 mobs przy walls | Hard | Standard + 1 reroll na next levelup | "Pause on combat" — timer nie tika gdy gracz jest adjacent do wroga (nie żebyś tylko biegał) |
| 4 | `slay_champion` | Slay the Champion | Zabij oznaczonego "elite" potwora (purple glow + nameplate, +50% HP/ATK/DEF, drops Rare item) | Medium | Standard + Rare item guaranteed | Champion zawsze spawnuje w odległym pokoju, awake od t=0 (nie ucieknie z floor — bound to floor) |
| 5 | `reach_altar` | Reach the Altar | Dotrzyj do 🔯 special tile w odległym pokoju. Ścieżka usiana traps i mobs | Medium | Standard + altar grants +1 max HP permanent | Altar widoczny na minimap od entry; jeśli pokój zablokowany → mini-quest: zdobądź key z mob-drop |
| 6 | `cleanse_pools` | Cleanse the Pools | Zniszcz X (3-5) "blood pools" 🩸 — obiekty na floor. Każdy zostawiony spawnuje 2 mobs co 5 tur | Hard (przyrostowo) | Standard + Cleanse banner heals 25% HP | Pool nie spawnuje gdy gracz w ≤3 tile odległości (anti-grief — nie spawnuj mobków pod nogami) |
| 7 | `defeat_boss` | Defeat the Boss | Zabij bossa (5 stałych — patrz Boss design). Boss = 3-4 phazy mechaniczne | Very Hard | Boss reward: +1 Legendary item + 2 cards na next levelup + pity slot | Boss zawsze w lit room (z biomes-system). Boss room ma 1 emergency healing fountain (1 use, 50% HP) za drzwiami |
| 8 | `loot_vault` | Loot the Vault | Odnajdź "Vault Room" — lit room z 3 chestami i 3 strażnikami (Mimic + Champion + Wraith). Otwórz wszystkie 3 chesty | Hard | Standard + 3 guaranteed Rare/Legendary drops | Strażnicy bound do vault room, nie wychodzą; gracz może uciec i wrócić po heal |
| 9 | `race_curse` | Race the Curse | HP slowly drains 1/turn aż dotrzesz do schodów. Stairs visible od entry | Medium-Hard | Standard + 1 random scroll | HP drain pauses w combat (gdy adjacent do wroga); pause też podczas otwierania chestu |
| 10 | `no_damage` | No Damage Run (BONUS) | Zachowaj 100% HP do końca floor. Auto-tracked, optional | Variable | **Legendary card** drop na end-floor + bonus mark "Unscathed" | n/a (bonus, fail = brak rewardu, nie blokuje progresji) |

**Decision rule:** `slay_beast` jest "fallback" jeśli pick fails. `defeat_boss` jest hard-coded na F2/F4/F6/F8/F10. Reszta rozdana ręcznie per-floor (patrz niżej).

### Bonus / side objectives (zawsze obecne, faded HUD)

- **`bonus_no_damage`** — zachowaj 100% HP. Reward: Legendary card.
- **`bonus_speedrun`** — kończ floor w ≤ X tur (X = floor*40). Reward: 1 reroll na next levelup.
- **`bonus_pacifist`** — dotrzyj do schodów bez zabijania (sneak only). Reward: unique scroll "Whisper of Peace" (+1 unique mod). **Niedostępne na boss floor.**
- **`bonus_explored`** — 100% mapy odkryte (minimap covered). Reward: +25% HP heal.
- **`bonus_no_skip`** — wszystkie levelups taken (no skipped card draft). Reward: extra rare item drop.

Bonus objectives kumulują się — gracz może spełnić 2-3 naraz na 1 floor.

## Floor-by-floor assignment

Mapowanie objectives 1:1 z `biomes-system.md` (każde piętro 1 main objective + bonus pool). Difficulty curve = biome difficulty + objective difficulty.

| Floor | Biome | Main Objective | Boss? | Notes |
|-------|-------|----------------|-------|-------|
| F1 | Crypt | `slay_beast` (8 mobs total — easiest tutorial) | — | Tutorial: pierwszy objective, popup "Defeat all enemies to unlock stairs" |
| F2 | Crypt | `defeat_boss` — **Crypt Lord 💀** | Yes | Pierwszy boss, easy intro do mechaniki phaze |
| F3 | Cave | `find_key` — 🗝️ ukryty w 1 z 4 chestów | — | Wprowadza chest-investigation loop |
| F4 | Cave | `defeat_boss` — **Cave Golem King 🗿** | Yes | Boss z AoE shockwave (telegraph turn) |
| F5 | Lava | `survive_tide` — 50 tur, wave co 8 | — | Highest tension floor — gracz nie kontroluje tempa |
| F6 | Lava | `defeat_boss` — **Demon Lord 😈** | Yes | Boss teleport + Hellrain mechanic (z biomes-system Lava) |
| F7 | Forest | `reach_altar` — altar w odległym pokoju, dużo vine-traps | — | Forest = traversal puzzle; altar daje +1 max HP |
| F8 | Forest | `defeat_boss` — **Treant Elder 🌳** | Yes | Boss stationary phase 1 → uproot phase 2 |
| F9 | Lair | `cleanse_pools` — 5 blood pools, każdy spawnuje 2 mobs gdy lefted | — | Pre-final chaos floor; gracz uczy się prioritizing |
| F10 | Lair | `defeat_boss` — **Dragon 🐉** (final) | Final | Endgame, win screen + leaderboard |

**Alternatywne objectives (Open Question — patrz §11):** F3 i F7 mogą być zamienione z `loot_vault` lub `race_curse` w trybie "endless" / replay. Na pierwszym MVP — fixed mapping powyżej (deterministic dla tutorial).

**Bonus pool** każdego floor: zawsze `bonus_no_damage` (always-on tracker) + 1 losowy z {`bonus_speedrun`, `bonus_explored`, `bonus_no_skip`}. `bonus_pacifist` tylko na F1, F3, F5, F7, F9 (non-boss floors).

## Reward structure

Trzy poziomy reward:

### Tier 1 — Standard objective complete

- Stairs unlock: szare → gold-glow + pulse animation
- Sound cue: ascending chime (3 notes)
- Screen flash: subtle gold tint 200ms
- Floating text "Objective Complete!" w środku ekranu (1.5s)
- Mini-bonus: standard objective ma `extraReward` zdefiniowany w obj catalog (heal / item / scroll) — mały, ale satysfakcjonujący

### Tier 2 — Boss kill (F2/4/6/8)

- All Tier 1 rewards
- **+1 Legendary item drop** (gwarantowany — patrz `biomes-system.md` Boss Reward)
- **+1 levelup card pity slot** — następny levelup oferuje 4 karty zamiast 3
- **+2 cards on next levelup** (z biomes-system pity-bonus)
- Unique flavor drop ("Crypt Plate", "Heart of Stone", "Demon Sigil", "Treant Seed")
- Boss death cinematic: slow-mo (0.5s) + particle storm + camera shake
- Boss room przekształca się w "memorial" — gold-glow gdzie boss padł, dla całego runu

### Tier 3 — Final boss (F10 Dragon)

- All Tier 2 rewards
- **Win screen** z stats: tury, killcount, levelup decisions, deaths-avoided
- **Leaderboard entry**: time, score, build (cards taken)
- Save run-summary do localStorage dla "history" view
- Unlock potencjalnie meta-rewards (skin, +1 starting potion na new run — open question)

### Tier 4 — Bonus objectives (cumulative)

| Bonus | Reward |
|-------|--------|
| `no_damage` | Legendary card on next levelup |
| `speedrun` | 1 reroll token na next levelup |
| `pacifist` | Unique scroll "Whisper of Peace" |
| `explored` | +25% HP heal at floor end |
| `no_skip` | 1 extra rare item drop |

Wszystkie bonusy kumulują się. Maksymalny single-floor reward: Boss Tier 2 + 3 bonusy = mega-loot floor (rzadkie ale możliwe — ekstremalnie satysfakcjonujące).

## Boss design (5 bosses + 1 final)

Każdy boss ma 3-4 phazy (HP threshold based), unique mechanics, lit boss room (z biomes-system), intro sequence (kamera focus + name banner + brief mechanic hint), death cinematic.

### F2: Crypt Lord 💀 (extension of Lich w biomes-system)

**Stats**: HP 60, ATK 5, DEF 2, Speed NORMAL, XP 100

**Phase 1 (HP > 75%)**: passive caster — kasta FROST z range 5 co 3 tury. Standard movement.
**Phase 2 (75-50%)**: summons 2 skeletons co 5 tur (skeleton = standard mob). Skeleton corpses on floor → resurrect-able.
**Phase 3 (50-25%)**: bone spike AoE — telegraph 1 turn → AoE radius 2 wokół Lorda, 6 dmg.
**Phase 4 (<25%)**: enrage — teleport raz na opposite corner + drains 10 player XP, regen self 20 HP. One-time only.

**Reward**: Legendary armor "Crypt Plate" (+5 DEF, immune POISON) + 2 cards on next levelup.

**Boss room**: lit, 12×9, 4 narożne sarkofagi (cosmetic, mogą resurrectować skeletons).

**Intro**: kamera fade + "The Crypt Lord rises..." banner 2s, mechanic hint: *"He commands the bones."*

### F4: Cave Golem King 🗿 (Golem variant, scaled)

**Stats**: HP 90, ATK 9, DEF 7, Speed CRAWL, XP 150

**Phase 1 (HP > 75%)**: bare-bones march. Hits hard, slow. Telegraph: lifts arm 1 turn before strike.
**Phase 2 (75-50%)**: ground slam co 3 tury — AoE shockwave radius 2, 4 dmg, knocks player back 1 tile.
**Phase 3 (50-25%)**: summons 3 minor "Stone Heart" pickups (small HP heal items dropped on floor — interesting risk/reward, gracz może je użyć vs Golem może je rozjebać).
**Phase 4 (<25%)**: rage charge — speed → NORMAL, hits +50% dmg.

**Reward**: Legendary weapon "Heart Hammer" (+4 ATK, 25% knockback) + 2 cards on next levelup.

**Boss room**: lit, 13×10, central rocky arena z 4 pillars (cover dla gracza, breakable po 3 hitsach).

**Intro**: ground tremor effect 1s + "Cave Golem King awakens." banner. Mechanic hint: *"The earth itself is his ally."*

### F6: Demon Lord 😈 (Demon variant, scaled, z biomes-system Hellrain)

**Stats**: HP 110, ATK 10, DEF 4, Speed NORMAL, XP 200

**Phase 1 (HP > 75%)**: standard demon teleport co 5 tur + adjacent attack.
**Phase 2 (75-50%)**: signature **Hellrain** — co 4 tury drops 5 fire AoE markers across room, telegraph 1 turn → detonate next turn 5 dmg radius 1 each.
**Phase 3 (50-25%)**: permanent fire-aura — adjacent tiles do bossa = 2 dmg/turn standing damage (kite-or-die).
**Phase 4 (<25%)**: combine — Hellrain + aura + teleport co 3 tury (manic phase).

**Reward**: Legendary scroll "Demon Sigil" (3 charges: cast Fireball AoE 8 dmg) + 2 cards on next levelup.

**Boss room**: lit, 14×10, sulfuric vents jako environmental hazard (immune dla bossa, dmg dla gracza).

**Intro**: red flash + "The Demon Lord descends." banner. Mechanic hint: *"Watch the floor."*

### F8: Treant Elder 🌳 (NEW boss z biomes-system Forest)

**Stats**: HP 120, ATK 8, DEF 6, Speed CRAWL (phase 1) / ORTHOGONAL CRAWL (phase 2+)

**Phase 1 (HP > 75%)**: stationary, immobile root. Summons 1 wolf co 3 tury. Casts Entangle (1-tile radius wokół gracza → 2-turn FREEZE) co 5 tur.
**Phase 2 (75-50%)**: room fills with vine-tiles (act jak web-tiles, SLOW on step). Boss spawns 2-3 vines/turn.
**Phase 3 (50-25%)**: **Uproots** — boss staje się mobile, MOVE_PATTERN.ORTHOGONAL CRAWL. Wolves stop spawning. Cinematic: ground crack + "He moves." popup.
**Phase 4 (<25%)**: Vine Storm — wszystkie vine tiles eksplodują na 1 turn (3 dmg każdy gracza tile), nowe vines spawn density 50%.

**Reward**: Legendary armor "Treant Seed" (+3 DEF, regen 1 HP/turn) + 2 cards on next levelup.

**Boss room**: lit, 14×11, sunken-forest aesthetic, vine-tile floor density rośnie z phaze.

**Intro**: leaves drift 1s + "The Forest awakens." banner. Mechanic hint: *"The roots remember."*

### F10: The Dragon 🐉 (final, z plan 03-mobs-ai)

**Stats**: HP 80 (existing), ATK 12, DEF 6, Speed FAST. Buffed dla finalboss: HP 150 dla full final feel.

**Phase 1 (HP > 75%)**: standard dragon AI (cone breath range 5, cooldown 3, 8 dmg). Standard chase.
**Phase 2 (75-50%)**: 2 Wyrm Hatchling minions spawn at corners (existing biomes-system). Breath cooldown → 2.
**Phase 3 (50-25%)**: **Wing Buffet** — co 4 tury knock player back 3 tiles + 3 dmg. Breath always available (no cooldown).
**Phase 4 (<25%)**: **Final Roar** — 1× cinematic interrupt: full-room breath 6 dmg radius 5 (gracz może block via scroll/altar). Po Roar dragon enters berserk: speed +50%, ATK +30%.

**Reward**: Legendary "Dragon Scale" + Win Condition + Leaderboard entry.

**Boss room**: lit, 15×12, raised central platform z gold-flecks, treasure piles cosmetic. Existing biomes-system Lair design.

**Intro**: dragon roar SFX (loud, primary cinematic moment) + "THE DRAGON" banner 3s. Mechanic hint: *"Do not stand in the breath."*

**Death cinematic**: slow-mo 1s + screen-wide gold particle storm + dragon emoji disintegrates into ash + "VICTORY" full-screen overlay → win screen.

## HUD design

### Top-center objective tracker (always visible)

```
┌────────────────────────────────────────┐
│ Objective: Find the Key (0/1)        🗝️│
│ Bonus: No Damage Run     [tracked]   ✨│
└────────────────────────────────────────┘
```

- Position: top-center, 280px wide, dark translucent bg (rgba(0,0,0,0.65))
- Main objective row: bold, white, gold icon na end
- Bonus row: faded (alpha 0.6), italic, smaller font
- Progress display: `(current/target)` lub timer countdown lub "Active"
- On hover (desktop): tooltip pokazuje objective description + reward

### Objective complete sound cue + visual

- 3-note ascending chime (C-E-G major triad, 0.4s total)
- Gold screen-tint flash 200ms (alpha 0.15 → 0)
- Floating text "Objective Complete!" 64px white-with-gold-stroke, fade out 1.5s
- Stairs icon na minimap pulses gold

### Stairs visual states

| State | Visual |
|-------|--------|
| Locked (objective not complete) | Grey-out + small "🔒" icon overlay + slight desaturation |
| Unlocked (objective complete) | Gold glow pulse (1.5s loop) + bright stairs emoji + ambient particle (gold sparkles) |
| Boss not killed | Same as locked but z dodatkową red pulse (urgency) |

### Boss-specific HUD additions

- Boss HP bar: horizontal bar bottom-center, full-screen-width feel, name + emoji + phase indicator (e.g. "Crypt Lord — Phase 2/4")
- Phase transition: HP bar flashes red 0.3s + new phase name banner ("Phase 3: Bone Spike")
- Mechanic warnings: telegraph indicators (red AoE outline, charge direction arrow)

### Sub-objective tracker (bonus list)

Bottom-right corner, max 3 lines, alpha 0.4 (faded). Display tracked bonus z progress:
```
✓ No Damage    [active]
○ Speedrun     [127/400 turns]
○ Explored     [62/100%]
```
Spełnione bonusy: green checkmark + alpha 0.7 (slightly brighter).

## Failure / softlock prevention

| Objective | Edge case | Solution |
|-----------|-----------|----------|
| `slay_beast` | Mob stuck behind wall (dungeon gen bug) | Auto-detect po 30 turach od ostatniej śmierci → spawn ekstra mob na visible tile, log "A creature stirs nearby." |
| `slay_beast` | Mimic w stanie DISGUISED (z plan 03) liczy się jako enemy? | YES — counts. Reveal triggered przez chebyshev ≤ 1 (jak normalnie), liczone do mob count od start floor |
| `find_key` | Gracz omija chest (np. boss-rush playstyle) | Map marker (z minimap-system) na każdym chest. Po 100 turach: chest emit gold-pulse particles widoczne przez ścianę (ping) |
| `find_key` | Wszystkie chest otwarte, brak klucza (bug) | Watchdog — po `chestsOpened === chestsTotal && !hasKey`: spawn key na floor losowo near gracza, log "A key glints in the dust." |
| `survive_tide` | Player just stoi w corner | Wave spawning algoryzm spawnuje mobs proportionally do dystansu od gracza — corner = mobs spawn at 2 sides closing in |
| `survive_tide` | Timer-stuck w combat (forever) | "Pause on combat" pauza tylko gdy chebyshev ≤ 1 do enemy AND last-attack < 3 turn. Idle stand-off = timer continues |
| `survive_tide` | Player runs out of HP early | Każda wave drops 1 healing potion (radius 5 wokół spawn) — emergency supply |
| `slay_champion` | Champion stuck w wall | Champion ma `boundToFloor=true` flag, force-spawn na floor entry w random pokój ≥ 5 tiles od gracza, awake od t=0 |
| `slay_champion` | Champion ucieka (low HP coward AI) | Override AI: champion nigdy nie ucieka, nawet jeśli base AI = `coward`. Champion-only flag `noFlee=true` |
| `reach_altar` | Altar pokój odcięty (bug w corridor gen) | Watchdog: BFS od player → altar przy floor entry. Jeśli unreachable → re-generate corridor connecting them |
| `reach_altar` | Gracz nie wie gdzie altar | Altar visible od entry na minimap (różowy 🔯 icon). Po 50 turach: altar emit ambient pulse (1 sparkle co 5s) widoczny przez ścianę |
| `cleanse_pools` | Pool spawnuje moba który spawnuje mocnego mob loop (chain) | Cooldown na spawn z pool: min 5 tur między spawns z tego samego pool. Max 4 mobs alive z 1 pool jednocześnie |
| `cleanse_pools` | Pool pod gracza nogami od entry | Pool nie spawnuje mobs gdy gracz w ≤3 tile odległości (anti-grief) |
| `defeat_boss` | Boss bug (utknie w fazie, HP nie spada) | Health watchdog: jeśli boss HP nie zmienia się przez 50 tur → log "The boss appears unstable." + force phase advance + 5 HP loss |
| `defeat_boss` | Gracz osłabiony, nie da rady | Boss room ma 1 emergency healing fountain za drzwiami przed bossem (1 use, 50% HP heal). Tylko 1×/floor |
| `loot_vault` | Wszystkie 3 strażników agressywni jednocześnie = zbyt hard | Strażnicy bound do vault room (won't follow gracza out). Gracz może uciec, heal, wrócić |
| `loot_vault` | Vault room nie generuje się | Watchdog: floor entry validation, jeśli no vault room z 3 chestami → re-trigger generateDungeon dla tego floor (max 3 retries) |
| `race_curse` | HP drain unfair w długiej walce | HP drain pause podczas combat (chebyshev ≤ 1 do enemy AND last-action = attack/move toward enemy) |
| `race_curse` | Gracz idzie zbyt wolno, dies przed schody | Floor curse drain rate scaled — F floor 9: 1 HP / 2 tur (slower than per-turn) |
| `no_damage` (bonus) | Acidental tick damage (poison from earlier floor not reset) | Bonus tracker resets na floor entry — "no damage taken THIS floor" only counts current-floor damage |

**Global watchdog** (run co 100 turach na floor):
- `objectiveStillReachable()` — sprawdź BFS, item exists, mob count consistent
- Jeśli no → emit "A path opens up..." log + auto-fix (spawn missing item / unstuck mob / heal pool count)
- Logged jako `[OBJECTIVE-WATCHDOG]` w console (debug only)

## Data schema

```js
const OBJECTIVE_DEFS = [
  { id:'slay_beast',     name:'Slay the Beast',     target:(f)=> f===1 ? 8 : 'all', reward:'standard',
    hudText:(p,t)=>`Slay the Beast (${p}/${t})`, fxComplete:'gold_chime' },
  { id:'find_key',       name:'Find the Key',       target:1,  chestCount:(f)=> 3+Math.floor(f/3),
    reward:'standard+potion', hudText:(p,t)=>`Find the Key (${p}/${t})`, fxComplete:'gold_chime' },
  { id:'survive_tide',   name:'Survive the Tide',   target:(f)=> 40 + f*3, waveEvery:8, waveSize:(f)=> 3+Math.floor(f/2),
    reward:'standard+reroll', hudText:(p,t)=>`Survive (${p}/${t} turns)`, fxComplete:'gold_chime' },
  { id:'slay_champion',  name:'Slay the Champion',  target:1,  championStatBonus:0.5,
    reward:'standard+rare', hudText:(p,t)=>`Slay the Champion (${p}/${t})`, fxComplete:'gold_chime' },
  { id:'reach_altar',    name:'Reach the Altar',    target:1,  altarReward:'maxhp+1',
    reward:'standard+altar', hudText:()=>'Reach the Altar', fxComplete:'gold_chime' },
  { id:'cleanse_pools',  name:'Cleanse the Pools',  target:(f)=> 3+Math.floor(f/3), poolSpawnEvery:5, poolSpawnSize:2,
    reward:'standard+heal25', hudText:(p,t)=>`Cleanse the Pools (${p}/${t})`, fxComplete:'gold_chime' },
  { id:'defeat_boss',    name:'Defeat the Boss',    target:1,  bossKey:null, // resolved per floor
    reward:'boss_legendary', hudText:(p,t,name)=>`Defeat ${name} (${p}/${t})`, fxComplete:'boss_chime+slowmo' },
  { id:'loot_vault',     name:'Loot the Vault',     target:3,  vaultGuards:['mimic','champion','wraith'],
    reward:'standard+3rares', hudText:(p,t)=>`Loot the Vault (${p}/${t})`, fxComplete:'gold_chime+vault_open' },
  { id:'race_curse',     name:'Race the Curse',     target:'reach_stairs', drainPerTurn:1, pauseInCombat:true,
    reward:'standard+scroll', hudText:()=>'Race the Curse - HP drains!', fxComplete:'gold_chime' },
  { id:'no_damage',      name:'No Damage Run',      target:'reach_floor_end_at_full_hp', isBonus:true,
    reward:'legendary_card', hudText:()=>'Bonus: No Damage Run', fxComplete:'rainbow_chime' },
];

const FLOOR_OBJECTIVES = {
  1:  { main:'slay_beast' },
  2:  { main:'defeat_boss', bossKey:'crypt_lord' },
  3:  { main:'find_key' },
  4:  { main:'defeat_boss', bossKey:'cave_golem_king' },
  5:  { main:'survive_tide' },
  6:  { main:'defeat_boss', bossKey:'demon_lord' },
  7:  { main:'reach_altar' },
  8:  { main:'defeat_boss', bossKey:'treant_elder' },
  9:  { main:'cleanse_pools' },
  10: { main:'defeat_boss', bossKey:'dragon' },
};

const BOSS_DEFS = {
  crypt_lord:      { emoji:'💀', name:'Crypt Lord',      hp:60,  atk:5,  def:2, speed:'NORMAL', ai:'lich',         phases:4, drop:'crypt_plate' },
  cave_golem_king: { emoji:'🗿', name:'Cave Golem King', hp:90,  atk:9,  def:7, speed:'CRAWL',  ai:'golem_king',   phases:4, drop:'heart_hammer' },
  demon_lord:      { emoji:'😈', name:'Demon Lord',      hp:110, atk:10, def:4, speed:'NORMAL', ai:'demon_lord',   phases:4, drop:'demon_sigil' },
  treant_elder:    { emoji:'🌳', name:'Treant Elder',    hp:120, atk:8,  def:6, speed:'CRAWL',  ai:'treant_elder', phases:4, drop:'treant_seed' },
  dragon:          { emoji:'🐉', name:'The Dragon',      hp:150, atk:12, def:6, speed:'FAST',   ai:'dragon_final', phases:4, drop:'dragon_scale', isFinal:true },
};

// State additions:
state.currentObjective = { id, progress, target, complete, completedAt, bossKey:null, extraData:{} };
state.bonusObjectives  = []; // [{ id, progress, target, complete }]
state.bossesDefeated   = []; // ['crypt_lord', 'cave_golem_king', ...]
state.floorEnteredHp   = 0;  // for no_damage tracking
state.floorEnteredTurn = 0;  // for speedrun tracking
state.floorChests      = []; // for find_key + loot_vault tracking
state.floorAltar       = null; // {x, y} for reach_altar
state.floorPools       = []; // [{x, y, mobsSpawned, alive}] for cleanse_pools
state.floorVault       = null; // {chests, guards} for loot_vault
state.curseActive      = false; // for race_curse
state.tideTimerStart   = 0; // for survive_tide
state.objectiveCompleted = false; // gates stairs
```

## Implementation file:line

| File | Section / Line | Change |
|------|---------------|--------|
| `index.html` ~540 (CONFIG) | After `BIOMES`, add `OBJECTIVE_DEFS`, `FLOOR_OBJECTIVES`, `BOSS_DEFS` |
| `index.html` ~660 (`newState`) | Add `currentObjective`, `bonusObjectives`, `bossesDefeated`, `floorEnteredHp`, `floorEnteredTurn`, `floorChests`, `floorAltar`, `floorPools`, `floorVault`, `curseActive`, `tideTimerStart`, `objectiveCompleted` to state init |
| `index.html` ~778 (`populateFloor`) | After biome mob population: call `setupFloorObjective(floor)` — spawns altar / pools / vault / champion / chests as needed per `FLOOR_OBJECTIVES[floor]`. On boss floor: skip standard population, call `spawnBoss(bossKey)` |
| `index.html` ~925 (`enterFloor`) | Reset all objective state for new floor: `state.currentObjective = createObjective(floor)`, `state.bonusObjectives = createBonuses(floor)`, `state.floorEnteredHp = state.player.hp`, `state.floorEnteredTurn = state.turn`, `state.objectiveCompleted = false` |
| `index.html` ~1050 (stairs check, before descend) | Block descent if `!state.objectiveCompleted`: log "The stairs do not open. Complete the floor objective first." + return |
| `index.html` ~979 (`attackEnemy`) | After enemy hp ≤ 0: call `onEnemyKilled(enemy)` → checks objective progress (slay_beast count, slay_champion match, defeat_boss match, vault guard kill); call `onPlayerHpChange()` → check no_damage bonus invalidate |
| `index.html` ~1120 (`processWorld` / `endTurn`) | Per-turn checks: `tickObjectiveTimer()` (survive_tide), `tickCurseDrain()` (race_curse), `tickPoolSpawns()` (cleanse_pools), `tickWatchdogs()` (every 100 turns), `checkObjectiveComplete()` |
| `index.html` ~1280 (rendering, after enemies) | Render objective-specific objects: altar tile (🔯), blood pools (🩸), key 🗝️ (visible after pickup), vault chest highlight, champion glow (purple aura) |
| `index.html` ~1400 (UI render) | Render objective HUD top-center, bonus tracker bottom-right, boss HP bar bottom-center (when boss active), stairs visual state (locked/unlocked) |
| `index.html` ~1500 (input handler) | On 'G' key (pickup): if standing on key 🗝️ → add to inventory, mark `find_key` progress. If standing on altar → trigger reach_altar complete + apply altar reward |
| `index.html` (new section) | `BOSS_AI_REGISTRY = { lich, golem_king, demon_lord, treant_elder, dragon_final }` — extends plan-03 AI_REGISTRY with phase-aware logic |
| `index.html` (new helpers) | `setupFloorObjective(floor)`, `spawnBoss(bossKey)`, `spawnAltar()`, `spawnPools(count)`, `spawnVault()`, `spawnChampion(floor)`, `placeKeyInChest(chests)`, `checkObjectiveComplete()`, `unlockStairs()`, `triggerObjectiveCompleteFx()`, `triggerBossCinematic(boss)`, `renderObjectiveHud()` |

## Acceptance criteria

- [ ] 1. Każde piętro F1-F10 ma 1 main objective widoczny w HUD top-center od entry
- [ ] 2. Schody zablokowane (grey + lock icon) do completion main objective
- [ ] 3. Schody odblokowane: gold glow + chime + "Objective Complete!" overlay
- [ ] 4. F2/F4/F6/F8/F10 mają boss z 4 phazami (HP-based transitions widoczne w HP bar)
- [ ] 5. Boss room jest `lit=true` (z biomes-system) + boss intro banner 2-3s
- [ ] 6. Boss death cinematic: slow-mo + particle storm + Legendary drop guarantee
- [ ] 7. F10 Dragon kill → Win Screen + Leaderboard entry zapis do localStorage
- [ ] 8. Bonus `no_damage` trackowany od floor entry (HP w momencie entry); damage z poison/bleed/curse counts; complete = 100% HP at stairs descend
- [ ] 9. Bonus rewards działają cumulatively: 2-3 bonuses na floor possible
- [ ] 10. `slay_beast` watchdog po 30 turach od last kill: spawn extra mob jeśli stuck
- [ ] 11. `find_key` chest count scales z floor; klucz guaranteed w jednym
- [ ] 12. `survive_tide` timer pauses w combat (chebyshev ≤ 1 do enemy AND last-attack < 3 turn)
- [ ] 13. `cleanse_pools` pools nie spawnują mobs w ≤3 tile odległości od gracza
- [ ] 14. `race_curse` HP drain pauses w combat
- [ ] 15. `reach_altar` altar visible na minimap od entry; altar reward = +1 max HP permanent
- [ ] 16. `loot_vault` vault room ma 3 chests + 3 guards, guards bound do room
- [ ] 17. `slay_champion` champion ma purple glow + nameplate + +50% stats; nigdy nie ucieka
- [ ] 18. Sub-objective tracker (bonusy) widoczny bottom-right, faded, max 3 lines
- [ ] 19. Boss HP bar pokazuje phase indicator (np. "Phase 2/4")
- [ ] 20. Sound cue na objective complete: ascending chime (3 nuty)
- [ ] 21. Watchdog co 100 turach sprawdza objective reachable (BFS check)
- [ ] 22. State persists w localStorage (resume after refresh): currentObjective, bossesDefeated
- [ ] 23. No softlock: każdy edge case z §"Failure prevention" testowany manually + unit test
- [ ] 24. Performance: HUD render ≤ 0.5ms/frame; per-turn objective checks ≤ 0.2ms
- [ ] 25. Tutorial popup na F1 entry: "Defeat all enemies to unlock the stairs!" (1 raz, dismiss-able)

## Estimated effort

**Total: ~24-32 hours of focused implementation** (single dev, single-file HTML5).

| Phase | Hours | Details |
|-------|-------|---------|
| 1. Schema + state plumbing | 2-3 | OBJECTIVE_DEFS, FLOOR_OBJECTIVES, BOSS_DEFS, state init, `enterFloor` reset |
| 2. HUD top-center + stairs lock visual | 2-3 | Render objective text, lock/unlock states, gold glow animation |
| 3. `slay_beast` (F1) — simplest, MVP loop | 1-2 | Count enemies, complete check, watchdog |
| 4. Bonus `no_damage` tracker | 1 | Track floorEnteredHp, invalidate on dmg, reward on stairs |
| 5. `find_key` (F3) | 2-3 | Chest spawning, key placement, pickup logic, key icon HUD |
| 6. `survive_tide` (F5) | 2-3 | Timer, wave spawning, combat pause logic |
| 7. `reach_altar` (F7) | 2 | Altar tile spawn, minimap marker, pickup trigger |
| 8. `cleanse_pools` (F9) | 2-3 | Pool tile spawn, periodic mob spawning, destroy mechanic |
| 9. Boss F2 Crypt Lord — first boss with 4 phases | 3-4 | Phase machine, intro/death cinematic, Lich AI extensions |
| 10. Boss F4-F8 (Golem King, Demon Lord, Treant Elder) | 4-5 | Phase logic per boss, mechanic-specific FX |
| 11. Boss F10 Dragon final + Win Screen + Leaderboard | 2-3 | Final phases, win cinematic, localStorage save |
| 12. Failure prevention watchdogs + edge cases | 2-3 | All 24 edge cases from §"Failure prevention" |
| 13. Polish: SFX, particles, transitions, tutorial popup | 1-2 | Chime sound, screen flash, F1 tutorial overlay |

**MVP cut** (12-15h): Phases 1-5 + simplified bosses (1-phase only) + skip `loot_vault` (use `slay_champion` instead) + `race_curse` cut.

**Full ship** (24-32h): all phases + polish + leaderboard.

## Open questions

| # | Question | Owner | Decision needed before |
|---|----------|-------|------------------------|
| 1 | Boss HP scaling — czy 60/90/110/120/150 wystarczy challenge dla pre-meta gracza, czy testers będą potrzebować +20% HP po playtest? | game-designer + playtest | Phase 9-11 implementation |
| 2 | `loot_vault` cut from MVP czy in? Heavy lift (vault gen + 3 guards + 3 chest tracking) — można zamienić na alternatywne `slay_champion` na replay-only F3 | game-designer | Phase 1 |
| 3 | Bonus `pacifist` vs combat-heavy biome (Forest, Lair) — czy w ogóle gracz da radę ominąć wszystkie mobs? Jeśli nie → cut bonus z tych floors | level-designer | Phase 4 |
| 4 | Win Screen design — czy leaderboard local-only czy globalny (online)? Online = backend, scope creep | game-designer | Phase 11 |
| 5 | Tutorial F1 — popup blocking input czy contextual (po pierwszym kill)? | ux-designer | Phase 3 |
| 6 | Replay value — po win F10 czy unlock "Endless Mode" gdzie objectives randomized? | game-designer | Post-MVP |
| 7 | Boss phase visual — czy każda phase zmienia boss emoji (np. Lich phase 4 → 💀✨) lub aura color? | art-director | Phase 9 |
| 8 | `defeat_boss` na F2 jest "tutorial boss" — czy obniżyć Crypt Lord do 40 HP (od 60) żeby gracz nauczył się phase mechanic bez frustracji? | game-designer | Phase 9 |
| 9 | Save state mid-floor — gracz quit-and-resume w połowie boss fight? | game-designer | Phase 11 |
| 10 | Bonus stacking limit — można teoretycznie spełnić 4 bonusy na 1 floor (no_damage + speedrun + explored + no_skip) — czy nie za hojne reward? | economy-designer | Phase 4 |
