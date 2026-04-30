# Biomes System — GDD

> **Status**: Draft
> **Author**: Systems-Designer (with Level-Designer + Art-Director support)
> **Last Updated**: 2026-04-30
> **Implements Pillar**: "Journey, not grind" — every floor must feel like progress through a remembered place, not another procedural sample.

## 1. Overview

Today, all 10 floors of Obsidian Depths share one tileset, one mob pool (filtered only by `floor` range), one trap distribution, and one ambient look — the only thing that changes between floor 1 and floor 10 is which enemies the weighted spawner happens to roll. Players experience this as *"another dungeon"*, not as *descent through layered worlds*. The Biomes System collapses the 10-floor structure into **5 themed biomes of 2 floors each**: **Crypt → Cave → Lava Halls → Sunken Forest → Dragon's Lair**. Each biome owns its tile palette, ambient particle layer, mob pool weights, trap distribution, audio direction, and a guaranteed boss room on its second floor. The first floor of a biome is the *exploration floor* (introduces theme, mobs, traps); the second floor is the *culmination* (theme escalates, boss room is guaranteed). The system is a thin overlay on top of the existing `generateDungeon` / `populateFloor` / render pipeline — it does not replace those systems, it feeds them per-biome data.

## 2. Player Goals

- **Feel the descent**. Every 2 floors the world *visibly, audibly, mechanically* changes — players say *"I made it to the lava halls"* not *"I made it to floor 6"*.
- **Memorise the journey**. Each biome has 1-2 signature mobs and 1 boss the player remembers by name a week later.
- **Anticipate the next biome**. Stair transitions tell the player what world is next *before* they descend, so the descent itself is a decision (do I have enough potions for the Lava?).
- **Master biome-specific play**. Each biome rewards different tactics — Crypt is about resurrect-prevention, Cave about traversal, Lava about cooldown management, Forest about kiting, Lair about endurance.
- **Earn a "wow moment" five times**. Each boss room is staged: lit, themed, mechanically distinct, with a guaranteed legendary drop or pity-bonus.

## 3. Game Design Pillars Alignment

The Biomes System is the *spine* through which the existing pillars finally land:

- **Pillar — Tactile descent**: The torch FOV (plan 01) only matters if what is hidden in the dark is *thematically charged*. A "skeleton you can't see" is a different fear than a "demon you can't see". Biomes give the dark *specific* meaning per floor.
- **Pillar — Memorable encounters**: Mob roster (plan 03) has 15 mobs but spawn-weight floor ranges scatter them randomly. Biomes concentrate thematic mobs into 2-floor windows so each mob *belongs* somewhere instead of *appearing* somewhere.
- **Pillar — Permadeath weight**: A run that ends on floor 6 (Lava Halls) feels different than one that ends on floor 4 (Cave). Biomes turn floor numbers into stories.
- **Anti-pattern this kills**: "Why does floor 3 look the same as floor 7?" — the most damning playtester quote the current build invites.

## 4. Core Mechanics

### 4.1 Biome Distribution

| Biome # | Key | Floors | Theme | Boss Floor | Boss |
|---------|-----|--------|-------|------------|------|
| 1 | `crypt` | 1-2 | Undead, mausoleum, sacred decay | 2 | Lich (custom — see 5.1) |
| 2 | `cave` | 3-4 | Bestial, mineral, claustrophobic | 4 | Golem King (custom Golem variant) |
| 3 | `lava` | 5-6 | Demonic, volcanic, scorching | 6 | Demon Lord (custom Demon variant) |
| 4 | `forest` | 7-8 | Druidic, sunken, eldritch nature | 8 | Treant Elder (new mob) |
| 5 | `lair` | 9-10 | Apex, dragonkin, victory | 10 | Dragon (existing dragon, staged) |

Biome resolution: `BIOME_FOR_FLOOR[floor] = BIOMES[Math.floor((floor-1)/2)]` — floor 1,2 → 0; floor 3,4 → 1; etc.

### 4.2 Boss Room (per biome 2-nd floor)

Every biome's second floor contains exactly one **boss room**, generated *after* the normal `generateDungeon` pass and treated as a special room:

- **Layout**: One large room (12×9 minimum, larger than `ROOM_MAX`), placed adjacent to the stairs-down tile of the floor (so the boss is the gate, not optional).
- **Lighting**: `lit=true` always — boss rooms are theatrically lit regardless of `LIT_ROOM_CHANCE`. The wow-moment must read clearly.
- **Boss spawn**: Boss mob spawns in the geometric center of the room at floor entry. Boss has `forceSpawn=true` flag in its def (matches dragon precedent).
- **Boss minions**: 2-4 thematic minions spawn at the room's corners — flavor support, not difficulty (they exist so the boss doesn't fight alone).
- **Reward**: On boss death, drop guaranteed Legendary card (existing item rarity system) + biome-themed unique drop ("Lich's Phylactery", "Heart of Stone", "Demon Sigil", "Treant Seed", "Dragon Scale"). Unique drop is cosmetic flavor for now; future systems may use it.
- **Pity bonus**: Boss kill increments `state.player.bossesSlain++`. If `bossesSlain >= 3` and player has not yet received a Legendary in their last 2 floors → next item drop is Legendary-tier (catch-up mechanic so unlucky runs still feel rewarded).

### 4.3 Transition Between Biomes

When the player descends stairs from floor 2N (last of biome A) to floor 2N+1 (first of biome B):

1. **Stairs message intercept**: Instead of the standard "You descend" log entry, show a **center-screen banner** for 2.5 seconds with the new biome name + flavor tagline. Implementation: HTML overlay div with fade-in/fade-out, blocks input.
2. **Banner content per biome**:
   - Crypt → Cave: *"You descend into the Caves… the air thickens with mineral dust."*
   - Cave → Lava: *"The walls grow warm. Lava Halls await."*
   - Lava → Forest: *"You break through into a sunken forest. Light filters from cracks above."*
   - Forest → Lair: *"A great roar echoes. You have found the Lair."*
3. **Audio sting**: Crossfade music (existing biome track fades out; new biome track fades in over 2s). Optional one-shot SFX (door creaking, lava hiss, etc.) per transition.
4. **No transition between same-biome floors**: Going from floor 1 → 2, 3 → 4, etc., is a normal stair descent. Only odd-floor entries (3, 5, 7, 9) trigger the banner.
5. **Floor 1 entry**: The Crypt banner *does* show on game start (sets the tone for the whole run).

## 5. Per-Biome Design

### 5.1 Crypt (Floor 1-2)

**Theme & Mood**
- Floor color: `#3a2e2a` (dried bone-brown), wall accent `#1a1410` (deep mausoleum stone)
- Ambient lighting tint: `#9b7e6b` (sepia, warm-but-dead)
- Atmosphere words: solemn, dusty, echoey, sacred, decayed
- Player emotion: **solemn dread** — *"I should not be here, but the dead don't mind anymore"*

**Mob Spawn Override** (per-biome weighted pool — overrides default `floorRange`)
- Skeleton 25%, Zombie 20% (NEW mob — see Open Questions), Wraith 15% (early access — was [5,10], now allowed in crypt)
- Ghost 10% (early access)
- Rat 10%, Snake 10%, Bat 10% (generic floor-1 baseline)

**Boss (Floor 2): The Lich** (custom — extension of skeleton+wizard)
- HP 60, ATK 5, DEF 2, Speed NORMAL
- AI: hybrid `caster` + `reviver` — casts FROST at range 5, revives nearby skeleton corpses on its turn (range 4, no limit).
- Phase 2 (HP < 50%): teleports once to opposite room corner, summons 2 fresh skeletons.
- Reward: "Lich's Phylactery" unique drop + Legendary card.

**Trap Theme**
- Poison Vent 50% (signature — mausoleum gas), Spike 25%, Explosive Rune 15% (cursed runes), Alarm 10%
- Pit traps 0% (Crypt floor is sealed stone, not earthen)

**Visual Ambience (particles)**
- Floating dust mites: drifting `#9b7e6b` 1-px particles, ~3/sec, slow vertical fall, alpha 0.4
- Occasional moth: 1 sprite per minute, white-grey, erratic flight path

**Audio Direction**
- Music: low cello drone in **D minor**, distant choir vocalise (no words), slow harmonic pulse
- Ambient SFX loop: distant water-drip every 4-7s, occasional bone-clatter
- Combat SFX cues: dampened impact (cloth/dust), wraith hits = *whisper*

### 5.2 Cave (Floor 3-4)

**Theme & Mood**
- Floor color: `#2a2622` (wet rock), wall accent `#0d0a08` (slick black mineral)
- Ambient lighting tint: `#6b7e9b` (cold blue-grey)
- Atmosphere words: damp, claustrophobic, dripping, alive, mineral
- Player emotion: **cautious exploration** — *"Something lives in here. I don't know what yet."*

**Mob Spawn Override**
- Bat 20%, Spider 25% (signature), Snake 15%, Cave Crab 15% (NEW — see Open Questions)
- Goblin 10% (cave-dwellers), Slime 10% (mineral oozes), Rat 5%

**Boss (Floor 4): Golem King** (Golem variant, scaled up)
- HP 90, ATK 9, DEF 7, Speed CRAWL
- AI: `juggernaut` base + every 3 turns slams the ground → 1-tile shockwave (radius 2 around boss), 4 dmg, knocks back player 1 tile.
- Drops shards on death — 3 minor "Stone Heart" pickups (small HP heal items).
- Reward: "Heart of Stone" unique drop + Legendary card.

**Trap Theme**
- Pit Trap 45% (signature — earthen floor, falls common), Spike 30%, Alarm 15%, Poison 10%
- Explosive 0%

**Visual Ambience**
- Dripping water: per-room random tile drips a pixel every 2-4s, blue-grey
- Falling pebbles: occasional `#0d0a08` pixel falling from "ceiling" (random tile) ~once per 5s
- Subtle screen-edge moisture: increased vignette darkness toward edges

**Audio Direction**
- Music: low percussion (taiko + stone-block), no melody, occasional resonant hum, key **C minor / dorian**
- Ambient SFX loop: continuous drip-echo, wind through caverns, distant rumble
- Combat SFX: rocky / scraping impact texture, spider hits = *click-skitter*

### 5.3 Lava Halls (Floor 5-6)

**Theme & Mood**
- Floor color: `#3a1a0a` (cracked basalt), wall accent `#5a1a0a` (red-glowing seams)
- Ambient lighting tint: `#ff6a3a` (hot orange, warm-heavy)
- Atmosphere words: scorching, oppressive, roaring, infernal, claustrophobic-with-heat
- Player emotion: **dangerous confidence** — *"I survived the cave. Now I burn."*

**Mob Spawn Override**
- Demon 20% (early access — was [7,10]), Fire Elemental 20% (NEW), Lava Slime 20% (Slime variant, fire damage on hit)
- Wizard 15% (fire-caster variant), Skeleton 10% (charred), Goblin 10% (pyro goblin), Rat 5%

**Boss (Floor 6): Demon Lord** (Demon variant)
- HP 110, ATK 10, DEF 4, Speed NORMAL
- AI: `teleporter` base + signature move "Hellrain": every 4 turns drops 5 fire AoE markers across the room (telegraph 1 turn) — markers detonate next turn for 5 dmg each, radius 1.
- Phase 2 (HP < 40%): permanent fire-aura — adjacent tiles to boss deal 2 dmg/turn standing-damage.
- Reward: "Demon Sigil" unique drop + Legendary card.

**Trap Theme**
- Explosive Rune 50% (signature), Pit 20% (lava pit — instant -10 HP, no floor descent), Poison 15% (sulfur vents), Alarm 10%, Spike 5%
- Tuning note: explosion AoE radius bumped to 3 (from 2) in this biome only — lava is *generous* with fire.

**Visual Ambience**
- Rising embers: orange `#ff6a3a` 1-px particles drifting *upward* (inverse gravity), ~5/sec, fade alpha 0.6 → 0
- Heat shimmer: vertical-wave displacement filter on terrain (CSS `transform: translateY(sin(t))` per tile, ±0.5 px)
- Occasional lava-crack flash: random wall tile pulses red for 0.3s every 8-12s

**Audio Direction**
- Music: distorted brass + low taiko, key **F# minor**, dissonant, urgent (180 BPM half-time pulse)
- Ambient SFX loop: continuous low roar (fire crackle), occasional whoosh of distant lava jet
- Combat SFX: searing-metal hit cue, demon hits = *low growl + crack*

### 5.4 Sunken Forest (Floor 7-8)

**Theme & Mood**
- Floor color: `#1a3a1a` (mossy dark green), wall accent `#0a1a0a` (rotted bark)
- Ambient lighting tint: `#9bff9b` (bioluminescent green) + `#fbbf24` (firefly yellow accents)
- Atmosphere words: eldritch, lush, whispering, ancient, beautiful-and-wrong
- Player emotion: **uneasy wonder** — *"This shouldn't grow underground. But it does, and it's watching."*

**Mob Spawn Override**
- Treant 20% (NEW), Harpy 15% (NEW — flying ranged), Wolf 20% (NEW — pack AI variant of `coward`+`charger`)
- Banshee 15% (Wraith variant — emits SLOW status), Spider 10%, Wizard 10% (druid), Snake 10% (vine-snake)

**Boss (Floor 8): Treant Elder** (NEW — see Open Questions)
- HP 120, ATK 8, DEF 6, Speed CRAWL
- AI: stationary (immobile root) — summons 1 wolf every 3 turns, casts entangle (1-tile radius around player → 2-turn FREEZE) every 5 turns.
- Phase 2 (HP < 50%): *uproots* — becomes mobile, MOVE_PATTERN.ORTHOGONAL CRAWL.
- Special: room is filled with "vine tiles" that act like web-tiles (SLOW on step) — boss spawns more during fight.
- Reward: "Treant Seed" unique drop + Legendary card.

**Trap Theme**
- Poison Vent 35% (spore vents — signature), Alarm 30% (wolves howl in response — alarm here also doubles spawn count), Pit 20% (root-snare), Spike 15%
- Explosive 0% (no fire in the wet)

**Visual Ambience**
- Falling leaves: `#9bff9b` 2-px particles drifting diagonally with slight wobble, ~2/sec
- Fireflies: 1-3 yellow dots `#fbbf24` per room, slow circular drift, alpha pulse
- Faint mist: low-opacity green ground fog (per-tile alpha 0.1 overlay)

**Audio Direction**
- Music: woodwind + harp, key **A minor / aeolian**, distant choir on long notes, organic and slow (60 BPM)
- Ambient SFX loop: wind through leaves, occasional owl, *distant* wolf howl every 30-60s (warning, not threat)
- Combat SFX: wet-wood impact, banshee hits = *high-pitched wail*, wolf hits = *snarl-bite*

### 5.5 Dragon's Lair (Floor 9-10)

**Theme & Mood**
- Floor color: `#1a0a0a` (charred earth), wall accent `#3a0a0a` (blackened stone) with gold flecks `#fbbf24`
- Ambient lighting tint: `#ff3a1a` (deep red, victory-or-death)
- Atmosphere words: apex, monumental, ancient, scorched, treasure-strewn
- Player emotion: **destiny-meeting dread** — *"This is what I came for. This is what kills me."*

**Mob Spawn Override**
- Wyrm Hatchling 30% (NEW — small dragon variant, breath at range 3), Drake 20% (NEW — flying dragon variant)
- Wraith 15% (lair-haunters), Demon 15% (lair-allies), Wizard 10% (dragon cultist), Golem 10% (treasure-guardian)
- Floor 10 always spawns 1 Dragon (boss, forceSpawn) — already in plan 03.

**Boss (Floor 10): The Dragon** (existing — staged in boss room)
- HP 80, ATK 12, DEF 6 (existing stats)
- AI: existing `dragon` (cone breath, range 5, cooldown 3, 8 dmg)
- Boss room enhancement: 2 Wyrm Hatchling minions spawn at corners. Room has a raised central platform tile (cosmetic — gold-flecked) where dragon spawns.
- Reward: "Dragon Scale" unique drop + Legendary card + **win condition** (existing — descend stairs not needed; dragon kill = win on floor 10).

**Trap Theme**
- Explosive Rune 35% (lava remnants), Alarm 30% (lair sentinels — alarm wakes ALL enemies on floor, not just radius 12), Pit 15%, Poison 10%, Spike 10%
- Constant tension: average traps-per-room +50% in this biome.

**Visual Ambience**
- Sparking embers: orange-red `#ff3a1a` 1-px upward drift, ~6/sec (denser than Lava Halls)
- Falling ash: grey `#5a5a5a` 1-px slow downward drift, ~3/sec
- Gold glint: random `#fbbf24` 1-px sparkles at 0.5/sec on floor tiles (treasure underfoot)

**Audio Direction**
- Music: full orchestra, key **D minor → D major** (climactic shift on dragon spawn), heroic-but-grim (timpani + brass + choir)
- Ambient SFX loop: distant dragon-breath rumble every 15s, deep bass hum, occasional rock collapse
- Combat SFX: heavy impact, dragon roar on engage (one-shot SFX), breath SFX = *deep whoosh*

## 6. Data Schema

```js
const BIOMES = [
  { key: 'crypt',  floors: [1,2],  name: 'The Crypt',
    color: { floor: '#3a2e2a', wall: '#1a1410', tint: '#9b7e6b' },
    ambient: { particle: 'dust',   rate: 3, color: '#9b7e6b' },
    mobPool: [
      { key:'skeleton', weight:25 }, { key:'zombie', weight:20 },
      { key:'wraith',   weight:15 }, { key:'ghost',  weight:10 },
      { key:'rat',      weight:10 }, { key:'snake',  weight:10 },
      { key:'bat',      weight:10 },
    ],
    trapPool: [
      { type:'poison',    weight:50 }, { type:'spike', weight:25 },
      { type:'explosion', weight:15 }, { type:'alarm', weight:10 },
    ],
    boss:  { key:'lich',         floor:2, drop:'phylactery' },
    music: 'crypt_drone_dmin',
    transitionBanner: 'You enter the Crypt. The dead remember.',
  },
  { key: 'cave',   floors: [3,4],  name: 'The Caves',
    color: { floor: '#2a2622', wall: '#0d0a08', tint: '#6b7e9b' },
    ambient: { particle: 'drip',   rate: 4, color: '#6b7e9b' },
    mobPool: [
      { key:'bat',     weight:20 }, { key:'spider',   weight:25 },
      { key:'snake',   weight:15 }, { key:'cavecrab', weight:15 },
      { key:'goblin',  weight:10 }, { key:'slime',    weight:10 },
      { key:'rat',     weight:5  },
    ],
    trapPool: [
      { type:'pit',    weight:45 }, { type:'spike',  weight:30 },
      { type:'alarm',  weight:15 }, { type:'poison', weight:10 },
    ],
    boss:  { key:'golem_king',   floor:4, drop:'heart_of_stone' },
    music: 'cave_taiko_cmin',
    transitionBanner: 'You descend into the Caves. The air thickens with mineral dust.',
  },
  { key: 'lava',   floors: [5,6],  name: 'Lava Halls',
    color: { floor: '#3a1a0a', wall: '#5a1a0a', tint: '#ff6a3a' },
    ambient: { particle: 'ember',  rate: 5, color: '#ff6a3a' },
    mobPool: [
      { key:'demon',    weight:20 }, { key:'fire_elemental', weight:20 },
      { key:'lavaslime',weight:20 }, { key:'wizard',         weight:15 },
      { key:'skeleton', weight:10 }, { key:'goblin',         weight:10 },
      { key:'rat',      weight:5  },
    ],
    trapPool: [
      { type:'explosion', weight:50 }, { type:'pit',    weight:20 },
      { type:'poison',    weight:15 }, { type:'alarm',  weight:10 },
      { type:'spike',     weight:5  },
    ],
    boss:  { key:'demon_lord',   floor:6, drop:'demon_sigil' },
    music: 'lava_brass_fsmin',
    transitionBanner: 'The walls grow warm. Lava Halls await.',
  },
  { key: 'forest', floors: [7,8],  name: 'The Sunken Forest',
    color: { floor: '#1a3a1a', wall: '#0a1a0a', tint: '#9bff9b' },
    ambient: { particle: 'leaf',   rate: 2, color: '#9bff9b', accent: '#fbbf24' },
    mobPool: [
      { key:'treant', weight:20 }, { key:'harpy',   weight:15 },
      { key:'wolf',   weight:20 }, { key:'banshee', weight:15 },
      { key:'spider', weight:10 }, { key:'wizard',  weight:10 },
      { key:'snake',  weight:10 },
    ],
    trapPool: [
      { type:'poison', weight:35 }, { type:'alarm', weight:30 },
      { type:'pit',    weight:20 }, { type:'spike', weight:15 },
    ],
    boss:  { key:'treant_elder', floor:8, drop:'treant_seed' },
    music: 'forest_woodwind_amin',
    transitionBanner: 'You break through into a sunken forest. Light filters from cracks above.',
  },
  { key: 'lair',   floors: [9,10], name: "The Dragon's Lair",
    color: { floor: '#1a0a0a', wall: '#3a0a0a', tint: '#ff3a1a' },
    ambient: { particle: 'ash',    rate: 6, color: '#ff3a1a', accent: '#fbbf24' },
    mobPool: [
      { key:'wyrmling', weight:30 }, { key:'drake',  weight:20 },
      { key:'wraith',   weight:15 }, { key:'demon',  weight:15 },
      { key:'wizard',   weight:10 }, { key:'golem',  weight:10 },
    ],
    trapPool: [
      { type:'explosion', weight:35 }, { type:'alarm',  weight:30 },
      { type:'pit',       weight:15 }, { type:'poison', weight:10 },
      { type:'spike',     weight:10 },
    ],
    boss:  { key:'dragon',       floor:10, drop:'dragon_scale' },
    music: 'lair_orchestra_dmin',
    transitionBanner: 'A great roar echoes. You have found the Lair.',
  },
];

function biomeForFloor(floor) {
  return BIOMES[Math.floor((floor - 1) / 2)];
}
```

## 7. Visual Design Direction

| Biome | Floor hex | Wall hex | Tint hex | Particle | Rate/sec |
|-------|-----------|----------|----------|----------|----------|
| Crypt | #3a2e2a | #1a1410 | #9b7e6b | dust | 3 |
| Cave | #2a2622 | #0d0a08 | #6b7e9b | drip | 4 |
| Lava | #3a1a0a | #5a1a0a | #ff6a3a | ember | 5 |
| Forest | #1a3a1a | #0a1a0a | #9bff9b + #fbbf24 | leaf + firefly | 2+1 |
| Lair | #1a0a0a | #3a0a0a | #ff3a1a + #fbbf24 | ember + ash + glint | 6+3+0.5 |

**Tint application**: applied as a multiply blend over rendered terrain at alpha 0.15. Lit-rooms (plan 01) get tint at alpha 0.05 (brighter, less tinted — drama via contrast).

**Vignette adjustment per biome**: Crypt 0.75 (default), Cave 0.80 (claustrophobic), Lava 0.70 (heat brightens), Forest 0.65 (bioluminescence), Lair 0.85 (oppressive — heaviest).

## 8. Audio Design Direction

| Biome | Music key | Genre | BPM | Ambient SFX | Combat hit cue |
|-------|-----------|-------|-----|-------------|----------------|
| Crypt | D minor | low cello drone + choir | 60 | water-drip, bone-clatter | dampened/cloth |
| Cave | C minor (dorian) | taiko + stone | 80 | drip-echo, wind, rumble | rocky/scraping |
| Lava | F# minor | distorted brass + taiko | 90 (180 half-time) | low roar, lava jet | searing metal |
| Forest | A minor (aeolian) | woodwind + harp + choir | 60 | wind/leaves, owl, distant howl | wet wood |
| Lair | D minor → D major | full orchestra | 100 | dragon-rumble, hum, collapse | heavy/deep |

**Crossfade rule**: 2-second linear crossfade on biome transition (stair descent from floor 2N to 2N+1). Same-biome floor descent: no music change.

## 9. Difficulty Curve Per Biome

| Biome | Floors | Difficulty (1-10) | Hard moment? |
|-------|--------|-------------------|--------------|
| Crypt | 1-2 | 2 → 4 (Lich) | Lich revives skeletons → players who don't burst-down get overwhelmed |
| Cave | 3-4 | 4 → 5 (Golem King) | Golem King shockwave + spider web tiles = traversal nightmare |
| Lava | 5-6 | 6 → 7 (Demon Lord) | Hellrain markers force movement during cooldown windows |
| Forest | 7-8 | 6 → 7 (Treant Elder) | Wolves + harpies = ranged kite while vines slow you. Steep skill check. |
| Lair | 9-10 | 8 → 10 (Dragon) | Dragon breath cone — tightest mechanical test in the game |

**Designer note**: Forest is *intentionally* a difficulty spike, not a smooth ramp. Players who survive the Lava Halls expect "natural = easier" and get blindsided. The shock is the point — Forest mob composition (ranged + slow) demands a tactical pivot. This is the "git gud" filter before the Lair.

## 10. Acceptance Criteria

- [ ] 1. `BIOMES` array defined with 5 entries; `biomeForFloor(N)` returns correct biome for N=1..10.
- [ ] 2. Floor terrain renders with biome-specific `floor`/`wall` hex colors (verified visually on each floor).
- [ ] 3. Ambient particles render with biome-specific type/rate/color; particles do not affect gameplay or FPS budget (>55 fps maintained).
- [ ] 4. Mob spawn pool matches biome's `mobPool` weights — over 100 spawn samples, distribution within ±5% of declared weights.
- [ ] 5. Trap distribution matches biome's `trapPool` weights — over 50 trap samples, distribution within ±10% of declared weights.
- [ ] 6. Floor 2/4/6/8/10 each contain exactly one boss room; boss room is `lit=true`, contains the declared boss with `forceSpawn=true`, contains 2-4 minions at corners.
- [ ] 7. Boss kill drops 1 Legendary card + 1 unique-named flavor item.
- [ ] 8. Pity bonus: after 3 boss kills with no Legendary in last 2 floors, next item drop is forced Legendary.
- [ ] 9. Stair descent from floor 2 → 3, 4 → 5, 6 → 7, 8 → 9 displays biome banner overlay for 2.5s, blocks input during display.
- [ ] 10. Game start (entering floor 1) displays the Crypt banner.
- [ ] 11. Stair descent within same biome (1→2, 3→4, 5→6, 7→8, 9→10) does NOT display banner.
- [ ] 12. Music crossfade plays on biome transition (2-second linear); no crossfade on same-biome descent.
- [ ] 13. Tint overlay applies per biome at alpha 0.15 normal / 0.05 in lit-rooms.
- [ ] 14. Vignette alpha varies per biome per Section 7 table.
- [ ] 15. Performance: biome system overhead per frame ≤ 1ms (measure via profiler; failure = optimize particle pool).
- [ ] 16. No hardcoded biome data in render/spawn code — all biome behavior reads from `BIOMES[]`.

## 11. Open Questions

| # | Question | Owner | Decision needed before |
|---|----------|-------|------------------------|
| 1 | Do we add **Zombie** as a new mob in plan 03 ENEMY_DEFS, or reuse Skeleton with a Crypt visual variant? | creative-director + systems-designer | Crypt biome implementation |
| 2 | Forest biome introduces 4 new mobs (Treant, Harpy, Wolf, Banshee). Is the team's appetite for mob design deep enough for Forest, or do we ship Forest with reskinned existing mobs (Treant=Golem variant, Harpy=Bat variant, Wolf=Coward+Charger hybrid, Banshee=Wraith variant)? | creative-director | Forest biome implementation |
| 3 | Boss rooms have a guaranteed Legendary card drop — does that conflict with existing card-rarity pacing in the deck system? Should pity-bonus be ON or OFF by default? | game-designer + economy-designer | Implementation phase |
| 4 | Cave Crab: is this a meaningfully new mob (sideways crawl, pinch attack) or just a Snake reskin? Recommend designing only if mob-design budget allows — otherwise drop weight to 0 for now. | systems-designer | Cave biome implementation |
| 5 | Transition banner: HTML overlay (easier) or canvas-rendered text-fade (consistent style)? Banner blocks input — is 2.5s the right duration, or do we let players skip via keypress? | ux-designer | Transition implementation |

## 12. Implementation Notes (for gameplay-programmer)

**Key integration points** (line numbers reference current `index.html` per CLAUDE.md):

- **CFG / constants section** (~line 540): add `BIOMES` array and `biomeForFloor(floor)` helper. Place after existing CFG, before ENEMY_DEFS.
- **`generateDungeon`** (line 694, plan 01 reference): after dungeon is generated, on **even floors** (2,4,6,8,10), inject a boss room. Algorithm: find the room nearest to stairs-down, mark it `lit=true`, oversize it to ≥12×9 (or pick the largest room and force-grow), tag it `boss=true`.
- **`populateFloor`** (line 778, plan 03 reference): replace `def.floor[0] <= floor && floor <= def.floor[1]` filter with biome `mobPool`. The biome's `mobPool` becomes the weighted pick source. Boss rooms: skip standard population, instead spawn `BIOMES[i].boss` at room center + 2-4 thematic minions at corners.
- **Trap spawn** (plan 01 — `generateDungeon` traps loop): replace flat `TRAP_DEFS` weighted pick with biome `trapPool` weighted pick. Honor `minFloor` from `TRAP_DEFS` as a sanity check (don't spawn pit on floor 1 even if biome rolls it).
- **Render terrain** (line 1202, plan 01): after lit-room color resolution, multiply by biome `tint` at alpha per Section 7 (0.15 normal / 0.05 lit). Use existing `colorVariant` helper if available.
- **Render particles**: new ambient particle pool per biome, pumped each frame at biome `rate`. Pool size cap: 50 particles per biome. Skip rendering particles outside the player's FOV expanded by 2 tiles (perf optimization).
- **Vignette** (line 1446): read biome from `biomeForFloor(state.floor)`, use Section 7 alpha table.
- **`enterFloor`** (line 925): on entry, check if `biomeForFloor(state.floor) !== biomeForFloor(state.floor - 1)` (or `state.floor === 1`) → trigger banner + music crossfade. Use HTML overlay div (CSS `.biome-banner`) with `setTimeout` to remove after 2.5s.
- **Music system**: not currently in codebase per CLAUDE.md. **Stub now**: define `playBiomeMusic(key)` as no-op + console.log. Audio integration is downstream of this GDD.
- **State additions**: `state.biome = 'crypt'` (key) initialized in `enterFloor`. `state.player.bossesSlain = 0` initialized in `newState`. `state.player.lastLegendaryFloor = 0` for pity tracking.
- **Boss death hook**: in `attackEnemy` after enemy hp reaches 0, check if enemy has `boss=true` flag → drop Legendary card + unique drop, increment `bossesSlain`, set `lastLegendaryFloor = state.floor`.
- **Pity check**: in item drop logic, if `bossesSlain >= 3 && state.floor - lastLegendaryFloor >= 2` → force next drop to Legendary tier.

**Phase order recommendation**:
1. `BIOMES` data + `biomeForFloor` (no behavior change yet)
2. Terrain color override per biome (visible change, low risk)
3. Mob pool override per biome
4. Trap pool override per biome
5. Boss room generation on even floors
6. Boss minion spawn + boss `forceSpawn`
7. Banner transition + state hooks
8. Pity-bonus + Legendary drops
9. Ambient particles per biome
10. Music stubs + crossfade hooks
11. Vignette + tint final pass
12. Acceptance criteria sweep
