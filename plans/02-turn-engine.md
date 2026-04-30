# 02 — Turn Engine: Initiative, Speed & Movement Patterns

## Problem

Aktualny silnik turowy (linie 1115–1159 `endTurn`) działa: "gracz działa → wszyscy wrogowie działają raz → koniec". Brak zróżnicowania szybkości, brak innych wzorców niż ortogonalny (linia 1147 wycina przekątne), brak tikowych efektów statusu.

## Cel

Energy-based scheduler `processWorld()`:
1. Każdy aktor ma `energy` i `speed`.
2. Każdy input gracza = 1 wywołanie `processWorld()`.
3. Wrogowie procesują się malejąco po `energy` aż wszyscy mają `<100`.
4. Movement patterns to property encji.
5. Status effects to lista `{type, ticksLeft, magnitude}` na encji.

## Stałe (po CFG, ~linia 594)

```js
const SPEED = { CRAWL: 25, SLOW: 50, NORMAL: 100, FAST: 150, BLINK: 200 };
const ACTION_COST = { MOVE: 100, ATTACK: 100, WAIT: 100, PICKUP: 0, STAIRS: 0, CHARGE: 200 };
const MOVE_PATTERN = {
  ORTHOGONAL: 'ORTHOGONAL', DIAGONAL: 'DIAGONAL', OMNIDIRECTIONAL: 'OMNIDIRECTIONAL',
  KNIGHT: 'KNIGHT', LEAP: 'LEAP', ZIGZAG: 'ZIGZAG',
};
const STATUS = { POISON: 'POISON', REGEN: 'REGEN', SLOW: 'SLOW', HASTE: 'HASTE', FREEZE: 'FREEZE' };
```

## Rozszerzenia state

`newState()`:
- `worldTick: 0` w state
- `energy: 0, speed: 100, movementPattern: 'ORTHOGONAL', statusEffects: []` w player

`populateFloor()`:
- `energy: 0, speed: def.speed, movementPattern: def.movementPattern, statusEffects: [], zigzagPhase: 0` w każdym enemy

`ENEMY_DEFS` (linia 611-622) — dodać `speed` i `movementPattern`:
```
Rat:         FAST    + ORTHOGONAL
Bat:         FAST    + OMNIDIRECTIONAL
Skeleton:    SLOW    + ORTHOGONAL
Goblin:      NORMAL  + ORTHOGONAL
Orc:         SLOW    + ORTHOGONAL
Dark Knight: NORMAL  + OMNIDIRECTIONAL
Wraith:      FAST    + OMNIDIRECTIONAL
Demon:       NORMAL  + OMNIDIRECTIONAL
Lich:        NORMAL  + OMNIDIRECTIONAL
Dragon:      BLINK   + OMNIDIRECTIONAL
```

## Nowe funkcje

### `getCandidateMoves(pattern, zigzagPhase)`

Zwraca tablicę `[{dx,dy}]`:
- ORTHOGONAL: 4 osie
- DIAGONAL: 4 przekątne
- OMNIDIRECTIONAL: 8
- KNIGHT: 8 skoków L (±2,±1)/(±1,±2)
- LEAP: ±2 ortogonalnie
- ZIGZAG: alternuje DIAGONAL ↔ ORTHOGONAL po `zigzagPhase`

### `stepTowardWithPattern(ex, ey, px, py, pattern, zigzagPhase, otherEnemies)`

Pobiera kandydatów, filtruje (wall, occupied), wybiera minimalizujący dist. Zwraca `{x,y,newZigzagPhase} | null`. KNIGHT/LEAP sprawdza tylko punkt docelowy (przeskakuje ściany).

### `isAdjacentForAttack(att, tgt)`

Chebyshev <= 1 dla większości; Manhattan <= 1 dla ORTHOGONAL.

### `getEffectiveSpeed(entity)`

- FREEZE → 0
- SLOW → speed * 0.5
- HASTE → speed * 2
- Mnożniki stackują

### `processWorld()` (zastępuje `endTurn`)

```js
function processWorld() {
  state.worldTick++;
  state.player.energy += getEffectiveSpeed(state.player);
  for (const e of state.enemies) if (e.hp > 0) e.energy += getEffectiveSpeed(e);

  let anyActed = true;
  while (anyActed) {
    anyActed = false;
    const queue = state.enemies
      .filter(e => e.hp > 0 && e.energy >= ACTION_COST.MOVE)
      .sort((a, b) => b.energy - a.energy);
    for (const e of queue) {
      if (e.energy < ACTION_COST.MOVE) continue;
      enemyAct(e);
      anyActed = true;
    }
  }
  tickStatusEffects();
  state.visible = computePlayerFOV();
  markExplored();
  state.enemies = state.enemies.filter(e => e.hp > 0);
}
```

### `enemyAct(enemy)`

Logika AI z dawnego `endTurn` w osobnej funkcji. Przy każdej akcji odejmuje cost od `enemy.energy`.

### `applyStatusEffects(entity)` + `tickStatusEffects()` + `addStatusEffect(entity, type, ticks, magnitude)`

- POISON: `entity.hp -= magnitude` (death check dla gracza)
- REGEN: `entity.hp = min(maxHp, hp+magnitude)`
- SLOW/HASTE/FREEZE: nie tikuje hp, decrement only — efekt przez `getEffectiveSpeed`
- `addStatusEffect`: refresh jeśli już jest tego typu (max ticks/magnitude)

## Integracja

| Funkcja | Linia | Zmiana |
|---|---|---|
| tryMove | 954 | przed: jeśli `getCandidateMoves(player)` nie ma (dx,dy) → odrzuć; po: `player.energy -= MOVE; processWorld()` |
| attackEnemy | 979 | po: `player.energy -= ATTACK; processWorld()` |
| useItem | 1046 | `endTurn()` → `processWorld()` |
| endTurn | 1115 | zostaje jako alias wait: `player.energy -= WAIT; processWorld()` |
| stepToward | 1142 | rename + rozszerz → `stepTowardWithPattern` |
| populateFloor | 791 | dodać energy/speed/pattern/effects/zigzagPhase |
| enterFloor | 925 | `state.player.energy = 0` |
| inputCooldown + setInterval | 1590, 1635-1647 | USUŃ — flag `processingAction` zamiast tego |
| addMoveAnim | 911 | replace existing animation dla tej encji |
| canvas touchend | 1756 | dodać tap-to-tile (sign(dx), sign(dy)) → tryMove |
| render() offset | 1191 | zapisz do `state.renderOffset` |

## Touch tap-to-move

Tap na kafelek → oblicz `(tileX - player.x, tileY - player.y)` → normalize do `{-1, 0, 1}` per oś → `tryMove(normDx, normDy)`. Nie pathfinding — gracz kontroluje każdy krok. Swipe nadal działa jak teraz.

## Animacje vs logika

Logika instant, animacja "dogania":
- `processWorld` aktualizuje `e.x/y` natychmiast
- `addMoveAnim` zapisuje `fromX/fromY → toX/toY`, replace przy duplikacie
- Render interpoluje jeśli animacja istnieje

## Status effects mechanika

`tickStatusEffects()` raz per `processWorld()` — szybki wróg nie tikuje trucizny 2x.

## Globalny czas

`state.worldTick` += 1 per `processWorld()`. Wszystkie `ticksLeft` wyrażone w worldTick.

## Edge cases

- Gracz ginie od trucizny: `applyStatusEffects` ustawia `gamePhase = 'dead'`
- Wróg zabity przed turą: filtr `hp > 0` w queue
- LEAP/KNIGHT: sprawdzamy tylko cel, ignorujemy ściany na trasie (by design)
- ZIGZAG faza inicjalizowana 0, toggle po każdym ruchu (nie po ataku)
- BLINK wróg: while-loop daje mu 2 akcje per turę gracza
- Player z HASTE: trzeba zdecydować — albo +200 energy (więcej tur), albo `MOVE_COST=50` (mniej dla wrogów)
- OMNIDIRECTIONAL w korytarzu 1-tile: fallback do ORTHOGONAL gdy diagonale zablokowane

## Fazy

1. **Energy system bez zmian ruchu** — wszyscy NORMAL+ORTHOGONAL, ma działać identycznie + brak cooldownu
2. **Speed differentiation** — Bat=FAST, Skeleton=SLOW, Dragon=BLINK
3. **Movement patterns** — Bat/Wraith/Demon/Dragon → OMNIDIRECTIONAL
4. **Status effects** — POISON proof of concept
5. **Touch tap-to-move**

## Acceptance criteria

- 1 input = 1 akcja, nie ma auto-repeat poza browser keydown
- Bat (150) wykonuje 3 akcje na 2 tury gracza; Dragon (200) wykonuje 2 per turę gracza
- Bat atakuje z przekątnej; gracz ORTHO nie idzie po skosie
- POISON 5×2 dmg = łącznie 10 dmg, niezależne od speed
- worldTick rośnie o 1 per processWorld
- Tap na sąsiedni kafelek → ruch; tap na wroga → bump attack
- Animacje nie blokują input
