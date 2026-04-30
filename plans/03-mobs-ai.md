# 03 — Mobs / AI / Behaviors

## Problem

`ENEMY_DEFS` (`obsidian-depths/index.html:611-622`) ma 10 typów potworów, ale wszystkie zachowują się identycznie: `endTurn` (linie 1115-1140) wywołuje dla każdego dokładnie ten sam `stepToward` (linia 1142) — chebyshev `dist <= 1.5` → atak, `< 10` → krok ortogonalny ku graczowi (linia 1147 wycina przekątne). Nie ma:
- różnic w AI (wszystkie potwory to "march to player")
- specjalnych zdolności (ranged, charge, phase, split, drain XP, summon, ambush)
- emisji status-effectów (poison, web, slow, drain, freeze)
- mechaniki ucieczki / fear / niskiego HP
- interakcji wróg ↔ wróg (resurrect, lider, sąsiad)

Plan 02 wprowadza energy/speed + movement patterns, plan 01 wprowadza FOV z pochodnią. Ten plan dorzuca trzecią warstwę: **AI_REGISTRY** — per-typ funkcję `act(enemy, ctx)` zamiast wspólnego `enemyAct`.

## Cel

15 unikatowych potworów, każdy z własnym state-machine. Implementacja:

1. **Tabela ENEMY_DEFS rozszerzona** — emoji, speed, movementPattern, weight, AI key, status emit, special params.
2. **AI_REGISTRY** — `{ key: actFn }` dispatch w `enemyAct`.
3. **Helper functions** — `lineOfSight`, `fleeDirection`, `rangedAttackPlayer`, `nearestAlly`, `chebyshev`, `manhattan`, `bfsPath`, `playerVisibleByEnemy`, `tilesAround`.
4. **Status effects** rozszerzone — POISON, WEB (slow tile), DRAIN_XP, FREEZE, BLEED.
5. **Reprezentacja emoji** zamiast pojedynczych liter (`ch` → `emoji`, render font tweak).

## Tabela potworów

Statystyki bazowe (przed `floor scaling` z `populateFloor:792`). `weight` = częstość spawnu w `populateFloor` (replace `available[rand(0, len-1)]` na weighted pick). `floorRange = [min, max]` — `max=null` znaczy "do końca".

| # | Emoji | Name        | HP  | ATK | DEF | Speed   | Move pattern     | XP  | Floor    | W  | AI key      | Status emit          |
|---|-------|-------------|-----|-----|-----|---------|------------------|-----|----------|----|-------------|----------------------|
| 1 | 🐀    | Rat         | 6   | 2   | 0   | FAST    | ORTHOGONAL       | 5   | [1, 4]   | 14 | `coward`    | —                    |
| 2 | 🐍    | Snake       | 8   | 3   | 0   | NORMAL  | ZIGZAG           | 8   | [1, 5]   | 11 | `zigzagger` | POISON 3t × 2dmg     |
| 3 | 🦇    | Bat         | 5   | 3   | 0   | FAST    | DIAGONAL         | 7   | [1, 6]   | 10 | `flyer`     | —                    |
| 4 | 🕷️   | Spider      | 9   | 4   | 0   | NORMAL  | OMNIDIRECTIONAL  | 12  | [2, 7]   | 9  | `ambusher`  | WEB on death (slow)  |
| 5 | 💀    | Skeleton    | 12  | 4   | 1   | SLOW    | ORTHOGONAL       | 12  | [1, 8]   | 12 | `reviver`   | —                    |
| 6 | 👻    | Ghost       | 10  | 5   | 0   | NORMAL  | OMNIDIRECTIONAL  | 18  | [3, 10]  | 7  | `phaser`    | ignores DEF on hit   |
| 7 | 👹    | Goblin      | 14  | 4   | 1   | NORMAL  | ORTHOGONAL       | 14  | [2, 6]   | 11 | `thrower`   | —                    |
| 8 | ⚔️    | Orc Warrior | 22  | 6   | 2   | SLOW    | ORTHOGONAL+LEAP  | 24  | [3, 8]   | 8  | `charger`   | BLEED 2t × 1dmg      |
| 9 | 🟢    | Slime       | 16  | 3   | 0   | CRAWL   | ORTHOGONAL       | 10  | [2, 6]   | 8  | `splitter`  | —                    |
| 10| 🌀    | Wraith      | 18  | 5   | 1   | FAST    | OMNIDIRECTIONAL  | 30  | [5, 10]  | 6  | `xpdrainer` | DRAIN_XP 5/hit       |
| 11| 🗿    | Golem       | 50  | 7   | 5   | CRAWL   | ORTHOGONAL       | 45  | [4, 10]  | 4  | `juggernaut`| immune POISON+BLEED  |
| 12| 📦    | Mimic       | 20  | 8   | 2   | NORMAL  | ORTHOGONAL       | 35  | [3, 10]  | 4  | `mimic`     | —                    |
| 13| 🧙    | Wizard      | 16  | 3   | 1   | NORMAL  | OMNIDIRECTIONAL  | 40  | [5, 10]  | 5  | `caster`    | FREEZE 2t / FIRE 4dmg|
| 14| 😈    | Demon       | 35  | 8   | 3   | NORMAL  | OMNIDIRECTIONAL  | 60  | [7, 10]  | 3  | `teleporter`| FIRE_AOE 6dmg r=2    |
| 15| 🐉    | Dragon      | 80  | 12  | 6   | FAST    | OMNIDIRECTIONAL  | 200 | [10, 10] | 1* | `dragon`    | FIRE_BREATH 8dmg     |

`*` Dragon: 1 sztuka per floor 10 (forced spawn w `populateFloor`, weight nie dotyczy).
Sumaryczny `weight` na floor = filtruj po `floorRange`, suma weights → losuj proporcjonalnie.

### Wklejka JS (gotowa do `ENEMY_DEFS`, zastępuje linie 611-622)

```js
const ENEMY_DEFS = [
  { key:'rat',      emoji:'🐀',  name:'Rat',         hp:6,  atk:2, def:0, speed:SPEED.FAST,   move:MOVE_PATTERN.ORTHOGONAL,      xp:5,   floor:[1,4],  weight:14, ai:'coward'    },
  { key:'snake',    emoji:'🐍',  name:'Snake',       hp:8,  atk:3, def:0, speed:SPEED.NORMAL, move:MOVE_PATTERN.ZIGZAG,          xp:8,   floor:[1,5],  weight:11, ai:'zigzagger', poison:{ticks:3, dmg:2} },
  { key:'bat',      emoji:'🦇',  name:'Bat',         hp:5,  atk:3, def:0, speed:SPEED.FAST,   move:MOVE_PATTERN.DIAGONAL,        xp:7,   floor:[1,6],  weight:10, ai:'flyer',     dodge:0.5 },
  { key:'spider',   emoji:'🕷️', name:'Spider',      hp:9,  atk:4, def:0, speed:SPEED.NORMAL, move:MOVE_PATTERN.OMNIDIRECTIONAL, xp:12,  floor:[2,7],  weight:9,  ai:'ambusher',  webOnDeath:true, ambushRange:2 },
  { key:'skeleton', emoji:'💀',  name:'Skeleton',    hp:12, atk:4, def:1, speed:SPEED.SLOW,   move:MOVE_PATTERN.ORTHOGONAL,      xp:12,  floor:[1,8],  weight:12, ai:'reviver',   reviveRange:3, reviveLimit:1 },
  { key:'ghost',    emoji:'👻',  name:'Ghost',       hp:10, atk:5, def:0, speed:SPEED.NORMAL, move:MOVE_PATTERN.OMNIDIRECTIONAL, xp:18,  floor:[3,10], weight:7,  ai:'phaser',    phaseWalls:true, ignoresDef:true, vanishBelow:0.5, vanishTicks:3 },
  { key:'goblin',   emoji:'👹',  name:'Goblin',      hp:14, atk:4, def:1, speed:SPEED.NORMAL, move:MOVE_PATTERN.ORTHOGONAL,      xp:14,  floor:[2,6],  weight:11, ai:'thrower',   throwRange:3, throwChance:0.35, throwDmg:3 },
  { key:'orc',      emoji:'⚔️', name:'Orc Warrior', hp:22, atk:6, def:2, speed:SPEED.SLOW,   move:MOVE_PATTERN.ORTHOGONAL,      xp:24,  floor:[3,8],  weight:8,  ai:'charger',   chargeRange:3, bleed:{ticks:2, dmg:1} },
  { key:'slime',    emoji:'🟢',  name:'Slime',       hp:16, atk:3, def:0, speed:SPEED.CRAWL,  move:MOVE_PATTERN.ORTHOGONAL,      xp:10,  floor:[2,6],  weight:8,  ai:'splitter',  splitMinHp:8, splitGen:2 },
  { key:'wraith',   emoji:'🌀',  name:'Wraith',      hp:18, atk:5, def:1, speed:SPEED.FAST,   move:MOVE_PATTERN.OMNIDIRECTIONAL, xp:30,  floor:[5,10], weight:6,  ai:'xpdrainer', drainXp:5 },
  { key:'golem',    emoji:'🗿',  name:'Golem',       hp:50, atk:7, def:5, speed:SPEED.CRAWL,  move:MOVE_PATTERN.ORTHOGONAL,      xp:45,  floor:[4,10], weight:4,  ai:'juggernaut',immune:['POISON','BLEED'] },
  { key:'mimic',    emoji:'📦',  name:'Mimic',       hp:20, atk:8, def:2, speed:SPEED.NORMAL, move:MOVE_PATTERN.ORTHOGONAL,      xp:35,  floor:[3,10], weight:4,  ai:'mimic',     disguise:'📦', disguiseRange:1 },
  { key:'wizard',   emoji:'🧙',  name:'Wizard',      hp:16, atk:3, def:1, speed:SPEED.NORMAL, move:MOVE_PATTERN.OMNIDIRECTIONAL, xp:40,  floor:[5,10], weight:5,  ai:'caster',    spellRange:5, fleeRange:2, fireDmg:4, freezeTicks:2 },
  { key:'demon',    emoji:'😈',  name:'Demon',       hp:35, atk:8, def:3, speed:SPEED.NORMAL, move:MOVE_PATTERN.OMNIDIRECTIONAL, xp:60,  floor:[7,10], weight:3,  ai:'teleporter',teleportEvery:5, aoeRadius:2, aoeDmg:6 },
  { key:'dragon',   emoji:'🐉',  name:'Dragon',      hp:80, atk:12,def:6, speed:SPEED.FAST,   move:MOVE_PATTERN.OMNIDIRECTIONAL, xp:200, floor:[10,10],weight:1,  ai:'dragon',    breathRange:5, breathDmg:8, breathCooldown:3, forceSpawn:true },
];
```

## Wzorce AI (state machines)

Każda funkcja AI: `act(e, ctx)` gdzie `ctx = { state, player, allies, helpers }`. Zwraca nic — mutuje `e` i `state`. Cost energii odejmuje funkcja AI (różny dla różnych akcji — patrz plan 02 `ACTION_COST`).

### 1. `coward` (Rat)

```
if e.hp / e.maxHp < 0.3:
    state = FLEE
    move along fleeDirection(e, player)
elif chebyshev(e, player) <= 1:
    attack(e, player)
else:
    moveTowardWithPattern(e, player)
```

### 2. `zigzagger` (Snake)

```
move = stepTowardWithPattern(..., ZIGZAG, e.zigzagPhase)
e.zigzagPhase ^= 1
on hit player → addStatusEffect(player, POISON, def.poison.ticks, def.poison.dmg)
```

### 3. `flyer` (Bat)

```
if random() < 0.5:
    pick random valid DIAGONAL neighbor
else:
    stepTowardWithPattern(..., DIAGONAL)
on incoming attack: if e.hp / e.maxHp < 0.5 and random() < def.dodge:
    cancel attack, spawn dodge particles  // hook w playerAttack → enemy
```

`dodge` rozstrzygany w `attackEnemy` (linia ~979). Patrz „Hooks na atak gracza" niżej.

### 4. `ambusher` (Spider)

```
if e.state == HIDDEN:
    if chebyshev(e, player) <= def.ambushRange and lineOfSight(e, player):
        e.state = ACTIVE
        emit ambush sparks
    else:
        WAIT (spend energy, no move)
elif chebyshev(e, player) <= 1:
    attack
else:
    stepTowardWithPattern(..., OMNIDIRECTIONAL)
on death:
    state.webTiles.push({x:e.x, y:e.y, ttl:30})
```

`webTiles` to nowy bucket w `state` — tile przy kroku gracza/wroga aplikuje SLOW na 2 ticki.

### 5. `reviver` (Skeleton)

```
if e.dead and not e.revived:
    ally = nearestAlly(e, allies, key=='skeleton', range=def.reviveRange)
    if ally exists:
        e.hp = e.maxHp * 0.5
        e.revived = true
        return  // nie usuwaj z state.enemies, oznacz alive
on living turn:
    standard chase + attack
```

Resurrect rozstrzygany w `processWorld` PRZED filtrem `hp > 0` (plan 02 `processWorld:101`). Patrz „Integracja z planem 02".

### 6. `phaser` (Ghost)

```
if e.hp / e.maxHp < def.vanishBelow and not e.vanished:
    e.vanished = true
    e.vanishUntilTick = state.worldTick + def.vanishTicks
    skip rendering, skip combat, skip collision
if e.vanished and state.worldTick >= e.vanishUntilTick:
    e.vanished = false
movement: stepTowardWithPattern ignoring walls (filter wall check off when phaseWalls=true)
attack: damage = e.atk  (skip player.def subtraction in resolveDamage when ignoresDef=true)
```

### 7. `thrower` (Goblin)

```
d = chebyshev(e, player)
if d <= 1:
    attack
elif d <= def.throwRange and lineOfSight(e, player) and random() < def.throwChance:
    rangedAttackPlayer(e, def.throwDmg, color='#a3a3a3', particle='stone')
else:
    stepTowardWithPattern(..., ORTHOGONAL)
```

### 8. `charger` (Orc)

```
if not e.charging:
    if sameRowOrCol(e, player) and chebyshev(e, player) in [2, def.chargeRange] and lineOfSight(e, player):
        e.charging = true
        e.chargeDir = sign(player - e)
        spend ACTION_COST.WAIT  // tellegraph turn (wind-up)
        emit telegraph particles
        return
    standard chase
else:
    leap up to def.chargeRange tiles in chargeDir until blocked
    if lands adjacent to player: attack with bleed
    e.charging = false
    cost ACTION_COST.CHARGE  // 2× normal
```

### 9. `splitter` (Slime)

```
on death:
    if def.splitMinHp <= e.maxHp:
        for i in range(def.splitGen):
            child = clone(e) with hp = floor(e.maxHp / 2), maxHp same, splitMinHp /= 2
            place at empty neighbor of e.x, e.y
            state.enemies.push(child)
movement: stepTowardWithPattern (CRAWL = bardzo rzadko porusza się)
attack: standard
```

`split` w `applyDamage` enemy → after `e.hp <= 0` and `def.ai === 'splitter'`.

### 10. `xpdrainer` (Wraith)

```
on hit player:
    drained = min(player.xp, def.drainXp)
    player.xp -= drained
    e.hp = min(e.maxHp, e.hp + drained)
    addFloatingText(player, '-' + drained + ' XP', '#c084fc')
    no normal damage on top? → opcjonalnie: half damage normal + drain
```

### 11. `juggernaut` (Golem)

```
immune to POISON / BLEED (in addStatusEffect: if entity.def.immune?.includes(type) → return)
super-slow but high def
no special — bare-bones march with extra HP
```

### 12. `mimic`

```
if e.state == DISGUISED:
    render as 📦 (override emoji to def.disguise)
    if chebyshev(e, player) <= def.disguiseRange:
        e.state = ACTIVE
        e.emoji = def.emoji
        attack(e, player)  // free first strike
        emit reveal particles
    else:
        WAIT (no chase)
else: standard chase
```

Spawn: zamiast w `populateFloor` jako enemy w pokoju — alternatywnie zamień losowy item na mimica (~10% chance), żeby imitował skrzynię. Implementacja: po `populateFloor` items, dla każdego item z 10% szansą replace z `{...mimicDef, x, y, state:'DISGUISED'}` push do `state.enemies` zamiast `items`.

### 13. `caster` (Wizard)

```
d = chebyshev(e, player)
if d <= def.fleeRange:
    move along fleeDirection(e, player)  // kite
elif d <= def.spellRange and lineOfSight(e, player):
    spell = random pick: FIREBALL or FROST
    if FIREBALL: rangedAttackPlayer(e, def.fireDmg, particle='fire')
    if FROST: rangedAttackPlayer(e, 0); addStatusEffect(player, FREEZE, def.freezeTicks)
else:
    stepTowardWithPattern
```

### 14. `teleporter` (Demon)

```
e.tpCounter = (e.tpCounter or 0) + 1
if e.tpCounter >= def.teleportEvery:
    e.tpCounter = 0
    target = randomFloorTileNear(player, radius=4, exclude=player.tile)
    e.x, e.y = target
    addStatusEffect(player, FIRE_AOE)? no — direct AoE:
    for tile in tilesAround(e, def.aoeRadius):
        if tile == player: damage(player, def.aoeDmg, 'fire', ignoreDef=false)
        spawn fire particle
    cost CHARGE (200)
elif chebyshev(e, player) <= 1:
    attack
else:
    stepTowardWithPattern
```

### 15. `dragon`

```
e.breathCd = e.breathCd ?? 0
if e.breathCd == 0 and lineOfSight(e, player) and chebyshev(e, player) <= def.breathRange:
    coneDir = sign(player - e)
    for tile in coneTiles(e, coneDir, def.breathRange):
        if tile == player: damage(player, def.breathDmg, 'fire')
        spawn fire on tile (visual + 1-tick burn marker)
    e.breathCd = def.breathCooldown
    cost CHARGE (200)
elif chebyshev(e, player) <= 1:
    attack
else:
    stepTowardWithPattern
e.breathCd = max(0, e.breathCd - 1)
```

`coneTiles(e, dir, range)` = wszystkie kafelki w stożku 90° rozszerzającym się od źródła.

## AI helper functions

Wszystkie nowe — wkleić jako blok PO `stepTowardWithPattern` (po linii ~1159).

| Funkcja | Sygnatura | Zwraca |
|---|---|---|
| `chebyshev(a, b)` | (a, b) | `max(|dx|, |dy|)` |
| `manhattan(a, b)` | (a, b) | `|dx| + |dy|` |
| `sign(n)` | n | -1/0/1 |
| `lineOfSight(a, b)` | Bresenham line a→b, false jeśli `WALL` na drodze | bool |
| `fleeDirection(e, target)` | wybierz `getCandidateMoves(e.move)` maksymalizujący dist do target | `{x,y} \| null` |
| `nearestAlly(e, allies, predicate, range)` | iteruje `state.enemies`, predicate(ally) | enemy \| null |
| `rangedAttackPlayer(e, dmg, opts)` | LOS check, damage, particle line, log | bool |
| `tilesAround(p, r)` | zwraca wszystkie tile w chebyshev ≤ r | `[{x,y}]` |
| `coneTiles(origin, dir, len)` | jak wyżej, ale w stożku w `dir` | `[{x,y}]` |
| `randomFloorTileNear(p, r, excl)` | losuje tile FLOOR/CORRIDOR w obrębie chebyshev r | `{x,y} \| null` |
| `playerVisibleByEnemy(e)` | LOS + range (e.g. ≤ 8) | bool |
| `sameRowOrCol(a, b)` | `a.x==b.x \|\| a.y==b.y` | bool |
| `placeChild(parent, def)` | znajdź pusty neighbor, push enemy | bool |
| `damage(entity, amount, type, ignoreDef)` | wspólny resolver damage | nowy hp |

`lineOfSight` — proste Bresenham, walidacja `state.map[y][x] === TILE.WALL` po drodze (oprócz endpointów). Endpoint sprawdzany przez caller — chcemy strzelać do gracza nawet jak stoi na rogu.

## Status effects emitowane

Plan 02 wprowadza POISON/REGEN/SLOW/HASTE/FREEZE. Ten plan rozszerza `STATUS`:

```js
const STATUS = {
  POISON:'POISON', REGEN:'REGEN', SLOW:'SLOW', HASTE:'HASTE',
  FREEZE:'FREEZE',     // wizard FROST, blokuje akcje 2 turny
  WEB:'WEB',           // tile-based, nie entity-based — patrz state.webTiles
  BLEED:'BLEED',       // orc — 1 dmg/turn, 2 turns
  DRAIN_XP:'DRAIN_XP', // pasywny — wraith aplikuje na hit, nie tick
};
```

| Effect | Tick behavior | Source | Magnitude (default) | Stack |
|---|---|---|---|---|
| POISON | `hp -= magnitude` per worldTick | Snake hit | 2 dmg × 3 t | refresh max |
| BLEED | `hp -= magnitude` per worldTick | Orc charge hit | 1 dmg × 2 t | refresh max |
| FREEZE | speed = 0 (via `getEffectiveSpeed`) | Wizard FROST | × 2 t | refresh ticks |
| SLOW | speed × 0.5 | Web tile step | × 2 t | refresh ticks |
| WEB | `state.webTiles[]`, ttl=30 worldTicks | Spider death | — | per-tile |
| DRAIN_XP | one-shot na hit | Wraith | -5 xp | nie tick — patrz wzorzec |
| HASTE/REGEN | gracz, niedostępne wrogom | items / scrolls | — | — |

Web jako tile (nie status entity): osobna struktura `state.webTiles: [{x,y,ttl}]`. Przed ruchem każdej encji (gracz + wróg) sprawdzaj `webTiles.find(w => w.x===nx && w.y===ny)` → addStatusEffect SLOW. `tickWebTiles()` decrement ttl, filter ttl > 0 — w `processWorld` po `tickStatusEffects`.

`damage(entity, amount, type, ignoreDef)`:
```js
function damage(entity, amount, type, ignoreDef=false) {
  const def = ignoreDef ? 0 : (entity.def || 0);
  const dealt = Math.max(1, amount - def);
  entity.hp -= dealt;
  spawnFloatingText(entity, '-' + dealt, type === 'fire' ? '#fb923c' : '#f87171');
  if (entity.hp <= 0 && entity === state.player) gamePhase = 'dead';
  return dealt;
}
```

## Architektura kodu

### AI_REGISTRY pattern

```js
// ── AI REGISTRY ───────────────────────────────────
const AI_REGISTRY = {
  coward:      aiCoward,
  zigzagger:   aiZigzagger,
  flyer:       aiFlyer,
  ambusher:    aiAmbusher,
  reviver:     aiReviver,
  phaser:      aiPhaser,
  thrower:     aiThrower,
  charger:     aiCharger,
  splitter:    aiSplitter,
  xpdrainer:   aiXpDrainer,
  juggernaut:  aiJuggernaut,
  mimic:       aiMimic,
  caster:      aiCaster,
  teleporter:  aiTeleporter,
  dragon:      aiDragon,
};

function enemyAct(e) {
  const fn = AI_REGISTRY[e.ai] || aiBasic;
  fn(e);
}
```

Każda `aiXxx(e)` jest niezależna i odpowiada za:
- decyzję o akcji (atak / ruch / spell / wait / flee)
- odjęcie odpowiedniego cost (ACTION_COST.MOVE/ATTACK/CHARGE/WAIT) z `e.energy`
- aktualizację stanu specjalnego encji (`e.state`, `e.charging`, `e.tpCounter`, `e.breathCd`, `e.zigzagPhase`)
- emisję particle / floatingText / addMessage

`aiBasic` = obecna logika `endTurn:1126-1136` jako fallback.

### Rozszerzenie spawnu w `populateFloor` (linia 778)

Zmiany:
1. **Filtrowanie po `floor`:** `def.floor[0] <= floor && floor <= (def.floor[1] ?? 99)`.
2. **Weighted pick:** zastąp `available[rand(0, len-1)]` weighted random po `def.weight`.
3. **Kopia AI-fields:** w `enemies.push({...def, energy:0, statusEffects:[], state:def.ai==='ambusher'?'HIDDEN':'ACTIVE', zigzagPhase:0, tpCounter:0, breathCd:0, charging:false, revived:false, vanished:false})`.
4. **Forced spawn dragon na floor 10:** po pętli pokoi, jeśli `floor === 10 && !enemies.some(e=>e.ai==='dragon')` → spawn dragon w ostatnim pokoju (przed schodami).
5. **Mimic-as-item:** po wygenerowaniu items, dla każdego z 10% szansą zamień na `state.enemies.push({...mimicDef, x:item.x, y:item.y, state:'DISGUISED', ...})` i pomiń item.
6. **Init `state.webTiles = []`** w `enterFloor` (linia ~925).

### Render

`ENEMY_DEFS.ch` → `ENEMY_DEFS.emoji`. W rendererze (sekcja "Enemies", przed graczem) zmień:

```js
ctx.font = `${T * 0.85}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
const renderEmoji = e.state === 'DISGUISED' ? e.disguise : e.emoji;
ctx.fillText(renderEmoji, sx + T/2, sy + T/2);
if (e.vanished) ctx.globalAlpha = 0.25;  // ghost faint
```

Mimic w stanie DISGUISED renderuj nawet gdy `awake=false` (skrzynia widoczna jak item).

### Hooks na atak gracza (linia ~979 `attackEnemy`)

Po kalkulacji damage, przed odjęciem hp:
```js
if (target.dodge && target.hp/target.maxHp < 0.5 && Math.random() < target.dodge) {
  spawnFloatingText(target, 'miss', '#94a3b8');
  return;  // bat dodge
}
if (target.vanished) return;  // ghost untargetable
```

## Integracja z planem 02 (turn engine)

Zależność: ten plan WYMAGA planu 02 (energy system, movement patterns, status effects, processWorld). Bez niego:
- `speed` w defs jest martwy
- `movement pattern` nie wpływa na ruch (linia 1147 nadal wycina diagonale)
- POISON/BLEED/FREEZE nie ma jak tikować

Konkretne punkty styku:

| Plan 02 produkuje | Plan 03 konsumuje |
|---|---|
| `getEffectiveSpeed(e)` | dragon FAST, golem CRAWL działają |
| `stepTowardWithPattern` | wszystkie AI używają |
| `getCandidateMoves(pattern, zigzagPhase)` | flyer/zigzagger/wraith |
| `addStatusEffect(entity, type, ticks, mag)` | snake POISON, orc BLEED, wizard FREEZE |
| `tickStatusEffects` | wraith REGEN-via-drain, golem immune |
| `processWorld` while-loop | dragon (FAST) i bat (FAST) wykonują 2 akcje w połowie cykli |
| `e.energy` | charger dwie tury (telegraph + leap) |

Kolejność w `processWorld`:
1. Dodaj energy.
2. Resurrect pass (skeleton): dla każdego dead skeleton z `revived=false`, sprawdź sąsiada — jeśli żywy ally w `reviveRange`, ustaw hp=maxHp/2, revived=true. (Przed filtrem dead.)
3. Główna pętla while → `enemyAct` (dispatch przez AI_REGISTRY).
4. Split pass (slime): dla każdego dead slime spawn dzieci.
5. Web emit pass: dla każdego dead spider (z `webOnDeath`) push `{x,y,ttl:30}` do `state.webTiles`.
6. `tickStatusEffects` + `tickWebTiles`.
7. Filtr `enemies = enemies.filter(e => e.hp > 0 || e.revived)` — uwaga: revived mają hp>0, więc zwykły filtr przechodzi.

`zigzagPhase` musi być na encji, nie globalnie.

## Integracja z planem 01 (FOV — wake on visible)

Plan 01: pochodnia → mały FOV gracza. Dla AI:

- `awake` flag już istnieje (linia 799) — `endTurn:1122` ustawia gdy `state.visible.has(key(e.x,e.y))`. To zostaje.
- **Ambusher specjalnie:** Spider `state='HIDDEN'` jest niezależne od `awake`. Spider może być widoczny dla gracza (visible), ale nadal HIDDEN — atakuje dopiero gdy gracz wejdzie w `ambushRange`. Renderuj go faint (alpha 0.6) gdy HIDDEN.
- **Mimic:** widoczny zawsze (jako 📦 — wygląda jak item), więc nie używa `awake`. State machine sterowana przez chebyshev do gracza.
- **Phaser (ghost):** może być w ścianie → niewidoczny dla `state.visible` (tile WALL nie jest visible). Render tylko gdy stoi na FLOOR/CORRIDOR.
- **Caster (wizard):** używa `lineOfSight(e, player)` przed castem — z małym FOV gracza, gracz może nie widzieć wizarda, ale wizard widzi gracza i strzela zza rogu. To zamierzone — torch tworzy tension.
- **Wake-up gating dla ranged AI:** thrower/caster nie strzelają zanim `awake=true`. `awake` ustawiany albo przez `state.visible` (gracz widzi wroga), albo wprowadź drugi flag `noticedPlayer` (wróg widzi gracza) — jeśli wróg ma LOS do gracza w obrębie 8 tiles → `awake=true`. To pozwala ranged AI zaskakiwać gracza poza jego małym FOV.

```js
// w processWorld przed pętlą AI:
for (const e of state.enemies) {
  if (!e.awake) {
    if (state.visible.has(key(e.x, e.y))) e.awake = true;
    else if (chebyshev(e, state.player) <= 8 && lineOfSight(e, state.player)) e.awake = true;
  }
}
```

## Edge cases

- **Mimic zniszczony zanim się ujawni:** jeśli gracz rzuci fireball na 📦 i zabije mimica w stanie DISGUISED — daj XP normalnie, log "It was a mimic!".
- **Skeleton revived w grobowcu:** jeśli wszystkie skeletons na floor martwe → ostatni sam siebie nie wskrzesi (`nearestAlly` szuka innego, range=3, predicate=`a !== e && a.ai==='skeleton' && a.hp>0`).
- **Slime nieskończony split:** pole `splitGen` na encji decrementuje (parent splitGen=2 → child splitGen=1 → grandchild splitGen=0 nie dzieli). Przy split: `child.splitGen = parent.splitGen - 1`. Bonus: `child.maxHp = floor(parent.maxHp * 0.5)`, `child.hp = child.maxHp`. Jeśli `splitGen === 0` → nie split.
- **Slime brak miejsca na split:** `placeChild` zwraca false → po prostu pomiń (lost child). Najwyżej spawnuje 0/1/2.
- **Ghost vanish vs. damage:** podczas vanish ghost ignoruje wszystkie hits (`if e.vanished return` w `attackEnemy` i w fireball/AoE). To "death prevention" — gracz musi go przeczekać.
- **Charger uderza w ścianę:** podczas leap iteruj kafelek po kafelku, jeśli `WALL` → stop + cancel charge + 1dmg orcu (recoil). Nieobowiązkowe ale fajne.
- **Dragon na floor 10 zabity przed innymi:** game continues normalnie, win triggered przez schody (linia 1104).
- **Web na schodach:** ttl decrementuje normalnie. Jeśli gracz zejdzie schodami → `enterFloor` resetuje webTiles=[].
- **Mimic i pickup:** gracz pressuje 'G' na 📦 — sprawdź czy to mimic (state.enemies). Jeśli tak → trigger reveal + free attack (jak chebyshev <= disguiseRange byłby spełniony, więc to powinno już samo zaiskrzyć w processWorld).
- **Wraith drain XP gdy player.xp==0:** dealt=0, no level-down (game design: nigdy nie cofamy poziomów, tylko XP w obrębie aktualnego levela).
- **Demon teleport na ścianę:** `randomFloorTileNear` filtruje tylko FLOOR/CORRIDOR. Jeśli brak wolnych → no-op, demon zostaje, atakuje normalnie.
- **Phaser w ścianie zabity:** musi być widoczny żeby atakować, ale w ścianie. Rozwiązanie: gdy ghost wybiera krok do ściany, sprawdź czy gracz jest adjacent — jeśli tak, atakuj zamiast ruchu. Inaczej idzie w ścianę i czeka 1 turę.
- **Multiple skeletons clustered:** każdy może wskrzesić raz — flag `revived=true` blokuje. Skeleton wskrzeszony nie wskrzesza innych dopiero po `revived`.
- **Thrower w korytarzu z gracza za rogiem:** LOS false → nie strzela, idzie do gracza orto.

## Acceptance criteria

- [ ] 15 typów potworów spawnuje się (każdy floor co najmniej 1 raz w ciągu 5 spawnów).
- [ ] Floor 10 ZAWSZE ma 1 dragona (forced).
- [ ] Mimic wygląda jak skrzynia 📦 dopóki gracz nie podejdzie ≤1 — wtedy reveal + atak.
- [ ] Snake hit → 3 turny `state.player.statusEffects` ma POISON × 2 dmg.
- [ ] Spider zabity → tile pod nim w `state.webTiles` przez 30 worldTicks; gracz/wrogowie wchodząc dostają SLOW.
- [ ] Skeleton zabity z innym żywym skeletonem w chebyshev ≤ 3 → wstaje 1× z 50% HP.
- [ ] Ghost przy <50% HP znika na 3 worldTicks (untargetable, niewidzialny).
- [ ] Goblin ranged 35% szansa rzucić kamieniem z dystansu 2-3 (animacja particle).
- [ ] Orc telegraph turn (widoczny czerwony znacznik kierunku) → następna tura skok 3 + bleed.
- [ ] Slime maxHp ≥ 8 zabity → 2 dzieci, każde z połową HP. Dzieci nie dzielą się dalej (gen=0).
- [ ] Wraith hit → player.xp -= 5, wraith.hp += 5, floating "-5 XP".
- [ ] Golem POISON ignorowany (immune).
- [ ] Wizard z dystansu 5 castuje fireball/frost; przy d ≤ 2 ucieka.
- [ ] Demon co 5 swoich akcji teleport blisko gracza + AoE r=2 × 6 dmg.
- [ ] Dragon ma cooldown 3 dla breath; cone 5 tiles po LOS, 8 dmg.
- [ ] Bat <50% HP unika 50% ataków (floating "miss").
- [ ] Rat <30% HP ucieka (porusza się dalej od gracza).
- [ ] Każdy `e.ai` zdefiniowany w `AI_REGISTRY` — runtime nie wpada w fallback `aiBasic` poza `awake=false` no-op.
- [ ] `enterFloor` resetuje `state.webTiles = []`.
- [ ] Render: emoji w fontach systemowych, fallback na `'❓'` jeśli brak emoji.
- [ ] Brak crash przy: skeleton solo na floor, slime split-pełna-mapa, ghost-w-ścianie, dragon-zabity-w-1-turze.

## Lokalizacje w pliku (`obsidian-depths/index.html`)

| Linia | Co | Zmiana |
|---|---|---|
| 611-622 | `ENEMY_DEFS` | replace całością — patrz wklejka JS wyżej |
| ~622 (po) | nowy blok | `AI_REGISTRY = {...}` po wszystkich `aiXxx` zdefiniowanych |
| ~660 (`newState`) | dodaj `webTiles: []` | nowe pole state |
| 778-813 (`populateFloor`) | weighted spawn + floor range filter + AI fields init + mimic-as-item + dragon force | rewrite całej funkcji |
| ~925 (`enterFloor`) | reset webTiles | `state.webTiles = []` |
| ~979 (`attackEnemy`) | hooks dodge/vanished | przed damage |
| 1115-1140 (`endTurn` / plan 02 `processWorld`) | dispatch AI | replace `enemyAttack/stepToward` blok przez `enemyAct(e)` przez `AI_REGISTRY` |
| 1142-1159 (`stepToward` / plan 02 `stepTowardWithPattern`) | używać movement pattern | plan 02 robi |
| ~1159 (po) | helpery | `lineOfSight`, `fleeDirection`, `nearestAlly`, `rangedAttackPlayer`, `tilesAround`, `coneTiles`, `randomFloorTileNear`, `damage`, `chebyshev`, `manhattan`, `sign`, `sameRowOrCol`, `placeChild` |
| ~1159 (po helperach) | AI funkcje | `aiCoward`, `aiZigzagger`, ..., `aiDragon`, `aiBasic` |
| Render enemies (ok. 1280-1320) | emoji font + alpha vanished/disguised | wklej `ctx.font` zmianę |
| Render after enemies | web tiles | osobna pętla po `state.webTiles` — symbol 🕸 z alpha = ttl/30 |
| Plan 02 `tickStatusEffects` | doklej WEB/BLEED/DRAIN_XP/FREEZE handling | rozszerz |

## Fazy implementacji

1. **Render emoji** + ENEMY_DEFS rewrite (jeszcze ze starym AI dispatch przez `aiBasic`). Smoke test: spawn wszystkich 15 typów, render się wyświetla.
2. **AI_REGISTRY szkielet** + `aiBasic` jako fallback dla każdego key. Wszyscy zachowują się tak samo.
3. **Helpery** (lineOfSight, fleeDirection, rangedAttack, ...). Unit test ad-hoc w konsoli.
4. **AI proste:** coward, juggernaut, mimic, thrower (one-shot zachowania).
5. **AI ze status:** zigzagger (POISON), charger (BLEED), caster (FREEZE+FIRE).
6. **AI z reaktywnością:** flyer (dodge), phaser (vanish), ambusher (state HIDDEN+web on death).
7. **AI multi-entity:** reviver (skeleton), splitter (slime).
8. **AI top-tier:** xpdrainer, teleporter, dragon.
9. **Forced spawns + mimic-as-item** w populateFloor.
10. **Edge case sweep + acceptance criteria check.**
