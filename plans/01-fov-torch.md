# 01 — FOV / Torch / Pułapki

## Problem

Aktualnie (linia 587) `CFG.FOV_RADIUS: 9` — gracz widzi ~9 kafelków we wszystkich kierunkach,
co przy mapie 64x44 oznacza widoczność prawie całego pokoju od razu. Nie ma napięcia eksploracji,
potwory są widoczne z daleka, pułapek nie ma, wszystkie komnaty są równo oświetlone.

Shadowcasting w `computeFOV` (linia 823) jest poprawny algorytmicznie — zostaje bez zmian.
Zmienia się tylko to, CO podajemy jako `radius` i co rysujemy gdy tile nie jest w `visible`.

## Cel

1. Domyślny promień widoczności: 3 kafelki (efekt pochodni).
2. Komnaty oznaczone jako `lit=true` są w pełni widoczne gdy gracz w nich stoi — cały room wchodzi do `visible` bez konieczności shadowcastingu po każdym kafelku osobno.
3. Pułapki: 5 typów, ukryte dopóki nie wejdą w FOV, aktywacja przy wejściu gracza.
4. Levelup: perk "Większa pochodnia" (+1 do `torchRadius`, max +3).
5. Minimap: pokazuje tylko odkryte kafelki (bez zmian logiki — już tak działa, ale dodajemy kolor dla lit-rooms).
6. Vignette: mocniejszy efekt ciemności poza FOV.

## Zmiany w CONFIG

```js
// linia 582 — sekcja CONFIG
const CFG = {
  MAP_W: 64,
  MAP_H: 44,
  TILE: 28,
  MAX_FLOOR: 10,
  TORCH_RADIUS: 3,          // bazowy promień pochodni
  TORCH_RADIUS_MAX: 6,      // max po perkach (baza + 3 levele)
  LIT_ROOM_CHANCE: 0.20,    // 20% pokoi fully-lit
  LIT_ROOM_MIN_PER_FLOOR: 1,
  LIT_ROOM_AREA_THRESHOLD: 35,
  TRAP_CHANCE_PER_ROOM: 0.35,
  TRAP_CHANCE_CORRIDOR: 0.12,
  ROOM_MIN: 5, ROOM_MAX: 12, ROOM_MIN_H: 4, ROOM_MAX_H: 9,
  INV_SIZE: 5, MSG_MAX: 5,
};
```

Nowe pola w `player` (newState, linia 668):
```js
torchBonus: 0,   // bonus z perka (+1 per level perka, max 3)
poisoned: 0,     // tury trucizny
```

Nowe pola w `state`:
```js
traps: [],
litRooms: new Set(),
```

## Nowe TRAP_DEFS

Po sekcji ITEM_DEFS (~linia 632):
```js
const TRAP_DEFS = [
  { type: 'spike',     name: 'Spike Trap',      ch: '^', color: '#c2410c',
    dmg: [4, 8],   minFloor: 1, msg: 'Spikes shoot up! {dmg} damage.', aoeRadius: 0 },
  { type: 'pit',       name: 'Pit Trap',        ch: 'o', color: '#1e1b18',
    dmg: [0, 0],   minFloor: 2, msg: 'The floor gives way!', aoeRadius: 0, effect: 'fall' },
  { type: 'explosion', name: 'Explosive Rune',  ch: '*', color: '#f97316',
    dmg: [6, 12],  minFloor: 3, msg: 'A rune detonates!', aoeRadius: 2, effect: 'aoe' },
  { type: 'poison',    name: 'Poison Vent',     ch: '%', color: '#4ade80',
    dmg: [2, 4],   minFloor: 4, msg: 'Poison gas erupts!', effect: 'poison', poisonTurns: 5 },
  { type: 'alarm',     name: 'Alarm Bell',      ch: '!', color: '#fbbf24',
    dmg: [0, 0],   minFloor: 2, msg: 'Alarm rings!', aoeRadius: 12, effect: 'alarm' },
];
```

## Generator dungeonu — lit rooms + traps

W `generateDungeon` po pętli rooms:
- Każdy room dostaje pole `lit: false`
- Iteruj rooms, każdy ma `chance = LIT_ROOM_CHANCE` (+ 0.30 jeśli area > threshold; -0.10 jeśli room 0 albo last)
- Jeśli litSet.size < min, dolosuj jednego (nie room 0, nie last)
- Generuj traps per room: `TRAP_CHANCE_PER_ROOM` szans, losuj typ z `availableTraps`, losuj pozycję wewnątrz (nie krawędź)
- Korytarzowe traps: osobna pętla po `TILE.CORRIDOR`, tylko spike+pit
- Return `{..., litSet, traps}`

W `enterFloor`:
- `state.litRooms = dungeon.litSet`
- `state.traps = dungeon.traps`
- `state.player.poisoned = 0`

## FOV — nowe funkcje

```js
function effectiveTorchRadius() {
  return CFG.TORCH_RADIUS + state.player.torchBonus;
}

function getRoomAt(x, y) {
  for (const r of state.rooms) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
  }
  return null;
}

function computePlayerFOV() {
  const visible = computeFOV(state.player.x, state.player.y, effectiveTorchRadius());
  const room = getRoomAt(state.player.x, state.player.y);
  if (room && room.lit) {
    for (let dy = 0; dy < room.h; dy++)
      for (let dx = 0; dx < room.w; dx++)
        visible.add(key(room.x + dx, room.y + dy));
    // ściany obwodowe
    for (let dy = -1; dy <= room.h; dy++)
      for (let dx = -1; dx <= room.w; dx++) {
        const tx = room.x + dx, ty = room.y + dy;
        if (state.map[ty]?.[tx] === TILE.WALL) visible.add(key(tx, ty));
      }
  }
  return visible;
}
```

Wszystkie wywołania `computeFOV(...)` w grze zamień na `computePlayerFOV()`.

## Pułapki — runtime

Trap object:
```js
{ ...def, x, y, revealed: false, triggered: false }
```

W `markExplored` (linia 945) — po pętli dodaj:
```js
for (const trap of state.traps) {
  if (!trap.revealed && !trap.triggered && state.visible.has(key(trap.x, trap.y))) {
    trap.revealed = true;
  }
}
```

W `tryMove` (linia ~970), po `state.player.x = nx; state.player.y = ny;`:
```js
const trap = state.traps.find(t => t.x === nx && t.y === ny && !t.triggered);
if (trap) triggerTrap(trap);
```

`triggerTrap(trap)`:
- spike: dmg = max(1, rand(min,max) - def), HP-=dmg, message
- pit: jeśli floor < MAX_FLOOR → state.floor++, enterFloor; inaczej -5 HP
- explosion: dmg gracz + AoE radius 2 wokoł, budzi i uszkadza wrogów
- poison: state.player.poisoned = 5
- alarm: budzi wszystkich wrogów w radius 12 (wake = e.awake = true)

W `endTurn` (linia 1115) — poison tick na początku:
```js
if (state.player.poisoned > 0) {
  const dmg = rand(2, 4);
  state.player.hp -= dmg;
  state.player.poisoned--;
  spawnFloatingText(state.player.x, state.player.y, `-${dmg}`, '#4ade80');
  if (state.player.hp <= 0) { gamePhase = 'dead'; showDeathScreen(); return; }
}
```

## Levelup — torch upgrade

W `gainXP` (linia 1011), po `state.player.level++`:
```js
if (state.player.level % 3 === 0 && state.player.torchBonus < 3) {
  state.player.torchBonus++;
  addMessage(`Your torch burns brighter! (radius: ${effectiveTorchRadius()})`, 'level');
  spawnParticles(state.player.x, state.player.y, 20, '#f59e0b', 2.5, 35);
}
```

## Rendering

**Terrain (linia 1202):**
- W `if (isVisible)` — sprawdź czy lit-room → `baseColor = colorVariant(COLORS.litRoomFloor, ...)`
- Jeśli gracz W lit-room: `lightMult = max(0.55, 1 - pd/20*0.3)` (płaska jasność)
- Inaczej: `lightMult = max(0, 1 - (pd/(effectiveTorchRadius()+1))^1.5) * 0.6`
- Explored-not-visible: `lightMult = 0.08` (było 0.12 — ciemniej)

**Traps (po ground items, ~linia 1309):**
- Jeśli `triggered`: rysuj glyph z alpha 0.35
- Jeśli `revealed && !triggered`: rysuj glyph z pulsacją (sin) + shadowBlur
- Inaczej: skip

**Vignette (linia 1446):**
- Dynamicznie: `playerInLit ? alpha=0.45 : alpha=0.75`

**Minimap:**
- Lit-room visible: `rgba(200, 160, 60, 0.8)`
- Lit-room non-visible: `rgba(120, 90, 30, 0.5)`

**HTML stats panel (linia ~509):**
```html
<div class="stat-row"><span class="stat-label">TORCH</span><span class="stat-value" id="s-torch">3</span></div>
<div class="stat-row"><span class="stat-label">POISON</span><span class="stat-value" id="s-poison">—</span></div>
```

W `updateUI`: aktualizuj `s-torch` i `s-poison`.

## Edge cases

- Wejście do lit-room z korytarza → cały pokój ujawnia się w 1 turze (dramatic reveal)
- Pit na floor 10 → -5 HP zamiast `enterFloor(11)`
- Explosion/alarm AoE używa Euclidean dist bez LoS (przenika ściany — celowe)
- enterFloor resetuje `poisoned = 0`
- `getRoomAt` jest O(n*rooms) per render — akceptowalne (~39k iteracji/klatka)

## Acceptance criteria

- Gracz widzi dokładnie 3 kafelki we wszystkich kierunkach w normalnym pokoju
- Wejście do lit-roomu → cały pokój widoczny w tej samej turze
- Po levelup poziom 3 → torchBonus=1, widoczność=4
- Każde piętro ma min 1 lit-room
- Pułapka nieodkryta nie rysuje glypha; w FOV → revealed=true; po wejściu → triggered + efekt
- Minimap pokazuje lit-rooms ciepłym żółtym
- Vignette wyraźnie ciemniejszy poza lit-rooms
- enterFloor reset poison
- Pit trap floor 10 nie wywołuje enterFloor(11)

## Lokalizacje w pliku

| Element | Linia | Akcja |
|---|---|---|
| CFG | 582 | nowe stałe |
| COLORS | 598 | litRoomFloor, traps |
| TRAP_DEFS | ~632 | nowa sekcja |
| newState | 668 | traps, litRooms, torchBonus, poisoned |
| generateDungeon | 694 | lit assignment + traps |
| computeFOV | 823 | bez zmian |
| nowe: effectiveTorchRadius/getRoomAt/computePlayerFOV | przed 823 | dodaj |
| enterFloor | 925 | wire traps + litRooms |
| markExplored | 945 | reveal traps |
| tryMove | ~970 | trigger trap |
| gainXP | 1011 | torch upgrade |
| endTurn | 1115 | poison tick |
| render terrain | 1202 | lit colors + lightMult |
| render traps | ~1309 | nowa sekcja |
| vignette | 1446 | dynamiczny |
| updateUI | 1474 | torch/poison |
| renderMinimap | 1503 | lit color |
| HTML #stats-panel | ~509 | nowe stat-row |
