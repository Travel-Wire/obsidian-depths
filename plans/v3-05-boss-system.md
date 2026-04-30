# v3-05 — Boss System
Designer: AI-Programmer + Game-Designer (CCGS)
Last updated: 2026-04-30
Implements pillar: "Earn a wow moment five times" (per `design/systems/biomes-system.md` §2)
Dependencies: plan 01 (FOV/torch), plan 02 (turn engine + status effects), plan 03 (AI_REGISTRY), `design/systems/biomes-system.md` (boss rooms scaffolded), v3-02-cards (Legendary card system), v3-03-content-pack (Wyrm Hatchling content pack — for optional F5 mid-boss).

---

## Problem statement

Right now the game has **no real bosses**. `Dragon` (`index.html:1016`) is a regular `ENEMY_DEFS` entry with bigger stats and a `forceSpawn:true` flag — its only "boss-ness" is that it always spawns on F10 (`index.html:2278-2284`) and uses the `aiDragon` cone-breath state machine. There are no:

- multi-phase encounters (boss never changes behavior at HP thresholds)
- telegraphed AoE attacks (no "1 turn warning" mechanic anywhere)
- summons / adds (no boss spawns minions to extend the fight)
- environmental changes during the fight (arena is static)
- arena lock-in (player can run away to corridors and the dragon just chases)
- cinematic moments (no intro, no death, no "ENRAGED" cue)
- bespoke AI per boss — every "boss" is just a `ai:'dragon'` reuse

The biomes GDD already promises 5 bosses (Lich, Golem King, Demon Lord, Treant Elder, Dragon) on F2/F4/F6/F8/F10, but those are aspirational entries in the `BIOMES[].boss` field — the AI, the arena rules, the cinematic frame, the rewards, and the difficulty tuning **do not exist yet**. This plan defines them. The result must be: each biome culminates in a boss the player remembers by name a week later.

## Design philosophy

Three load-bearing rules:

1. **Bosses are mechanic schools, not stat sponges.** Every boss teaches the player something they will need against the next boss. Crypt Lord teaches "focus the boss, not the adds". Golem King teaches "step out of telegraphs". Demon Lord teaches "control the floor's hot tiles". Treant Elder teaches "use fire / interrupt heals". Dragon teaches "manage cooldown windows and flight phases". Optional Lava Wyrm (F5 mid-boss) teaches "predict pop-up tells".
2. **Telegraph everything dangerous.** No boss ability one-shots a careful player out of nowhere. Everything that hits for >25% HP has a 1-turn telegraph (red zone, glyph on tile) — the boss casts on its *next* action. Skill = positioning during telegraphs, not reflexes.
3. **Phases are gear changes, not difficulty multipliers.** Boss phases at 75% / 50% / 25% **add** mechanics, they don't merely "buff stats". The 25% phase is the only "panic phase" (extra speed + spam abilities). Phases must be readable from particles + banner + glyph color, never from a hidden timer.

Anti-patterns this kills:
- "Boss is just a high-HP enemy" (current Dragon).
- "I died to RNG" — every boss death must trace to a missed telegraph or a positioning mistake the player can name.
- "I farmed adds for XP" — minions give 0 XP, boss gives 50 XP bonus on death, so kiting adds is never optimal.

## Boss roster (6)

Speed labels reference plan 02 `SPEED.{CRAWL,SLOW,NORMAL,FAST,BLINK}`. Movement uses plan 03 `MOVE_PATTERN.OMNIDIRECTIONAL` unless noted.

### F2 — Crypt Lord (Warden of the Forgotten) 👑💀

**Biome**: Crypt
**Stats**: HP 100, ATK 12, DEF 6, Speed NORMAL, XP 50, ai `aiCryptLord`
**Movement**: ORTHOGONAL (skeletal gait — no diagonal)
**Immunity**: BLEED (no flesh)
**Theme music vibe**: low cello drone in D minor, distant choir vocalise
**Banner**: "CRYPT LORD — Warden of the Forgotten"

**Phase 1 (100-75%)**: Basic ORTHOGONAL melee (12 dmg). Every 5 turns: summon 1 skeleton adjacent (cap: 3 alive minions). Minions are weak (HP 12 ATK 4) — they exist as XP-bait, not threat.
**Phase 2 (75-50%)**: Adds **Bone Spike** AoE. Every 4 turns: telegraph 5 floor tiles in a cross pattern around player's *current* position (red glyph on each), next turn spikes erupt for 14 dmg each. Player who steps off any of the 5 tiles eats 0 dmg. Overlapping zones do not stack.
**Phase 3 (50-25%)**: Adds **XP Drain** on melee hit — 5 XP / hit (never level-down, floors at 0). Visual: purple wisp from player to Crypt Lord. Players notice immediately — strong "mechanic introduced" signal.
**Phase 4 (25-0%) ENRAGED**: Speed → FAST. Summon every turn (still capped at 3 alive). Bone Spike cooldown halved (2 turns). On-hit drain doubles to 10 XP.

**Counterplay**: Focus the boss (minions cap at 3, killing them is XP-wash). Move on telegraphed spike turns. Save fire potion for phase 4.
**Drop**: Legendary armor "Crypt Plate" (+8 DEF, +20 max HP, immunity to DRAIN_XP). +50 XP bonus. +1 reroll on next card draft.

---

### F4 — Cave Golem King (The Mountain That Walks) 🗿👑

**Biome**: Cave
**Stats**: HP 180, ATK 14, DEF 10, Speed CRAWL (energy threshold doubled), XP 60, ai `aiGolemKing`
**Movement**: ORTHOGONAL
**Immunity**: POISON
**Theme music vibe**: taiko + stone-block percussion, C minor dorian
**Banner**: "GOLEM KING — The Mountain That Walks"

**Phase 1 (100-75%)**: Slow ORTHOGONAL chase, 14 dmg melee. Every 4 turns: **Ground Slam** — telegraph all 8 chebyshev-1 tiles around boss (red shockwave glyph), next turn 12 dmg + 1-tile knockback. Player adjacent eats it; player at chebyshev≥2 is safe.
**Phase 2 (75-50%)**: Adds **Boulder Throw** — every 3 turns, if `lineOfSight(boss, player) && chebyshev <= 6`, telegraph a 1-tile splash zone at player's current location, next turn boulder lands for 10 dmg in 1-tile radius. Tile becomes a `RUBBLE` obstacle for 4 turns (blocks movement, blocks LoS).
**Phase 3 (50-25%)**: Adds **Cracked Ground** environmental — every Ground Slam now leaves 4 random adjacent tiles `cracked` (visual: dark fracture overlay). Stepping on cracked tile = -3 dmg trickle damage (not a trap, no save). Cracked tiles are permanent for the fight.
**Phase 4 (25-0%) ENRAGED**: Speed → SLOW (was CRAWL — significantly faster). Slam cooldown 2. On every slam, the 8 surrounding tiles also crack.

**Counterplay**: Stay at chebyshev 2 from boss. Use rubble pillars to break LoS for boulder. Don't fight in cracked tile clusters.
**Drop**: Legendary weapon "Heart of Stone" (+6 ATK, +5 DEF, gives `juggernaut`-style hit-knockback). +50 XP. +1 reroll.

---

### F6 — Demon Lord (Sovereign of Hellrain) 😈👑

**Biome**: Lava
**Stats**: HP 280, ATK 18, DEF 8, Speed NORMAL, XP 80, ai `aiDemonLord`
**Movement**: OMNIDIRECTIONAL
**Immunity**: FIRE (all fire damage = 0; includes fireball scrolls and Lava Wyrm breath)
**Theme music vibe**: distorted brass + low taiko, F# minor
**Banner**: "DEMON LORD — Sovereign of Hellrain"

**Phase 1 (100-75%)**: OMNIDIRECTIONAL melee (18 dmg). Teleport every 6 turns to a random `randomFloorTileNear(player, 3)` tile. Teleport itself does no damage in P1 — it just repositions for melee.
**Phase 2 (75-50%)**: Adds **Hellrain** — every 4 turns drop 5 fire AoE markers (red `🔥` glyphs) across the room. Telegraph 1 turn, detonate next turn for 12 dmg, radius 1 each. Marker placement: 1 on player tile, 4 on random floor tiles within room. Cannot place two markers on same tile.
**Phase 3 (50-25%)**: Adds **Imp Summon** + **Fire Aura**. Every 5 turns summon 2 imps (small demon variants, HP 20 ATK 8, ai `aiBasic`, no fire immunity) at boss corners. Cap 4 alive imps. Aura: tiles within chebyshev 1 of boss deal 4 dmg/turn standing damage (visualized as smoldering tiles).
**Phase 4 (25-0%) ENRAGED**: Speed → FAST. Teleport every 2 turns (TP-spam). Hellrain cooldown 3. Aura radius 2. Teleport now drops a 1-radius hellrain on departure tile.

**Counterplay**: Don't stand still — predict teleport landing zone (3-tile chebyshev around player), clear hellrain tiles before they detonate. Save blink scroll for phase 4 chain-teleports.
**Drop**: Legendary scroll "Demon Sigil" (3-charge AoE r3 fire, ignores DEF, doesn't hurt player). +50 XP. +1 reroll.

---

### F8 — Treant Elder (The Rooted King) 🌳👑

**Biome**: Forest
**Stats**: HP 400, ATK 16, DEF 10, Speed CRAWL (P1 stationary, see below), XP 100, ai `aiTreantElder`
**Movement**: STATIONARY in P1; ORTHOGONAL CRAWL from P2 onward
**Immunity**: BLEED (wooden body)
**Weakness**: FIRE (×1.5 damage from any fire source — fireball scroll, Demon Sigil drop, lava-tile DOT)
**Theme music vibe**: woodwind + harp, A minor aeolian
**Banner**: "TREANT ELDER — The Rooted King"

**Phase 1 (100-75%)**: Stationary. Slams adjacent tiles for 16 dmg if player walks into chebyshev 1. Regen 5 HP/turn (only when `chebyshev(boss, player) > 4` — i.e. boss heals when not engaged → forces commitment). Every 4 turns: **Root** — telegraph the player's tile + 4 orthogonal neighbors, next turn anyone standing on those tiles eats 2-turn FREEZE (status from plan 03).
**Phase 2 (75-50%)**: Adds **Vine Spread** environmental + **Wolf Summon**. Every 3 turns spawn 2 `vine` tiles within chebyshev 4 of boss — vines act as web tiles (SLOW on entry, plan 03 `state.webTiles`), ttl=20. Cap 12 vine tiles alive at once. Every 6 turns summon 1 wolf (`aiCharger` variant, HP 40 ATK 12). Cap 3 wolves.
**Phase 3 (50-25%)**: **Uproots**. Boss becomes ORTHOGONAL CRAWL mobile. Vine spread cadence drops to 2 turns. Root telegraphs now hit a 3×3 zone instead of cross.
**Phase 4 (25-0%) ENRAGED — Rage Roots**: Speed → SLOW. Root cooldown 2. Every Root cast also summons a wolf at boss's current tile. Regen drops to 0 (no more heal — pure offense).

**Counterplay**: Force range > 4 → boss can't heal. Burn vine clusters with fire. Save fire scrolls for ×1.5 damage windows. Save freeze potion for "Root telegraph predicted on me" turns.
**Drop**: Legendary accessory "Treant Seed" (regen 3 HP/turn out of combat, immune SLOW, immune FREEZE). +50 XP. +1 reroll.

---

### F10 — Ancient Dragon (The Last Geas) 🐉

**Biome**: Lair
**Stats**: HP 600, ATK 24, DEF 12, Speed FAST, XP 200, ai `aiAncientDragon`
**Movement**: OMNIDIRECTIONAL ground; FLIGHT phase = teleport-style (see P3)
**Immunity**: FREEZE, STUN (apex predator — no CC)
**Theme music vibe**: full orchestra, D minor → D major on phase shift
**Banner**: "ANCIENT DRAGON — The Last Geas"

**Phase 1 (100-75%)**: Cone breath (existing `aiDragon` mechanic — range 5, 8 dmg, cooldown 3). Telegraph the cone tiles 1 turn before fire. Melee 24 dmg adjacent.
**Phase 2 (75-50%)**: Adds **Wing Slam** — every 5 turns, telegraph all 8 chebyshev-1 tiles, next turn 18 dmg + 2-tile knockback (further than Golem King). Spawns 2 Wyrm Hatchlings (existing biome mob from `lair` pool) at boss corners on phase entry.
**Phase 3 (50-25%) — Flight Phase**: Boss leaves the ground. Visual: shadow flits across the arena, dragon emoji floats above ceiling glyph. Mechanically: dragon is **untargetable for 2 turns**, then **dives** — telegraphs a 2-tile-radius landing zone for 1 turn, lands for 30 dmg AoE, restarts ground phase. Flight cycle every 6 turns. Cone breath replaced with **Aerial Breath** during flight (line attack, range 8, 10 dmg, no cooldown — dragon strafes the arena). Lair floor tiles within breath line catch fire — burn DOT 4 dmg/turn for 4 turns.
**Phase 4 (25-0%) ENRAGED — Death Throes**: Speed → BLINK (already FAST → effectively two acts per cycle in plan 02 `processWorld`). Cone breath cooldown 1 (every other turn). Wing Slam cooldown 3. Burn floor lasts 8 turns instead of 4. Cannot fly anymore (grounded in panic).

**Counterplay**: Move during cone telegraph. Pre-position for flight dive (2-tile radius — keep moving). Save HP potions for P4. The 2-turn untargetable window is a free heal window for the player.
**Drop**: Legendary all-slot "Dragon Scale" (+10 ATK, +10 DEF, fire immunity, +20% dmg vs all enemies). +100 XP (double for final boss). +1 reroll. **Win condition triggers** on Dragon kill.

---

### F5 (optional) — Lava Wyrm (Tunneler of the Deep) 🔥🐍

**Biome**: Lava (mid-biome — between regular F5 and boss F6)
**Stats**: HP 220, ATK 16, DEF 6, Speed NORMAL, XP 70, ai `aiLavaWyrm`
**Movement**: TUNNEL (no normal pathing — see below)
**Immunity**: FIRE
**Theme music vibe**: short urgent loop, F# minor
**Banner**: "LAVA WYRM — Tunneler of the Deep"

**Spawn rule**: Only if v3-03 Wyrm Hatchling content pack is shipped AND player has not died on F5 in current run. Generates a smaller boss arena (10×8) with the standard F5 dungeon — Wyrm spawns mid-run, not at floor entry.

**Mechanic**: Wyrm spends most turns **submerged** (invisible, untargetable) below floor. Every 3 turns it pops up at a telegraphed tile (orange `~` glyph on target tile 1 turn before pop), deals 18 dmg AoE r1 on emergence + spits 3 fire breath cones in random ortho directions, then submerges 1 turn later. Single-phase boss (no phase progression — kill it in pop-up windows).

**Counterplay**: Stand on the telegraphed tile to "wake" it early (free 2-turn window). Burst it during pop-up (it's targetable for exactly 1 turn between emerge and submerge).
**Drop**: Rare weapon "Wyrm Tooth" (+4 ATK, fire on hit). +30 XP. No reroll (mid-boss, not full boss).

Note: All optional/conditional — if Wyrm Hatchling pack ships post-v3-03, we can include this. Otherwise mark as **post-v3-05 stretch goal**.

---

## Boss mechanic catalog

| Mechanic | Used by | Telegraph? | Implementation hook |
|---|---|---|---|
| Telegraphed AoE (cross) | Crypt Lord, Treant Elder | Yes (1 turn) | `enemy.telegraphedTiles: Set<key>` + `telegraphTicksLeft` |
| Telegraphed AoE (radial) | Golem King (Slam), Demon Lord (Hellrain), Dragon (Wing Slam, Dive) | Yes (1 turn) | same |
| Cone breath (line) | Dragon (Aerial Breath), Lava Wyrm | Yes (1 turn) | `coneTiles(origin, dir, range)` from plan 03 |
| Summon | Crypt Lord (skeleton), Demon Lord (imp), Treant Elder (wolf) | No (instant) | `summonCooldown` per boss; cap via `state.bossMinions[bossKey]` |
| Heal-while-disengaged | Treant Elder | n/a | `if (chebyshev(boss, player) > 4) boss.hp += 5` |
| Out-of-combat regen | All bosses | n/a | If boss's `lastDamagedTick + 30 < state.worldTick` → +10 HP/tick (caps at 100% HP) |
| Teleport | Demon Lord | No (P1), 1-turn shadow telegraph (P4) | `randomFloorTileNear(player, r=3)` |
| Flight (untargetable) | Dragon | Yes (entry shadow + landing telegraph) | `boss.flying:true` skips `attackEnemy` resolution |
| Environmental change (cracks) | Golem King | n/a | Per-tile flag `state.crackedTiles: Set<key>` |
| Environmental change (vines) | Treant Elder | n/a | Reuse plan 03 `state.webTiles[]` |
| Environmental change (burn floor) | Dragon (P3+) | n/a | `state.burningTiles: [{x,y,ttl}]` |
| Knockback | Golem King, Dragon Wing Slam | yes (telegraph) | New helper `knockback(player, dir, tiles)` |
| XP Drain on hit | Crypt Lord (P3+) | No | Extends plan 03 `xpdrainer` AI to bosses |
| Rage / Enrage at 25% | All 5 bosses | Banner cue + screen shake | `phase === 4` branch in AI |
| Status immunities | Each boss has 1-2 (BLEED/POISON/FIRE/FREEZE/STUN) | n/a | Reuse `def.immune:[]` from plan 03 |

## Boss arena spec

All boss arenas share base rules:
- **Lighting**: `lit:true`, always (per biomes-system §4.2). Player sees the entire arena from entry.
- **Size**: minimum 12×10 (oversized vs `ROOM_MAX` standard rooms).
- **Spawn**: Player at south-edge entry tile (where stair-corridor exits into arena). Boss at geometric center. Minions at 4 corners (or 2 corners for low-minion bosses).
- **Lock-in**: On player entering arena, the entry tile transforms to a `BOSS_GATE` tile (impassable both ways) until boss dies. Visual: pulsing red glyph. `state.bossArenaLocked = true`.
- **Lit-gold stairs**: After boss death, stairs-down spawn at boss's death tile (or center if boss died offscreen during flight). Stairs visually have a gold halo.

Per-biome features:

| Biome | Boss | Arena size | Layout features | Special tiles |
|---|---|---|---|---|
| Crypt | Crypt Lord | 12×10 | 4 stone pillars in cross pattern (cover for ranged, 1×1 each) | Pillars block LoS but not movement around them |
| Cave | Golem King | 14×10 | 2 stalactite columns (drop on player every 8 turns — 6 dmg AoE r1, telegraphed 2 turns) | Cracked tiles spawn during fight |
| Lava | Demon Lord | 13×11 | 2 lava channels (1-tile-wide trenches, instant 8 dmg + 1-turn FIRE if stepped on) | Hellrain markers + smoldering tiles |
| Forest | Treant Elder | 12×12 | 4 living trees in corners (act as vine-spread anchors, can be destroyed for 30 dmg → strips boss vine spawn rate) | Vine tiles ↔ web tiles |
| Lair | Dragon | 16×12 | High ceiling glyph (visual only — enables flight phase). Central raised platform (cosmetic gold) | Burning tiles after Aerial Breath |

Arena generation injection point: extend the existing biomes-system §12 algorithm in `generateDungeon` (around `index.html:2023`). After standard dungeon pass, on even floors find largest room, force-grow to ≥12×10 by extending into adjacent walls, mark `lit:true`, set `room.boss = true, room.bossKey = BIOMES[i].boss.key, room.features = [...]`. Standard `populateFloor` skips boss rooms; a separate `populateBossRoom(room, biome)` handles spawn placement + arena features.

## Cinematic spec

### Boss intro (on first player entry to arena)

Trigger: player steps onto arena entry tile for the first time on this floor.

Sequence (total: 2.0 seconds, blocks input):
1. **t=0.0s**: Camera glides over 0.6s from player position to boss center (linear ease). Game logic frozen.
2. **t=0.6s**: Background dim overlay fades in to alpha 0.6 over 0.2s. Player + minion sprites also dim.
3. **t=0.8s**: Boss sprite scales 1.0 → 1.4 → 1.0 over 0.4s (pulse). Banner div drops in from top: large dramatic font (`UnifrakturMaguntia` or system fallback `serif`), text = `BOSS_NAMES[bossKey]` (e.g. "CRYPT LORD — Warden of the Forgotten"). Subtitle in smaller italic: biome flavor line.
4. **t=1.2s**: Boss "intro roar" — emoji-based particle burst from boss tile (skull/fire/leaves/etc per biome). Optional one-shot SFX hook (no-op stub today).
5. **t=1.6s**: Banner fades out over 0.4s. Camera glides back to player.
6. **t=2.0s**: Input unlocked. Music has crossfaded to boss theme during steps 2-5.

Skip rule: pressing any movement key during intro skips remaining frames (jumps to t=2.0).

### Mid-fight cues

- **Phase transition** (75%, 50%, 25%): screen flash (single frame, white alpha 0.3), small banner top-center for 1.5s ("PHASE 2", "DESPERATE"). Phase-specific particle burst from boss tile (e.g. P2 entry = bones erupt, P3 entry = fire ring).
- **ENRAGED phase 4 entry**: Stronger cue. Screen shake 0.5s (camera jitter ±2 px). Banner: "ENRAGED" red text, full-width, 2-second hold. Boss sprite gains red outline filter for the rest of the fight.
- **Telegraphed AoE**: Red `⚠` glyph overlay on each telegraphed tile, pulsing alpha (sin(t)). 1-turn warning. On detonation: white flash on those tiles + impact particles.
- **Summons spawn**: Small particle burst at spawn tile (skeleton = bone shards, imp = fire, wolf = leaves+howl-glyph).

### Boss death

Sequence (total: 2.0 seconds, logic frozen):
1. **t=0.0s**: Boss sprite freezes. All AI ticks pause. Particle storm — biome-themed burst from boss tile (Crypt = bone+dust, Cave = rock chunks, Lava = embers, Forest = leaves+sparks, Lair = gold flecks + fire).
2. **t=0.5s**: Boss sprite alpha fades 1.0 → 0.0 over 1.0s. Sprite scales 1.0 → 1.6 during fade.
3. **t=1.5s**: Drop spawn animation — Legendary item glyph "rises" from death tile (fades in + drifts up 0.5 tiles), then settles on tile. Stairs-down glyph appears with gold halo.
4. **t=2.0s**: `state.bossArenaLocked = false`, BOSS_GATE tile reverts to corridor. Logic resumes. Boss kill banner: "VICTORY — CRYPT LORD SLAIN" 2-second hold (non-blocking — input enabled during it).

If boss died during dragon flight phase (untargetable becoming targetable mid-dive), spawn drop at the dive landing tile.

## AI implementation

### State per boss instance

```js
{
  ...standardEnemyFields,        // hp, x, y, atk, def, etc.
  isBoss: true,
  bossKey: 'crypt_lord',         // or 'golem_king', 'demon_lord', 'treant_elder', 'ancient_dragon', 'lava_wyrm'
  phase: 1,                      // 1..4
  cooldowns: {                   // ability-specific countdowns, decrement per boss act
    summon: 0,
    aoe: 0,
    teleport: 0,
    breath: 0,
    flight: 0,
    boulder: 0,
    root: 0,
    slam: 0,
  },
  telegraphedTiles: [],          // [{x,y,ability:'spike',ticksLeft:1}]
  flying: false,                 // dragon only
  vinesSpawned: 0,               // treant — for cap
  minionsAlive: [],              // refs to active minions
  lastDamagedTick: 0,            // for out-of-combat regen
  enraged: false,                // P4 latch (one-way)
  introPlayed: false,            // ensures intro fires once
}
```

Persist all of these in save/load (see plan 03 `enterFloor` reset semantics).

### AI_REGISTRY entries (plan 03 extension)

```js
const AI_REGISTRY = {
  // ...existing 15 entries from plan 03
  cryptLord:    aiCryptLord,
  golemKing:    aiGolemKing,
  demonLord:    aiDemonLord,
  treantElder:  aiTreantElder,
  ancientDragon: aiAncientDragon,
  lavaWyrm:     aiLavaWyrm,    // optional
};
```

### State machine pseudocode (per boss — abbreviated for Crypt Lord; pattern is same)

```
function aiCryptLord(e):
  // 0. Phase resolution — recompute every tick
  if (e.hp / e.maxHp <= 0.25 && !e.enraged) { enterPhase(e, 4); enrageBanner(); }
  else if (e.hp / e.maxHp <= 0.50 && e.phase < 3) enterPhase(e, 3);
  else if (e.hp / e.maxHp <= 0.75 && e.phase < 2) enterPhase(e, 2);

  // 1. Resolve telegraphed abilities first (the "fire on next turn" leg)
  resolveTelegraphedAbilities(e);   // damages player on tiles, clears Set

  // 2. Cooldowns tick
  for k in e.cooldowns: e.cooldowns[k] = max(0, e.cooldowns[k] - 1);

  // 3. Phase-gated ability priority
  if (e.phase >= 2 && e.cooldowns.aoe == 0) { telegraphBoneSpike(e, player); e.cooldowns.aoe = (e.phase==4 ? 2 : 4); return; }
  if (e.phase >= 1 && e.cooldowns.summon == 0 && e.minionsAlive.length < 3) {
    summonSkeleton(e); e.cooldowns.summon = (e.phase==4 ? 1 : 5); return;
  }

  // 4. Standard chase + attack
  if (chebyshev(e, player) <= 1) {
    attack(e, player);  // uses ATK 12; phase>=3 also drains XP
  } else {
    stepTowardWithPattern(e, player, ORTHOGONAL);
  }

function enterPhase(e, p):
  e.phase = p;
  if (p == 4) e.enraged = true;
  triggerPhaseTransitionVFX(e, p);
  // boss-specific phase entry hooks (e.g. demonLord summons 2 imps on P3 entry)
```

Same skeleton for other 5 bosses — only the ability list and cooldowns differ. Anti-cheese: `accelerateAfterTimeout` — if the fight has lasted >30 boss-turns, halve all cooldowns (covers "player kites forever").

### Helpers (extend plan 03)

| Helper | Sig | Purpose |
|---|---|---|
| `telegraphTiles(e, tiles, ability, ticks=1)` | (boss, [{x,y}], string, int) | adds glyphs, queues damage resolution next turn |
| `resolveTelegraphedAbilities(e)` | (boss) | for each tile in `e.telegraphedTiles` with `ticksLeft==0`, deal damage if player on tile, clear |
| `summon(boss, defKey, opts)` | spawns minion at empty neighbor of boss; pushes to `boss.minionsAlive` |
| `knockback(target, dir, tiles)` | moves entity `tiles` in `dir`, stops on wall/enemy |
| `dropLegendary(boss)` | reads `BOSS_DROPS[boss.bossKey]`, places item at boss tile |
| `triggerPhaseVFX(boss, phase)` | emits particle storm + banner + camera flash |
| `bossOutOfCombatRegen(boss)` | if `state.worldTick - boss.lastDamagedTick > 30` and player not in same room → boss.hp += 10 |
| `accelerateBoss(boss)` | called after 30 boss-turns from intro: halves all cooldowns one-time |

## Reward structure

Drop table on boss kill:

| Boss | Legendary item | XP | Reroll | Achievement (future) | Stairs-down? |
|---|---|---|---|---|---|
| Crypt Lord | Crypt Plate (armor) | 50 | +1 next draft | `slay_crypt_lord` | yes (gold-lit) |
| Golem King | Heart of Stone (weapon) | 50 | +1 | `slay_golem_king` | yes |
| Demon Lord | Demon Sigil (3-charge AoE scroll) | 50 | +1 | `slay_demon_lord` | yes |
| Treant Elder | Treant Seed (accessory) | 50 | +1 | `slay_treant_elder` | yes |
| Ancient Dragon | Dragon Scale (universal +ATK/+DEF/fire-imm) | 100 | +1 | `slay_dragon` (= win) | n/a — win |
| Lava Wyrm (opt) | Wyrm Tooth (rare weapon) | 30 | none | `slay_wyrm` | no — mid-floor |

Pity bonus from biomes-system §4.2 still applies on top: if `bossesSlain >= 3` and last 2 floors had no Legendary, next non-boss drop is force-Legendary.

## Difficulty tuning curve

| Floor | Boss | HP | ATK | DEF | Speed | Player avg HP at floor | Player TTK target | Player TTD target |
|---|---|---|---|---|---|---|---|---|
| 2 | Crypt Lord | 100 | 12 | 6 | NORMAL | 24 (lvl 1-2) | 8-10 turns | 4-5 hits at 2 DEF (~6 turns) |
| 4 | Golem King | 180 | 14 | 10 | CRAWL | 36 (lvl 3) | 10-12 turns | 5-6 hits at 4 DEF (~8 turns) |
| 6 | Demon Lord | 280 | 18 | 8 | NORMAL | 50 (lvl 5) | 12-14 turns | 4-5 hits at 6 DEF (~7 turns) |
| 8 | Treant Elder | 400 | 16 | 10 | CRAWL | 70 (lvl 7) | 12-15 turns | 5-6 hits at 8 DEF (~9 turns) |
| 10 | Ancient Dragon | 600 | 24 | 12 | FAST | 100 (lvl 9-10) | 15 turns | 5 hits at 10 DEF (~10 turns) |

ATK scales linearly: 12 → 14 → 18 (+ phase damage spikes) → 16 → 24. Player-side scaling assumes plan 03 per-floor enemy scaling + plan 05 leveling.

Phase contribution to TTK: P1+P2 ≈ 50% of total TTK (5-8 turns avg), P3+P4 ≈ 50% (3-7 turns avg). Players who reach P4 with full HP usually finish in 3-4 turns.

Failure-mode tuning: if a boss is killing >50% of players who reach it (analytics future), nerf options ranked: (1) extend telegraph window 1→2 turns, (2) reduce P4 cooldown halving to 0.66x, (3) reduce ATK by 2.

## Data schema additions

```js
// state-level
state.currentBoss = null;          // ref to boss enemy or null
state.bossArenaLocked = false;     // input gating; door reopens on death
state.bossArenaRoom = null;        // ref to room object (for arena bounds)
state.crackedTiles = new Set();    // "x,y" keys (Cave biome boss only)
state.burningTiles = [];           // [{x,y,ttl,dmg}] (Lair boss only)
state.bossKills = {                // for achievements + pity + analytics
  crypt_lord: 0,
  golem_king: 0,
  demon_lord: 0,
  treant_elder: 0,
  ancient_dragon: 0,
  lava_wyrm: 0,
};
state.bossIntroPlayed = {};        // {bossKey: true} per run

// per-boss enemy fields (extends plan 03 enemy instance)
{
  isBoss: true, bossKey, phase, cooldowns, telegraphedTiles,
  flying, vinesSpawned, minionsAlive, lastDamagedTick, enraged, introPlayed,
}

// constants
const BOSS_DEFS = [
  { key:'crypt_lord',     name:'CRYPT LORD',    subtitle:'Warden of the Forgotten',
    floor:2,  hp:100, atk:12, def:6,  speed:SPEED.NORMAL, ai:'cryptLord',
    immune:['BLEED'], drop:'crypt_plate', xpBonus:50,
    abilities:{ summon:{cd:5,limit:3,key:'skeleton'}, spike:{cd:4,unlockPhase:2}, drainXp:{unlockPhase:3,amount:5} } },
  { key:'golem_king',     name:'GOLEM KING',    subtitle:'The Mountain That Walks',
    floor:4,  hp:180, atk:14, def:10, speed:SPEED.CRAWL,  ai:'golemKing',
    immune:['POISON'], drop:'heart_of_stone', xpBonus:50,
    abilities:{ slam:{cd:4}, boulder:{cd:3,unlockPhase:2,range:6}, crack:{unlockPhase:3} } },
  { key:'demon_lord',     name:'DEMON LORD',    subtitle:'Sovereign of Hellrain',
    floor:6,  hp:280, atk:18, def:8,  speed:SPEED.NORMAL, ai:'demonLord',
    immune:['FIRE'], drop:'demon_sigil', xpBonus:50,
    abilities:{ teleport:{cd:6}, hellrain:{cd:4,unlockPhase:2,markers:5}, summon:{cd:5,unlockPhase:3,key:'imp',limit:4}, aura:{unlockPhase:3} } },
  { key:'treant_elder',   name:'TREANT ELDER',  subtitle:'The Rooted King',
    floor:8,  hp:400, atk:16, def:10, speed:SPEED.CRAWL,  ai:'treantElder',
    immune:['BLEED'], weakTo:['FIRE',1.5], drop:'treant_seed', xpBonus:50,
    abilities:{ root:{cd:4}, regen:{amount:5,whileDistant:4}, vines:{cd:3,unlockPhase:2,limit:12}, summon:{cd:6,unlockPhase:2,key:'wolf',limit:3}, uproot:{unlockPhase:3} } },
  { key:'ancient_dragon', name:'ANCIENT DRAGON',subtitle:'The Last Geas',
    floor:10, hp:600, atk:24, def:12, speed:SPEED.FAST,   ai:'ancientDragon',
    immune:['FREEZE','STUN'], drop:'dragon_scale', xpBonus:100, isWinCondition:true,
    abilities:{ breath:{cd:3,range:5}, wingSlam:{cd:5,unlockPhase:2,knockback:2}, flight:{cd:6,unlockPhase:3}, burn:{unlockPhase:3,ttl:4} } },
];

const BOSS_DROPS = {
  crypt_plate:    { id:'crypt_plate', tier:'legendary', slot:'armor', stats:{def:8, maxHp:20}, immunities:['DRAIN_XP'] },
  heart_of_stone: { id:'heart_of_stone', tier:'legendary', slot:'weapon', stats:{atk:6, def:5}, special:'knockback' },
  demon_sigil:    { id:'demon_sigil', tier:'legendary', slot:'scroll', charges:3, effect:'aoe_fire_r3_ignoreDef' },
  treant_seed:    { id:'treant_seed', tier:'legendary', slot:'accessory', stats:{regen:3}, immunities:['SLOW','FREEZE'] },
  dragon_scale:   { id:'dragon_scale', tier:'legendary', slot:'universal', stats:{atk:10, def:10}, immunities:['FIRE'], dmgMult:1.2 },
};
```

## Implementation file:line

(Line numbers reference current `index.html` per CLAUDE.md, may shift as v3 lands.)

| File / location | What |
|---|---|
| `index.html:1001-1018` (`ENEMY_DEFS`) | Add 5-6 boss entries with `isBoss:true` flag and the `bossKey` reference |
| `index.html` after `ENEMY_DEFS` (~line 1020) | New `const BOSS_DEFS = [...]` block (boss-specific scaffolding) |
| `index.html` near `BOSS_DEFS` | New `const BOSS_DROPS = {...}` block |
| `index.html:2023` (`generateDungeon`) | After dungeon pass, on even floors call `injectBossArena(rooms, biome)`. New helper grows largest room ≥12×10, marks `lit:true, boss:true, bossKey:biome.boss.key`. Add arena-feature placement (pillars/channels/trees per biome). |
| `index.html:2261-2310` (`populateFloor`) | Skip boss rooms in standard pop. Call new `populateBossArena(room, biome)` post-loop: spawn boss + minions, init `state.currentBoss`. Remove the existing F10 forced-dragon block (now part of boss arena flow). |
| `index.html` after `populateFloor` | New `populateBossArena(room, biome)` function. |
| `index.html:2498` (`enterFloor`) | Reset `state.crackedTiles`, `state.burningTiles`, `state.bossArenaLocked = false`, `state.currentBoss = null`. Initialize `state.bossKills` if missing. |
| `index.html:3501-3520` (`AI_REGISTRY`) | Register 5-6 new entries (`cryptLord`, `golemKing`, etc.) |
| `index.html` after AI_REGISTRY | New `aiCryptLord`, `aiGolemKing`, `aiDemonLord`, `aiTreantElder`, `aiAncientDragon`, `aiLavaWyrm` (~150-200 lines per boss state machine, can share via `aiBossPhaseGate(boss, phaseAbilityFns)` helper) |
| `index.html` AI helpers section | Add `telegraphTiles`, `resolveTelegraphedAbilities`, `summon`, `knockback`, `dropLegendary`, `triggerPhaseVFX`, `bossOutOfCombatRegen`, `accelerateBoss` |
| Render section (~line 1280, plan 03 ref) | Render telegraphed tiles (red `⚠` glyph w/ pulsing alpha), cracked tiles (dark fracture overlay), burning tiles (small fire glyph), arena gate (pulsing red glyph) |
| Render section after enemies | Boss intro overlay (HTML div, Z-index above canvas), phase-transition banners, ENRAGED banner, victory banner — reuse biomes-system §12 banner CSS |
| `attackEnemy` (~`index.html:979`, plan 03 hook) | If `target.isBoss`, set `target.lastDamagedTick = state.worldTick` (regen tracker). On kill: call `dropLegendary(target)`, increment `state.bossKills[target.bossKey]`, trigger death cinematic, unlock arena gate, spawn stairs-down with gold halo. If `bossKey === 'ancient_dragon'` → trigger win. |
| `processWorld` (plan 02 ref) | Before normal AI tick, run `bossOutOfCombatRegen` on `state.currentBoss`. After AI tick, decrement burning tiles ttl, apply DOT to player if on burning tile. |
| Player movement | If attempting to step onto BOSS_GATE tile while `bossArenaLocked`, block + log "The arena is sealed."  |
| Save/load | Persist `state.currentBoss`, `state.bossArenaLocked`, `state.crackedTiles`, `state.burningTiles`, `state.bossKills`, all per-boss state fields (phase, cooldowns, telegraphedTiles, etc.) |

## Edge cases

1. **Player runs around forever / kites with bow**: After 30 boss-turns from intro (`state.worldTick - boss.introTick >= 30`), call `accelerateBoss(boss)` once — halves all cooldowns permanently for this fight. Stronger fallback (60 turns): boss spawns adds every turn at cap. Crypt Lord summons archers (skeleton variant with `aiThrower`), Demon Lord teleports onto player every 2 turns.

2. **Player blink-scrolls out of arena**: Blink scroll target validation now rejects targets outside arena bounds when `bossArenaLocked=true`. Falls back to closest valid tile inside arena. Logged: "Something blocks the blink."

3. **Player saves boss for later (descends partial-HP boss)**: Cannot — arena is locked until kill. If player walks back into arena room from a side tile (shouldn't be possible, but defensive): boss heals to full and resets phase to 1.

4. **Boss heals out-of-combat**: If player has not damaged boss for 30 ticks AND player not in same room → boss regens 10 HP/tick up to max. Stops the moment player re-enters chebyshev 6 of boss.

5. **Boss in tile blocked by trap**: All bosses are immune to trap effects (POISON_VENT, SPIKE, EXPLOSIVE, ALARM, PIT). They walk over traps without triggering. Cracked-tile DOT (Golem King environmental) does not affect the Golem King itself.

6. **Save/load mid-boss**: All per-boss fields (phase, cooldowns, telegraphedTiles, minionsAlive refs by id, flying, vinesSpawned, lastDamagedTick, enraged) are serialized. On load: re-resolve `state.currentBoss` ref by id, re-show ENRAGED banner if `enraged && hp < maxHp`, restore arena gate render.

7. **Player one-shots boss in P1**: All phase transitions fire on damage. If a single hit takes boss from 90% to 10%, fire all transition cinematics in sequence (P2 → P3 → P4 → death) over ~1.5s, then death cinematic. Avoids "skipped phases" feeling cheap.

8. **Player dies during phase transition**: Death animation overrides; phase VFX skipped.

9. **Minions outlive boss**: On boss death, all minions spawned by it instantly die (visual: each pops into a small dust burst). Prevents trivial XP farm post-fight.

10. **Boss killed by trap (e.g. Demon Lord lured into Lava Channel)**: Bosses immune to environmental hazards (per #5). Player cannot exploit arena features against the boss (lava channels harm player only; stalactites only target player; trees can be destroyed by player to nerf vines but never deal damage to Treant). Telegraph clarity > exploit creativity.

11. **F10 Dragon mid-flight when player runs out of HP-potion options**: Flight phase 2-turn untargetable window is intentional design — player should use it to heal. If player has no heals and is below 30 HP, the dive (30 dmg) likely kills them. This is acceptable lethality at floor 10.

12. **Multiple bosses on same floor (e.g. F5 Lava Wyrm + F6 Demon Lord adjacency)**: Wyrm is on F5 (regular floor with mid-boss), Demon Lord is on F6 (dedicated boss arena). They never coexist. Wyrm encounter must be resolved before player can take stairs to F6 (its mini-arena locks the room until kill, like full bosses).

13. **Boss arena door not adjacent to dungeon — generation degenerate case**: If `injectBossArena` cannot find a room large enough to grow to 12×10, fall back: replace the largest room entirely with a hand-crafted 12×10 boss room (overwrites map tiles). Worst-case fallback only.

14. **Player takes a phase-transition hit at exactly 50% HP**: Use strict `<` for phase thresholds to avoid double-fire on edge values. `if (hp/maxHp <= 0.50 && phase < 3) → enterPhase(3)`. The `< 3` guard ensures phase only advances forward.

## Acceptance criteria

- [ ] 1. 6 (or 5 if Wyrm post-poned) bosses spawn deterministically: Crypt Lord on F2, Golem King on F4, Demon Lord on F6, Treant Elder on F8, Ancient Dragon on F10.
- [ ] 2. Each boss has 4 phases gated at HP thresholds 100/75/50/25%. Phase transitions are visually telegraphed (banner + particles).
- [ ] 3. Each boss has at least 1 telegraphed AoE attack with a 1-turn warning that visibly highlights the danger tiles.
- [ ] 4. Boss arena is locked on entry (player cannot leave until boss dies); arena is `lit=true` and ≥12×10 tiles.
- [ ] 5. Boss intro plays once per arena entry: 2-second cinematic with name banner, camera pan, boss pulse. Skippable on input.
- [ ] 6. Each boss drops a Legendary item (specific to that boss), gives +50 XP (+100 for Dragon), and grants +1 reroll on next draft.
- [ ] 7. Boss AI does not crash in edge cases: kiting (>30 turns triggers acceleration), savescum (full state persists), player blocked from leaving (validated), multi-phase rapid HP loss (fires phases in sequence).
- [ ] 8. Player TTK (time-to-kill) on average run is 8-15 turns per boss, measured across 10 internal playtests at intended player level (no overlevel).
- [ ] 9. Player TTD (time-to-die) when greedy is 4-6 boss turns (3-5 hits at avg DEF for that floor). Bosses don't one-shot a careful player at full HP.
- [ ] 10. Save / load mid-fight preserves: `phase`, `cooldowns`, `telegraphedTiles`, `minionsAlive`, `enraged`, `flying`, environmental tiles (cracked/burning), arena lock state.
- [ ] 11. ENRAGED phase 4 fires once with screen shake + red banner; boss visually gains red outline for the rest of the fight.
- [ ] 12. Boss death cinematic plays (2-second freeze + particle storm + Legendary drop animation + stairs reveal).
- [ ] 13. Bosses are immune to traps and arena hazards. No player exploit reduces boss HP via environment.
- [ ] 14. F10 Dragon kill triggers existing win condition (no regression vs. current behavior).
- [ ] 15. Pity bonus from biomes-system §4.2 still triggers correctly post-boss-rework (regression test).
- [ ] 16. Achievement hooks (`state.bossKills[bossKey]++`) increment exactly once per kill, even on phase-skip rapid kills.

## Estimated effort

| Phase | Scope | Effort |
|---|---|---|
| 1 | `BOSS_DEFS` + `BOSS_DROPS` data, scaffolding | 0.5 day |
| 2 | Arena generation (`injectBossArena`, `populateBossArena`, arena lock) | 1 day |
| 3 | Telegraph system (helpers + render glyphs + resolve damage) | 1 day |
| 4 | AI: Crypt Lord (template for all bosses) | 1 day |
| 5 | AI: Golem King + Demon Lord (radial AoE + summons + environmental) | 1.5 days |
| 6 | AI: Treant Elder + Dragon (most complex — vines, flight, environmental) | 2 days |
| 7 | Cinematics: intro / phase / death banners + camera pan + particle bursts | 1 day |
| 8 | Drop pipeline + reroll + XP bonus + achievement hooks | 0.5 day |
| 9 | Save/load persistence for boss state | 0.5 day |
| 10 | Edge case sweep + acceptance criteria pass + balance pass | 1 day |
| **Total** | | **~10 days** (Lava Wyrm adds +0.5 day) |

Risk hotspots: (a) AI complexity creep — keep each boss <250 lines via shared helpers; (b) telegraph system must integrate cleanly with plan 02 turn engine; (c) cinematic intro blocking input must not race with player movement queue.
