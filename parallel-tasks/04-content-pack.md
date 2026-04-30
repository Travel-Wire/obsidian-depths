# Content Pack #1 — Mobs + Items
Designer: Game-Designer (CCGS) + AI-Programmer support
Target integration: index.html (ENEMY_DEFS, ITEM_DEFS, AI_REGISTRY)

## Selection rationale

Audit of current 15 mobs / 22 items reveals four content holes:

1. **No "positioning" pressure mob.** Every existing enemy is solved by raw stat-trade or one-shot card. Cave Crab forces the player to *walk around* — first time spatial play matters.
2. **No pack/swarm mechanic.** All current spawns are single-actor — Dire Wolf and Beetle Swarm cover both flavours (small pack of strong / large pack of weak).
3. **No telegraphed ranged threats.** Goblin throws (random), Wizard zaps (LoS), but nothing emits a *persistent ranged hazard*. Giant Spider's web tile and Banshee's stun fix that.
4. **No "fragile life" item axis.** All consumables heal — no max-HP growth, no revive, no risk/reward gear. Cursed Sword, Hardtack, Phoenix Vial, Mirror Shield each open a new decision axis.

Mobs picked: Cave Crab, Dire Wolf, Beetle Swarm, Burrowing Worm, Scorpion, Tentacle Wall, Wyrm Hatchling, Banshee, Giant Spider, Treant. Cut: Two-Headed Snake (already covered by Snake+Spider), Trickster Fox (engine doesn't support clones cleanly), Stag Spirit (movement-trigger AI is fragile), Harpy (Bat already flies), Zombie (DISEASE status would require new tick path — saved for Pack #2).

Items picked: Cursed Sword, Herbal Tea, Bone Armor, Throwing Stones, Mirror Shield, Eternal Candle, Hardtack, Prayer Beads, War Horn, Phoenix Vial. Cut: Star Charm (duplicate of Lucky Charm), Polymorph Potion (state corruption risk), Gold Coins (no shop yet), Dice of Fate (anti-fun variance), Quill of Wisdom (couples to card system internals).

## NEW AI Types (3)

### `caveCrab` — frontal armor
State machine:
```
state.facing in {N,E,S,W}  // enemy.facing, init = direction toward last seen player
state.turnCooldown in {0..2}  // ticks before facing can change

per turn:
  if turnCooldown > 0: turnCooldown--
  if attacker hit me this tick from behind  → set behindHitFlag
  step toward player using ORTHOGONAL pattern
  if moved: facing = move direction; turnCooldown = e.turnSpeed (default 2)
  else if turnCooldown == 0 and player not in front cone: facing = directionTo(player); turnCooldown = e.turnSpeed
```
Damage hook (in `applyDamage(target, attacker, dmg)` for enemies):
```
if target.frontDef !== undefined:
  const fromAngle = directionFromTo(target, attacker)
  const fromFront = (fromAngle == target.facing)
  effectiveDef = fromFront ? target.frontDef : target.rearDef
```
Integration: `processWorld` already drives `enemyAct(e)`; just register `caveCrab: aiCaveCrab` and read `frontDef/rearDef/facing/turnSpeed` from def.

### `swarm` — pack-spawn linker
State machine (per individual unit identical, but with shared spawn group):
```
on populateFloor: when picking a 'beetle' or 'wolf' tile, spawn N copies in adjacent floor tiles (BeetleSwarm N=5, DireWolf N=2)
  each unit gets e.packId = uniqueId
per turn:
  if any other unit with same packId is dead this turn → set e.enraged = true (atk +1 permanent, capped +2)
  step toward player using e.movementPattern (orthogonal for beetles, omni for wolves)
```
Dynamics goal: kill order matters; isolating one is risky because the survivors hit harder.
Integration: extend `populateFloor` with a small spawnGroup helper. AI is otherwise standard chase — could even alias `aiBasic` and only modify spawn + on-death hook.

### `burrower` — pop-up ambush (variant of `ambusher`)
State machine:
```
states: BURROWED → SURFACING → ACTIVE
on spawn: state = BURROWED, e.invisible = true, e.invulnerable = true
per turn:
  if BURROWED:
    if chebyshev(e, player) <= 1 and any FLOOR tile under e: → SURFACING
    else: pick adjacent FLOOR tile underground; move toward player ignoring walls/enemies (it's underground); cost = MOVE
  if SURFACING:
    e.invisible = false; e.invulnerable = false; spawn dirt-burst particles; → ACTIVE next turn (but skip current attack)
  if ACTIVE: aiMoveOrAttack(e) using ORTHOGONAL
  if e.hp drops below 50% AND state == ACTIVE AND no player adjacency:
    → BURROWED again (re-uses existing logic; e.usedReburrow guard so once per fight)
```
Reuses `vanished/invulnerable` plumbing already wired for Ghost. Counterplay = stay still (it surfaces predictably) or AoE (Fire Scroll hits even invulnerable target's tile and reveals).

## Mobs (10)

### 1. 🦀 Cave Crab
**id**: `cave_crab`
**Stats**: HP 18, ATK 6, DEF 8 frontal / DEF 0 rear, speed SLOW, XP 14
**Floor**: 3-7, weight 8
**Movement**: ORTHOGONAL
**AI**: `caveCrab` (NEW)
**Special**:
- Frontal DEF 8, rear DEF 0 — must be flanked
- Turns slowly: facing locks for 2 ticks after each move
- Immune to BLEED (chitin)
**Counterplay**: Blink Scroll behind it; corridor lure-and-pass; fast weapons let you out-step its turn lock.
**Spawn**: room tiles only (open space needed) — never corridors.

### 2. 🐺 Dire Wolf
**id**: `dire_wolf`
**Stats**: HP 14, ATK 5, DEF 1, speed FAST, XP 16
**Floor**: 4-8, weight 6 (spawns in pack of 2; weight is per-pack)
**Movement**: OMNIDIRECTIONAL
**AI**: `swarm` (NEW)
**Special**:
- Always spawns 2-pack (sometimes 3 on floor 7+)
- If pack-mate dies, survivor gains +2 ATK (enraged) for rest of run
- Pack tries to flank: second wolf prefers tile opposite player from first
**Counterplay**: AoE (Fire Scroll), corridor funneling so they can't both engage, kill the lone scout first.
**Spawn**: rooms, prefers lit-room placement.

### 3. 🪲 Beetle Swarm
**id**: `beetle`
**Stats**: HP 3, ATK 2, DEF 0, speed NORMAL, XP 2
**Floor**: 2-5, weight 5 (per swarm; 5 individuals = 1 spawn slot)
**Movement**: ORTHOGONAL
**AI**: `swarm` (NEW)
**Special**:
- Spawns in clusters of 5
- Each kill grants only 2 XP — full clear = 10 XP (lower than equivalent threat for balance)
- Cannot crit (too small to matter)
**Counterplay**: Fire Scroll wipes the room (15 dmg AoE = OHKO). War Hammer stun trivializes them.
**Spawn**: rooms, prefers food/storage flavour rooms (not yet tagged — for now any room).

### 4. 🐛 Burrowing Worm
**id**: `worm`
**Stats**: HP 12, ATK 6, DEF 1, speed NORMAL, XP 18
**Floor**: 4-9, weight 5
**Movement**: ORTHOGONAL
**AI**: `burrower` (NEW)
**Special**:
- Starts BURROWED & invulnerable; surfaces at chebyshev ≤ 1
- Skips its first attack post-surface (telegraph: tile cracks + 1-tick warn)
- Re-burrows once per fight at <50% HP if no adjacent player
**Counterplay**: stand still on a known burrow tile (you see ground crack), AoE on the warning tile, pre-emptive Throwing Stones.
**Spawn**: rooms only; prefers tiles ≥3 from walls.

### 5. 🦂 Scorpion
**id**: `scorpion`
**Stats**: HP 10, ATK 4, DEF 1, speed NORMAL, XP 16
**Floor**: 3-7, weight 7
**Movement**: ORTHOGONAL
**AI**: `scorpion` → reuse `aiCharger` with retreat extension (`retreatAfterHit:true`, `retreatTicks:2`)
**Special**:
- Melee hit applies POISON (3 ticks, 2 dmg)
- After hitting, retreats 2 tiles for 2 ticks (kite pattern)
- Immune to POISON
**Counterplay**: ranged weapons (Short Bow, Throwing Stones), Bone Armor (poison immunity), corner it so it can't retreat.
**Spawn**: corridors and rooms.

### 6. 🦑 Tentacle Wall
**id**: `tentacle_wall`
**Stats**: HP 25, ATK 7, DEF 3, speed SLOW, XP 28
**Floor**: 5-9, weight 3
**Movement**: STATIC (does not move — new flag `stationary:true`, AI returns WAIT for movement step)
**AI**: `tentacle` → reuse `aiCaster` config: `spellRange:2, fleeRange:0, meleeOnly:true`. Treat the "spell" as a 2-tile melee reach attack (no projectile travel).
**Special**:
- Cannot move — embedded in wall tile (rendered on WALL adjacency)
- Reach 2 tiles orthogonally (acts like melee through 1 empty tile)
- Cannot be flanked diagonally (only ortho-adjacent counts as engaged)
**Counterplay**: walk diagonally past at distance 2 (it can't reach diagonals), kill at range, simply skip it (no aggro pull).
**Spawn**: only on tiles adjacent to a WALL tile. Static placement during populateFloor.

### 7. 🐉 Wyrm Hatchling
**id**: `wyrm_hatchling`
**Stats**: HP 22, ATK 5, DEF 2, speed NORMAL, XP 38
**Floor**: 6-9, weight 4
**Movement**: ORTHOGONAL
**AI**: `wyrm` → reuse `aiDragon` with `breathRange:3, breathDmg:5, breathCooldown:4`
**Special**:
- Line-of-fire breath, 3 tiles, 5 dmg, cooldown 4 ticks
- Telegraphs breath 1 tick before (orange tile flash)
- Half stats of full Dragon — a "boss preview"
**Counterplay**: break LoS during cooldown windup, Mirror Shield reflects 30% of breath, Bone Armor doesn't help (fire damage).
**Spawn**: rooms only, never within 3 tiles of stairs (avoid forced engage).

### 8. 👻 Banshee
**id**: `banshee`
**Stats**: HP 14, ATK 4, DEF 0, speed NORMAL, XP 32
**Floor**: 6-10, weight 4
**Movement**: OMNIDIRECTIONAL
**AI**: `banshee` → reuse `aiCaster` with `spellRange:4, spellEffect:'stun', stunTicks:2, fleeRange:2, fireDmg:0`. Add `screamCooldown:5`.
**Special**:
- Scream stuns player for 2 ticks (uses STATUS.FREEZE) — range 4
- 5-tick cooldown between screams
- Flees at fleeRange 2 (kites)
**Counterplay**: close gap before scream (cooldown means second one is delayed), War Hammer stun cancels her cast, Eternal Candle's bonus radius lets you spot her first.
**Spawn**: rooms only, prefers larger rooms (>5 tiles wide).

### 9. 🕷️ Giant Spider
**id**: `giant_spider`
**Stats**: HP 16, ATK 5, DEF 1, speed NORMAL, XP 26
**Floor**: 4-8, weight 5
**Movement**: OMNIDIRECTIONAL
**AI**: `webShooter` → reuse `aiThrower` shape: replace projectile damage with web-tile placement. `throwRange:3, throwChance:0.5, throwDmg:0, throwEffect:'web'`
**Special**:
- 50% chance to spit web tile at player's tile (range 3)
- Web tile applies SLOW (existing STATUS.WEB plumbing) for 2 ticks
- Drops web on death (existing `webOnDeath`)
**Counterplay**: zigzag movement, Blink Scroll out of webs, Fire Scroll burns webs.
**Spawn**: rooms and corridors.

### 10. 🌳 Treant
**id**: `treant`
**Stats**: HP 40, ATK 6, DEF 4, speed CRAWL, XP 42
**Floor**: 5-9, weight 3
**Movement**: ORTHOGONAL
**AI**: `treant` → reuse `aiJuggernaut` plus per-turn regen. Add `regenPerTurn:5, regenStopBelowPct:0.2`
**Special**:
- Regenerates +5 HP per turn while above 20% HP (no regen when "wounded core" exposed)
- Immune to POISON, BLEED
- Slow but high effective HP — DPS race below 20% threshold
**Counterplay**: burst it past 20% then maintain pressure (regen disabled), Fire Scroll AoE bypasses regen window, kite past it (CRAWL speed).
**Spawn**: rooms only, never corridors. Prefers lit-room or "garden" flavour.

## Items (10)

### 1. 🪦 Cursed Sword
**id**: `cursed_sword` — slot: weapon
**Stats**: atk +8, maxDur 100, two-handed, damage type: slash
**MinFloor**: 5, weight 2
**Effect**: passive `cursedDrain` — −1 HP per player turn while equipped
**Description**: Powerful but drains life force.
**Counterplay/wadya**: Lifesteal card cancels drain (10% melee→heal offsets in active fights). Worthless out-of-combat (slow bleed during exploration).

### 2. 🌿 Herbal Tea
**id**: `herbal_tea` — slot: null (consumable)
**Stats**: heal 30, cures POISON+BLEED+FREEZE+WEB
**MinFloor**: 3, weight 4
**Effect**: `heal:30, cureStatuses:['POISON','BLEED','FREEZE','WEB']`
**Description**: Steeped in mountain herbs — restores body and clears toxins.
**Counterplay/wada**: Rare drop (weight 4 vs Health Potion's 8). Wasteful if used pre-emptively.

### 3. 🦴 Bone Armor
**id**: `bone_armor` — slot: armor
**Stats**: def +3, maxDur 60, immune POISON
**MinFloor**: 4, weight 3
**Effect**: passive `immune:['POISON']`
**Description**: Yellowed bone plates lashed with sinew — toxin won't take.
**Counterplay/wada**: −1 DEF vs Chain Mail (4). Trade raw def for poison niche. Useless on poison-free floors.

### 4. 🪨 Throwing Stones
**id**: `throwing_stones` — slot: null (consumable, stackable)
**Stats**: ranged 3 tiles, 4 dmg, stack 5, no durability
**MinFloor**: 1, weight 5
**Effect**: `effect:'throw', value:4, range:3, stackMax:5`
**Description**: A handful of sharp pebbles — better than nothing.
**Counterplay/wada**: 4 dmg < average melee weapon, scaling falls off after floor 3. Best vs Worms (interrupt surface) and Banshee (interrupt scream).

### 5. 🪞 Mirror Shield
**id**: `mirror_shield` — slot: offhand
**Stats**: def +2, maxDur 50, two-handed: false
**MinFloor**: 5, weight 2
**Effect**: passive `mirrorReflect:0.30` — 30% chance to reflect attacker's damage back at them (incl. ranged & breath)
**Description**: Polished obsidian — sometimes hate bounces back.
**Counterplay/wada**: −1 maxDur vs Kite Shield (50 vs 60), no block chance — pure reflect RNG. Useless if you never get hit.

### 6. 🕯️ Eternal Candle
**id**: `eternal_candle` — slot: offhand
**Stats**: def 0, NO durability (passive lit)
**MinFloor**: 3, weight 2
**Effect**: passive `lanternBonus:2` (vision radius +2)
**Description**: A candle that never burns down — its light feels watchful.
**Counterplay/wada**: zero defensive value (def 0). Hard tradeoff vs Mirror Shield/Kite Shield. Vision pays off only if you actually scout, not if you rush stairs.

### 7. 🥖 Hardtack
**id**: `hardtack` — slot: null (consumable, stackable, finite total)
**Stats**: +5 max HP permanent, max 3 uses per run
**MinFloor**: 2, weight 3
**Effect**: `effect:'maxHpPermanent', value:5, runLimit:3`
**Description**: Tough biscuit. Each bite hardens you a little — three is your stomach's limit.
**Counterplay/wada**: Soft cap (3/run) prevents stacking abuse. No instant heal — pure scaling buy. Skipping it for early Vigor card may be better.

### 8. 📿 Prayer Beads
**id**: `prayer_beads` — slot: accessory
**Stats**: 0 atk / 0 def, no durability
**MinFloor**: 3, weight 3
**Effect**: passive `regenEvery:5, regenAmount:1` — +1 HP every 5 player turns
**Description**: Smooth beads worn into a groove — calm focus restores you slowly.
**Counterplay/wada**: Useless in burst combat (only ticks every 5). Competes with Silver Ring (+1/+1) which strictly wins for combat builds.

### 9. 🎺 War Horn
**id**: `war_horn` — slot: null (consumable, single-use)
**Stats**: panics enemies in radius 3 for 5 turns
**MinFloor**: 4, weight 2
**Effect**: `effect:'panic', radius:3, ticks:5` — affected enemies switch to flee mode (existing `aiCoward` flee logic)
**Description**: Brass horn whose blast curdles courage.
**Counterplay/wada**: Doesn't damage. Wasted on Stationary mobs (Tentacle Wall) and Burrowed Worms. Essentially a panic-button vs Dire Wolf packs.

### 10. 🔥 Phoenix Vial
**id**: `phoenix_vial` — slot: null (consumable, auto-trigger on death)
**Stats**: revive once at 50% maxHp; consumed automatically
**MinFloor**: 7, weight 1
**Effect**: `effect:'phoenixRevive', autoTrigger:'onDeath', healPct:0.50`
**Description**: A glowing vial — the moment you fall, ash takes wing.
**Counterplay/wada**: Single-use, very rare (weight 1, floor 7+ only). Doesn't prevent the killing blow's status (still poisoned/bleeding on revive — could re-die fast). Worthless if you have no inventory slot when it would drop.

## JS-ready data tables (copy-paste blocks)

### ENEMY_DEFS additions
```js
// Append to existing ENEMY_DEFS array (after dragon line)
{ key:'cave_crab',     emoji:'🦀',  name:'Cave Crab',      ch:'C', color:'#fb923c', hp:18, atk:6, def:0, xp:14, minFloor:3, floor:[3,7],  weight:8, speed:SPEED.SLOW,   movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'caveCrab',   frontDef:8, rearDef:0, turnSpeed:2, immune:['BLEED'], spawnIn:'room' },
{ key:'dire_wolf',     emoji:'🐺',  name:'Dire Wolf',      ch:'w', color:'#a3a3a3', hp:14, atk:5, def:1, xp:16, minFloor:4, floor:[4,8],  weight:6, speed:SPEED.FAST,   movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'swarm',      packSize:2, packEnrageBonus:2, spawnIn:'room' },
{ key:'beetle',        emoji:'🪲',  name:'Beetle',         ch:'B', color:'#65a30d', hp:3,  atk:2, def:0, xp:2,  minFloor:2, floor:[2,5],  weight:5, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'swarm',      packSize:5, noCrit:true, spawnIn:'room' },
{ key:'worm',          emoji:'🐛',  name:'Burrowing Worm', ch:'q', color:'#a16207', hp:12, atk:6, def:1, xp:18, minFloor:4, floor:[4,9],  weight:5, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'burrower',   surfaceRange:1, reburrowBelow:0.5, spawnIn:'room' },
{ key:'scorpion',      emoji:'🦂',  name:'Scorpion',       ch:'p', color:'#ca8a04', hp:10, atk:4, def:1, xp:16, minFloor:3, floor:[3,7],  weight:7, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'charger',    chargeRange:2, retreatAfterHit:true, retreatTicks:2, poison:{ticks:3,dmg:2}, immune:['POISON'] },
{ key:'tentacle_wall', emoji:'🦑',  name:'Tentacle Wall',  ch:'T', color:'#7c3aed', hp:25, atk:7, def:3, xp:28, minFloor:5, floor:[5,9],  weight:3, speed:SPEED.SLOW,   movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'caster',     stationary:true, spellRange:2, fleeRange:0, meleeOnly:true, fireDmg:0, spawnIn:'wallAdjacent' },
{ key:'wyrm_hatchling',emoji:'🐉',  name:'Wyrm Hatchling', ch:'y', color:'#dc2626', hp:22, atk:5, def:2, xp:38, minFloor:6, floor:[6,9],  weight:4, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'dragon',     breathRange:3, breathDmg:5, breathCooldown:4, spawnIn:'room' },
{ key:'banshee',       emoji:'😱',  name:'Banshee',        ch:'h', color:'#e0e7ff', hp:14, atk:4, def:0, xp:32, minFloor:6, floor:[6,10], weight:4, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'caster',     spellRange:4, fleeRange:2, freezeTicks:2, fireDmg:0, screamCooldown:5, spawnIn:'room' },
{ key:'giant_spider',  emoji:'🕸️', name:'Giant Spider',   ch:'X', color:'#7e22ce', hp:16, atk:5, def:1, xp:26, minFloor:4, floor:[4,8],  weight:5, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'thrower',    throwRange:3, throwChance:0.5, throwDmg:0, throwEffect:'web', webOnDeath:true },
{ key:'treant',        emoji:'🌳',  name:'Treant',         ch:'t', color:'#15803d', hp:40, atk:6, def:4, xp:42, minFloor:5, floor:[5,9],  weight:3, speed:SPEED.CRAWL,  movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'juggernaut', regenPerTurn:5, regenStopBelowPct:0.2, immune:['POISON','BLEED'], spawnIn:'room' },
```

### ITEM_DEFS additions
```js
// Append to existing ITEM_DEFS array
{ id:'cursed_sword',   name:'Cursed Sword',    emoji:'🪦', color:'#7c2d12', type:'weapon',    slot:'weapon',    atk:8, maxDur:100, twoHanded:true, minFloor:5, weight:2, effectPassive:'cursedDrain', damageType:'slash' },
{ id:'herbal_tea',     name:'Herbal Tea',      emoji:'🌿', color:'#16a34a', type:'potion',    slot:null,        effect:'heal',  value:30, cureStatuses:['POISON','BLEED','FREEZE','WEB'], minFloor:3, weight:4 },
{ id:'bone_armor',     name:'Bone Armor',      emoji:'🦴', color:'#fde68a', type:'armor',     slot:'armor',     def:3, maxDur:60, minFloor:4, weight:3, immune:['POISON'] },
{ id:'throwing_stones',name:'Throwing Stones', emoji:'🪨', color:'#737373', type:'consumable',slot:null,        effect:'throw', value:4, range:3, stackMax:5, minFloor:1, weight:5 },
{ id:'mirror_shield',  name:'Mirror Shield',   emoji:'🪞', color:'#cffafe', type:'offhand',   slot:'offhand',   def:2, maxDur:50, minFloor:5, weight:2, effectPassive:'mirrorReflect', reflectChance:0.30 },
{ id:'eternal_candle', name:'Eternal Candle',  emoji:'🕯️', color:'#fbbf24', type:'offhand',   slot:'offhand',   def:0, minFloor:3, weight:2, lanternBonus:2 },
{ id:'hardtack',       name:'Hardtack',        emoji:'🥖', color:'#a16207', type:'consumable',slot:null,        effect:'maxHpPermanent', value:5, runLimit:3, minFloor:2, weight:3 },
{ id:'prayer_beads',   name:'Prayer Beads',    emoji:'📿', color:'#fde68a', type:'accessory', slot:'accessory', minFloor:3, weight:3, effectPassive:'slowRegen', regenEvery:5, regenAmount:1 },
{ id:'war_horn',       name:'War Horn',        emoji:'🎺', color:'#ca8a04', type:'consumable',slot:null,        effect:'panic', radius:3, ticks:5, minFloor:4, weight:2 },
{ id:'phoenix_vial',   name:'Phoenix Vial',    emoji:'🔥', color:'#fb923c', type:'consumable',slot:null,        effect:'phoenixRevive', autoTrigger:'onDeath', healPct:0.50, minFloor:7, weight:1 },
```

### AI_REGISTRY additions
```js
// Add to AI_REGISTRY object
caveCrab:  aiCaveCrab,
swarm:     aiSwarm,
burrower:  aiBurrower,

// Implementations (sketch — full logic in respective sections above)
function aiCaveCrab(e) {
  if (!e.facing) e.facing = 'S';
  if (e.turnCooldown == null) e.turnCooldown = 0;
  if (e.turnCooldown > 0) e.turnCooldown--;
  const oldX = e.x, oldY = e.y;
  aiMoveOrAttack(e, MOVE_PATTERN.ORTHOGONAL);
  if (e.x !== oldX || e.y !== oldY) {
    e.facing = (e.x > oldX) ? 'E' : (e.x < oldX) ? 'W' : (e.y > oldY) ? 'S' : 'N';
    e.turnCooldown = e.turnSpeed || 2;
  } else if (e.turnCooldown === 0) {
    e.facing = directionTo(e, state.player);
    e.turnCooldown = e.turnSpeed || 2;
  }
}

function aiSwarm(e) {
  // Pack-aware chase. Pack-bond grant on member death handled in onEnemyDeath hook.
  aiMoveOrAttack(e);
}

function aiBurrower(e) {
  if (!e.burrowState) e.burrowState = 'BURROWED';
  if (e.burrowState === 'BURROWED') {
    e.invisible = true; e.invulnerable = true;
    if (chebyshev(e, state.player) <= 1) {
      e.burrowState = 'SURFACING';
      spawnParticles(e.x, e.y, 14, '#a16207', 2.5, 25);
      e.energy -= ACTION_COST.WAIT;
      return;
    }
    // Underground move toward player ignoring walls
    const step = stepTowardWithPattern(e.x, e.y, state.player.x, state.player.y, MOVE_PATTERN.OMNIDIRECTIONAL, 0, []);
    if (step) { e.x = step.x; e.y = step.y; }
    e.energy -= ACTION_COST.MOVE;
    return;
  }
  if (e.burrowState === 'SURFACING') {
    e.invisible = false; e.invulnerable = false;
    e.burrowState = 'ACTIVE';
    e.energy -= ACTION_COST.WAIT;
    return;
  }
  // ACTIVE
  if (e.hp / e.maxHp < (e.reburrowBelow || 0.5) && !e.usedReburrow && !isAdjacentForAttack(e, state.player)) {
    e.burrowState = 'BURROWED'; e.usedReburrow = true;
    spawnParticles(e.x, e.y, 14, '#a16207', 2.5, 25);
    e.energy -= ACTION_COST.WAIT;
    return;
  }
  aiMoveOrAttack(e, MOVE_PATTERN.ORTHOGONAL);
}
```

### Damage hook (frontal armor)
```js
// In applyDamage(target, attacker, dmg) for enemies, BEFORE def is subtracted:
let effectiveDef = target.def;
if (target.frontDef !== undefined && attacker) {
  const dirFromAttacker = directionFromTo(target, attacker); // 'N'/'E'/'S'/'W'
  const fromFront = (dirFromAttacker === target.facing);
  effectiveDef = fromFront ? target.frontDef : target.rearDef;
}
const finalDmg = Math.max(1, dmg - effectiveDef);
```

## Integration checklist
- [ ] Append 10 ENEMY_DEFS entries
- [ ] Append 10 ITEM_DEFS entries
- [ ] Add 3 AI_REGISTRY entries (`caveCrab`, `swarm`, `burrower`)
- [ ] Wire up new effects: `cursedDrain`, `mirrorReflect`, `phoenixRevive`, `maxHpPermanent`, `slowRegen`, `panic`, `throw`
- [ ] Add `cureStatuses` array handling to consumable use
- [ ] Add `stationary:true` flag to enemy movement gate (skip move step)
- [ ] Add `noCrit:true` flag check in damage roll
- [ ] Add `spawnIn:'wallAdjacent'` placement logic for Tentacle Wall
- [ ] Implement spawn-group helper for `swarm` packs in populateFloor
- [ ] Implement `onEnemyDeath` pack-mate enrage hook
- [ ] Implement `directionTo` / `directionFromTo` helpers (4-way)
- [ ] Implement frontal-armor damage hook
- [ ] Verify weight totals per floor — old sum vs new (should still feel curated)
- [ ] Test mob spawn rates in `populateFloor` across floors 2/4/6/8
- [ ] Add new STATUS handling: pack-enrage flag (no new STATUS const needed; just enemy.enraged)

## Balance notes

**Top 3 ryzyka:**

1. **Beetle Swarm + Fire Scroll = trivial XP farm.** 5 beetles × 2 XP each = 10 XP, but a Fire Scroll OHKO clears the whole swarm. Mitigation: weight 5 means swarms are uncommon; XP per beetle deliberately set to 2 (well below 5 that would make them efficient kills). If playtest shows abuse, drop XP per beetle to 1.

2. **Cursed Sword + Lifesteal stacks too well.** atk +8 is the second-highest in game (matches Battle Axe), and Lifesteal at 30% (max 3 stacks) cancels the −1/turn drain trivially in combat. Mitigation: drain ticks even out-of-combat (no enemies), so it's a real cost during exploration. Weight 2 + minFloor 5 keeps it rare. Watch for: Lifesteal 3-stack + Cursed Sword being a dominant build — may need to add `cursedDrain` ticking even mid-attack (drain BEFORE lifesteal applies).

3. **Phoenix Vial breaking the death stakes.** Roguelike permadeath is a pillar — auto-revive risks blunting it. Mitigation: weight 1 (single-vial-per-run typical), only floor 7+, revive carries over status effects (poison/bleed will likely re-kill quickly), single use. Treat as a "mistake forgiveness" rather than safety net. If telemetry shows >40% of deep runs surviving via Phoenix, raise minFloor to 8 or drop healPct to 0.30.

**Soft risks (watch but don't pre-empt):**
- Tentacle Wall placement might feel claustrophobic in narrow rooms — playtest needed.
- Banshee + Wyrm Hatchling on same floor 6 = brutal combo; spawn weights are intentionally low (4 each) so co-occurrence is rare.
- Treant regen + Golem juggernaut both on floors 5-9 means two high-HP slow tanks competing for spawn slots — fine for variety.
