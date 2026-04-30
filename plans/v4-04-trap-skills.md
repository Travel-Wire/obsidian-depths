# v4-04 — Trap Handling Skills (Detection, Disarm, Scrolls, Light Step)

> **Game-Designer:** CCGS Studio
> **Status:** PLAN (zero implementation yet)
> **Pipeline step:** /plan (post /assumptions)
> **Predecessors:** plan 05 (cards), v3-02 (equipment tiers), 16-trap-effects.js (current trap engine)
> **Sister plans:** v4-01..v4-03 (assumed in-flight), v4-05 visibility skills
> **Module file (mono):** `obsidian-depths/index.html` (modular dev source: `src/*.js`)

---

## 1. Problem — Frustration With The Current Trap System

Aktualny system pułapek (zaimplementowany w `src/05-data-traps.js`, `src/07-dungeon.js:140-167`, `src/16-trap-effects.js`) ma jedną fundamentalną wadę: **gracz dowiaduje się o pułapce w momencie, w którym już na nią wszedł**. Pętla wygląda tak:

1. Pułapka spawn-uje się w pokoju lub na korytarzu z `revealed: false, triggered: false`.
2. Gdy tile pułapki trafia w `state.visible` (FOV gracza, recursive shadowcasting), kod w `src/07-dungeon.js:471-475` ustawia `trap.revealed = true`.
3. Ale **w tym samym ruchu** gracz się tam już może znaleźć, bo FOV jest *re-computed po* wykonaniu ruchu — a w `src/15-game-flow.js:85-86` mamy `const trap = state.traps.find(...)` i natychmiastowy `triggerTrap(trap)` jeśli stoisz na nieaktywowanej pułapce.

**Efekt:** Spike Trap robi 4-8 dmg minus DEF, Pit Trap zrzuca o piętro niżej (utrata ekwipunku w pokoju, cofa progress objective z v3-04), Explosive Rune robi 6-12 AoE 2, Poison Vent 5 tur trucia, Alarm Bell budzi wszystkie wrogi w radius 12. Player nie ma żadnego *counter-play* — jedynie *post-trauma awareness* ("teraz wiem że tam jest, pamiętam żeby nie wchodzić").

### Frustracja jest realna, nie subiektywna

- **Zero proaktywnego narzędzia** — w build cards (plan 05) brakuje kategorii "trap skills". Sharp Eyes daje +1 torch radius, ale to FOV, nie detekcja pułapek.
- **Zero reaktywnego narzędzia** — gdy pułapkę już wykryjesz (np. revealed pit trap z planu 05 ma warning na `src/15-game-flow.js:64-68`), jedyna opcja to "obejdź" lub "stoję na miejscu". Brak *dis-engagement*.
- **Brak konsumowalnych counters** — w `ITEM_DEFS` mamy tylko 2 scrolle (`fire_scroll`, `blink_scroll`), oba ofensywne. Żadnego utility scroll-a typu "pozbądź się problemu na mapie".
- **Pułapki są asymetrycznie OP w runach pechowych** — RNG dungeon-genu może postawić Pit Trap na korytarzu między pokojami z objective i stairs. Gracz traci piętro za nic, bez agency.
- **Build identity nie obejmuje "trap-aware"** — w 50-card catalog z planu 05 nie ma ani jednej karty na pułapki. Vampire Survivors / Hades pokazują że *świadomy sub-archetyp* ("uciekinier", "saper") podnosi replayability — my nie oferujemy nic.

### User feedback (cytaty)

> "Brakuje czegoś **na pułapki** — jakieś umiejętności"
> "Rozbrojenie, scrolle, inne tego typu"

User nazywa to wprost: **chcę agency**. Plan v4-04 dostarcza pełen counter-play layer, nie eliminując zagrożenia (pułapki nadal niebezpieczne) ale dając narzędzia.

---

## 2. Philosophy — "Counter-play, Not Just Avoidance"

Zasada przewodnia, którą będziemy egzekwować w każdym mechaniku w tym planie:

> **Pułapka zawsze pozostaje zagrożeniem.** Detekcja i disarm to **opcjonalne inwestycje** (kart, slotów, zwojów), które *redukują* ryzyko, ale nie *eliminują* go. Player musi nadal podejmować decyzje.

Operacjonalizacja:

1. **Detekcja kosztuje**: passive radius wymaga karty (slot na build) lub item-slotu (akcesorium kosztem stat-akcesorium). Bez inwestycji — pułapki działają jak teraz.
2. **Disarm zawodzi**: domyślnie 80% sukcesu. To nie 100%. Decyzja "rozbroić czy obejść" ma realny stake.
3. **Scrolle są rzadkie**: drop rate moderate (`weight: 3-4` jak fire_scroll), nie da się farmować. 1-2 trap-scrolle per run typowo.
4. **Active skills mają cooldown**: Light Step cd 12 (~1/2 piętra), Trapsense cd 8. Nie spam.
5. **Reward za skill-play**: 5💎 za udany disarm — drobny krystal-bonus, nie game-changer, ale *pozytywne wzmocnienie* zachowania "ja, gracz, podjąłem aktywną decyzję".

Wynik: trap-aware archetype (build skupiony na detection + disarm + scrolle) staje się **legit alternatywą** dla glass-cannon / tank / lifesteal builds z planu 05.

---

## 3. Mechanic Spec — Detection (Passive)

### 3.1. Karta `Sense Danger` (Rare, max 3 stacks)

Dodaj do `CARD_DEFS` w `src/04-data-cards.js`:

```js
{
  id: 'sense_danger',
  name: 'Sense Danger',
  emoji: '🕷️',
  tier: 'rare',
  category: 'perk',
  descriptionFn: (stack) => `Reveal traps in radius ${[3,5,7][stack-1]} (no FOV needed)`,
  maxStacks: 3,
  weight: 0.9,
  recompute: (player, state, stack) => {
    player.flags = player.flags || {};
    player.flags.trapDetectRadius = Math.max(player.flags.trapDetectRadius || 0, [3,5,7][stack-1]);
  },
}
```

**Stack curve:** I=3, II=5, III=7 (max 7 = ~typowy room shorter-axis radius, ale nie cały floor — must still explore).

**Trigger w runtime:** w pętli FOV (`src/07-dungeon.js:471-475`) dodaj drugą pętlę:

```js
// AFTER FOV reveal
const detectR = state.player.flags && state.player.flags.trapDetectRadius || 0;
if (detectR > 0) {
  for (const trap of state.traps) {
    if (trap.revealed || trap.triggered) continue;
    if (dist(state.player.x, state.player.y, trap.x, trap.y) <= detectR) {
      trap.revealed = true;
      trap.detectedBySkill = true; // visual flag — different glyph
    }
  }
}
```

**Edge case:** trap revealed przez detection (`detectedBySkill: true`) miga subtle red (sekcja 8). Trap revealed przez normal FOV miga normalnie.

### 3.2. Item `Detection Goggles 🥽` (Accessory, Uncommon+)

Dodaj do `ITEM_DEFS` w `src/03-data-items.js`:

```js
{ id:'detection_goggles', name:'Detection Goggles', emoji:'🥽', color:'#a78bfa',
  type:'accessory', slot:'accessory', minFloor:3, weight:2,
  tierBase: TIER.UNCOMMON,
  trapDetectBonus: 5,  // base bonus, scaled by tier
  desc: '+trap detection radius (tier-scaled)' }
```

**Tier scaling** (zgodnie z v3-02 `TIER_STATS = [1.00, 1.25, 1.50, 1.80, 2.20]`):

| Tier | Multiplier | Effective radius bonus |
|------|-----------|-----------------------|
| Common | 1.00 | +3 |
| Uncommon | 1.25 | +4 (round) |
| Rare | 1.50 | +5 |
| Epic | 1.80 | +5 |
| Legendary | 2.20 | +7 |

**Apply hook:** w `recomputeStats()` (znajduje się w karcie/items recompute — patrz `src/06-state.js`), dodaj sekcję dla equipped-accessory:

```js
const goggles = state.player.equipment.accessory;
if (goggles && goggles.def && goggles.trapDetectBonus) {
  const tierMult = TIER_STATS[goggles.tier || 0];
  const bonus = Math.round(goggles.trapDetectBonus * tierMult);
  state.player.flags = state.player.flags || {};
  state.player.flags.trapDetectRadius = (state.player.flags.trapDetectRadius || 0) + bonus;
}
```

### 3.3. Synergy: Sense Danger III + Goggles (Legendary) = radius 14

7 (card) + 7 (legendary goggles) = 14. To pół typowego floor-a. Dla gracza który zainwestował 3 sloty kart + 1 slot ekwipunku — *uzasadniona reward*. Nadal nie cały map (Reveal Map scroll robi to).

---

## 4. Mechanic Spec — Disarm (Active)

### 4.1. Klawisz `D` (disarm)

**Modyfikacja** `src/12-input.js` (dodać przy `keydown` listener po `useActiveSkill`):

```js
if (e.key === 'D' || e.key === 'Shift+d') { // capital D, lower-d kolikuje z dx=1
  e.preventDefault();
  attemptDisarm();
  return;
}
```

> **Note:** klawisz `d` w `KEY_MAP` jest już zajęty na `[1,0]` (move right). Używamy **`Shift+D`** lub re-bind na `X` (mniej kolizji). Kompromis: `X` (disarm) — neutralny i intuicyjny. Touch UI: dodać przycisk "Disarm" obok "Pick".

### 4.2. `attemptDisarm()` — funkcja w nowym `src/20-trap-skills.js` lub w 16-trap-effects.js

```js
function attemptDisarm() {
  // Find adjacent revealed undisarmed trap
  const px = state.player.x, py = state.player.y;
  const candidates = state.traps.filter(t =>
    !t.triggered && !t.disarmed && t.revealed &&
    Math.abs(t.x - px) <= 1 && Math.abs(t.y - py) <= 1 &&
    !(t.x === px && t.y === py) // nie pod stopami (safety)
  );
  if (candidates.length === 0) {
    addMessage('No trap to disarm adjacent.', 'info');
    return;
  }
  const trap = candidates[0]; // closest / first
  const intCards = countCardStacks('intelligence_card_id'); // synergy
  const successChance = 0.80 + 0.05 * intCards;
  const brickChance = 0.05;
  const roll = Math.random();
  state.player.energy -= ACTION_COST.WAIT; // 1 turn cost

  if (roll < brickChance) {
    state.player.hp -= 1;
    spawnFloatingText(state.player.x, state.player.y, '-1', '#ef4444');
    addMessage('You fumble! Trap triggers anyway.', 'combat');
    triggerTrap(trap);
  } else if (roll < brickChance + (1 - successChance)) {
    addMessage('Disarm failed — trap triggers!', 'combat');
    triggerTrap(trap);
  } else {
    trap.disarmed = true;
    state.player.crystals = (state.player.crystals || 0) + 5;
    spawnFloatingText(trap.x, trap.y, '+5💎', '#22d3ee');
    spawnParticles(trap.x, trap.y, 8, '#22d3ee', 1.5, 18);
    addMessage(`Disarmed ${trap.name}! +5 crystals.`, 'good');
  }
  processWorld(); // tick world after action
}
```

### 4.3. Disarmed trap state

Dodaj `disarmed: false` do trap-spawn w `src/07-dungeon.js:152, 164`:

```js
traps.push({ ...def, x: tx, y: ty, revealed: false, triggered: false, disarmed: false });
```

W `triggerTrap` w `src/16-trap-effects.js` na początku:

```js
function triggerTrap(trap) {
  if (trap.disarmed) return; // safety: disarmed trap never triggers
  ...
}
```

W `tryMove` w `src/15-game-flow.js:85-86`:

```js
const trap = state.traps.find(t => t.x === nx && t.y === ny && !t.triggered && !t.disarmed);
if (trap) triggerTrap(trap);
```

### 4.4. Lucky card synergy

Ze starego planu 05: `lucky` daje +5% crit per stack. Dodajmy *modulację disarm fail*:

```js
// in attemptDisarm, before roll:
const luckyStacks = (state.player.cards.find(c => c.id === 'lucky') || {}).stack || 0;
const luckBonus = luckyStacks * 0.02; // 2% per stack
const successChance = Math.min(0.95, 0.80 + 0.05 * intCards + luckBonus);
```

Lucky V (5 stack) = +10%. Sense Danger III + Lucky V = ~95% disarm. Cap at 95% — nigdy 100%, frustration buffer.

---

## 5. Mechanic Spec — Scrolls (Consumables)

### 5.1. Trzy nowe scrolle w `ITEM_DEFS`

```js
{ id:'disarm_scroll', name:'Scroll of Disarm', emoji:'📜', color:'#84cc16',
  type:'scroll', slot:null, effect:'disarm', value:0, minFloor:3, weight:3 },
{ id:'reveal_map_scroll', name:'Scroll of Reveal Map', emoji:'📜', color:'#a78bfa',
  type:'scroll', slot:null, effect:'reveal_map', value:0, minFloor:5, weight:2 },
{ id:'trap_mastery_scroll', name:'Scroll of Trap Mastery', emoji:'📜', color:'#fbbf24',
  type:'scroll', slot:null, effect:'trap_mastery', value:0, minFloor:7, weight:1 },
```

### 5.2. Effect handlers — rozszerz scroll handler w `src/15-game-flow.js`

Po liniach `205, 229` (gdzie są fireball/blink) dodać:

```js
} else if (item.effect === 'disarm') {
  // target adjacent trap → instant disarm, no fail
  const adj = state.traps.find(t => !t.triggered && !t.disarmed && t.revealed &&
                                     Math.abs(t.x - state.player.x) <= 1 &&
                                     Math.abs(t.y - state.player.y) <= 1);
  if (!adj) { addMessage('No revealed trap adjacent.', 'info'); return false; }
  adj.disarmed = true;
  state.player.crystals = (state.player.crystals || 0) + 5;
  spawnFloatingText(adj.x, adj.y, '+5💎 disarmed!', '#22d3ee');
  addMessage('Scroll of Disarm: trap neutralized.', 'good');

} else if (item.effect === 'reveal_map') {
  for (const t of state.traps) t.revealed = true;
  // additionally reveal map outline (already exists for explored — extend to wall outlines)
  for (let y = 0; y < state.map.length; y++)
    for (let x = 0; x < state.map[0].length; x++)
      if (state.map[y][x] === TILE.WALL) state.explored[y][x] = true;
  addMessage('Scroll of Reveal Map: all traps and walls revealed.', 'good');

} else if (item.effect === 'trap_mastery') {
  let count = 0;
  for (const t of state.traps) {
    if (t.disarmed || t.triggered) continue;
    if (dist(t.x, t.y, state.player.x, state.player.y) <= 5) {
      t.disarmed = true;
      t.revealed = true;
      count++;
    }
  }
  state.player.crystals = (state.player.crystals || 0) + 50;
  addMessage(`Trap Mastery: ${count} traps disarmed, +50💎 stolen.`, 'good');
  spawnFloatingText(state.player.x, state.player.y, '+50💎', '#fbbf24');
}
```

### 5.3. Drop rate balance

| Scroll | Min floor | Weight | Expected drops/run |
|--------|-----------|--------|---------------------|
| Disarm | 3 | 3 | ~1.5 |
| Reveal Map | 5 | 2 | ~0.6 |
| Trap Mastery | 7 | 1 | ~0.2 |

(Calculated assuming ~10 scrolls per run total drop, weighted vs fire_scroll w=4 + blink_scroll w=3.) Trap Mastery jest *lottery* item — czasem run ma, czasem nie.

---

## 6. Mechanic Spec — Trap-Immune Active Skills (Cards)

Dwie nowe karty *active* w `CARD_DEFS` (zgodnie z `active: { key, cooldown, fn }` schema z planu 05):

### 6.1. `Light Step` (Legendary, cd 12 turns)

```js
{
  id: 'light_step',
  name: 'Light Step',
  emoji: '🪶',
  tier: 'legendary',
  category: 'active',
  description: 'Active: 5 turns of trap immunity (cd 12)',
  maxStacks: 1,
  weight: 0.5,
  active: {
    key: 'q', // bound on pickup if Q free, else E
    cooldown: 12,
    fn: (state) => {
      state.player.flags = state.player.flags || {};
      state.player.flags.lightStepTurns = 5;
      addMessage('Light Step active — 5 turns trap immunity.', 'good');
      spawnParticles(state.player.x, state.player.y, 14, '#a78bfa', 1, 20);
    }
  }
}
```

**Implementation:** w `tryMove()` w `src/15-game-flow.js`, modyfikuj trap-trigger gate:

```js
const trap = state.traps.find(t => t.x === nx && t.y === ny && !t.triggered && !t.disarmed);
if (trap) {
  if (state.player.flags && state.player.flags.lightStepTurns > 0) {
    addMessage(`Light Step: glided over ${trap.name}.`, 'good');
    // do NOT mark as disarmed — re-armed for others (e.g., enemies)
  } else {
    triggerTrap(trap);
  }
}
```

W `processWorld()` decrement: `if (state.player.flags.lightStepTurns > 0) state.player.flags.lightStepTurns--;`

### 6.2. `Trapsense` (Rare, cd 8 turns)

```js
{
  id: 'trapsense',
  name: 'Trapsense',
  emoji: '👁️',
  tier: 'rare',
  category: 'active',
  description: 'Active: reveal traps in r=8, 50% auto-disarm (cd 8)',
  maxStacks: 1,
  weight: 0.8,
  active: {
    key: 'e',
    cooldown: 8,
    fn: (state) => {
      let revealed = 0, disarmed = 0;
      for (const t of state.traps) {
        if (t.triggered || t.disarmed) continue;
        if (dist(t.x, t.y, state.player.x, state.player.y) <= 8) {
          t.revealed = true;
          revealed++;
          if (Math.random() < 0.5) {
            t.disarmed = true;
            disarmed++;
          }
        }
      }
      addMessage(`Trapsense: revealed ${revealed}, disarmed ${disarmed}.`, 'good');
    }
  }
}
```

---

## 7. Mechanic Spec — Advanced (Optional — V4.04.1)

### 7.1. Re-arm trap

W `attemptDisarm()` extend: jeśli trap.disarmed && player adjacent → option to `re-arm`. Klawisz `R` (kolizja z anvil repair, użyć `Shift+R`):

```js
function attemptRearm() {
  const adj = state.traps.find(t => t.disarmed && !t.triggered && /* adjacent */);
  if (!adj) return;
  adj.disarmed = false;
  addMessage(`Re-armed ${adj.name}.`, 'info');
  state.player.energy -= ACTION_COST.WAIT;
}
```

**Tactical use:** rozbroić trap, uciec ścigającego enemy w korytarz, re-arm tuż przed nim → enemy triggers, takes dmg.

### 7.2. Throw item on trap

Klawisz `T` (throw mode). Player wybiera consumable z inventory + target tile (adjacent). Jeśli target tile = trap → trap triggers remote (player nie dostaje dmg, jeśli AoE i player w radiusie — i tak dostaje). Item zużywa się.

**Status:** OPTIONAL — implementacja w v4-04.1 jeśli czas. Core plan = bez tego.

---

## 8. UI / UX

### 8.1. Visual states (render w `src/13-render.js:354-385`)

| State | Glyph | Animation | Color |
|-------|-------|-----------|-------|
| Hidden | (not drawn) | — | — |
| Revealed (FOV) | trap.ch | pulsing red glow (alpha sin) | trap.color |
| Revealed (detection) | trap.ch | pulsing red glow + subtle purple aura | trap.color |
| Disarmed | trap.ch | static, no animation | gray (#64748b) |
| Triggered | trap.ch | static spent | dim trap.color |

**Pulsing red glow:** dodaj do render po linii 379:

```js
} else if (trap.revealed && !trap.disarmed) {
  // pulsing red — frame-driven sine
  const pulse = 0.5 + 0.5 * Math.sin(state.frameCount * 0.1);
  ctx.shadowBlur = 8 + pulse * 6;
  ctx.shadowColor = '#ef4444';
  // ... draw glyph
} else if (trap.disarmed) {
  ctx.fillStyle = '#64748b';
  // ... no glow
}
```

### 8.2. Detection radius aura

Gdy `state.player.flags.trapDetectRadius > 0`, render w `src/13-render.js` (player layer):

```js
if (state.player.flags.trapDetectRadius > 0) {
  const r = state.player.flags.trapDetectRadius * T;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(playerSX, playerSY, r, 0, Math.PI * 2);
  ctx.fillStyle = '#a78bfa';
  ctx.fill();
  ctx.restore();
}
```

Subtle (alpha 0.08) — nie oślepiające.

### 8.3. Scroll preview mode

Hover scroll w inventory (mouse over slot) → render highlight tiles affected:
- Disarm: 8 adjacent tiles outlined gold
- Reveal Map: nothing (full map effect, message tooltip)
- Trap Mastery: 5-radius circle outlined gold around player

Implementacja w `src/14-ui.js` — `onScrollHover(itemId)` → set `state.previewMode = {effect, range}`. Render layer rysuje preview.

### 8.4. Disarm UI feedback

- **Sukces:** green floating "+5💎 Disarmed", crystal-particle burst, sound (TBD).
- **Fail:** red flash, "Disarm failed!" message.
- **Brick:** `-1` floating + screen-shake 2.

### 8.5. Mobile

Dodaj button "Disarm" obok "Pick" w touch UI (`index.html` HTML). Visible only when adjacent trap revealed.

---

## 9. Balance

| Lever | Setting | Rationale |
|-------|---------|-----------|
| Sense Danger I/II/III radius | 3/5/7 | I = jeden tile ahead; III = ~half-room |
| Goggles tier scaling | 3 → 7 | Common useful but Legendary distinct |
| Disarm base success | 80% | 1-in-5 fail = real stake |
| Disarm brick chance | 5% | Rzadkie ale boli, nie spam |
| Lucky boost | +2%/stack, cap 95% | Build synergy bez 100% safety |
| Disarm reward | 5💎 | Drobne, motywuje, nie game-breaking |
| Light Step duration | 5 turns / cd 12 | ~1/2 piętra przejść bez stresu, potem ostrożnie |
| Trapsense radius / cd | 8 / 8 | Reasonable scout, regularny |
| Disarm Scroll drop | floor 3+, weight 3 | ~1.5/run |
| Reveal Map Scroll | floor 5+, weight 2 | Power tool, lottery |
| Trap Mastery Scroll | floor 7+, weight 1 | Late-game lottery, +50💎 reward |

**Crystal economy check:** baseline run gives ~50-100💎. Disarm 4-5 traps = +20-25💎. Trap Mastery scroll = +50. Total max ~+80💎 (~80-100% bonus dla trap-aware build). Materialne ale nie OP.

**Anti-frustration check:** Bez żadnej karty / itemu / scrolla, gracz dostaje pułapki jak teraz. Plan dodaje *opt-in counters*, nigdy nie nerf-uje pułapek samemu w sobie.

---

## 10. Integration With Other Plans

### 10.1. Plan 05 — cards

- 4 nowe karty (`sense_danger`, `light_step`, `trapsense`, ewentualnie `intelligence` jeśli nie ma) ekstendują 50-card catalog → 54.
- `Sharp Eyes` (z planu 05) synergy: Sharp Eyes III (+3 torch) + Sense Danger III (+7 detect) = build "Scout" archetype. Drafting probability comment w `cards-effects.js`.
- Active skill slot bind: Light Step + Trapsense to *active*, są w slocie Q/E. Conflict: max 2 active simultaneously per planu 05. Player wybiera świadomie.

### 10.2. v3-02 — equipment tiers

- Detection Goggles tier-scaled per `TIER_STATS` array (`src/03-data-items.js:8`).
- Affixy z `AFFIX_DEFS` mogą się rolować na goggles (dodać `accessory` slot do `affixes`). E.g. "Sharp Detection Goggles" = Sharp affix (+5% crit) + base trapDetect.

### 10.3. v3-04 — floor objectives

- Pit Trap zrzuca o piętro = pominięcie objective. Detection radius ma highest value w corridors → gracz nie traci progress. Plan v4-04 *redukuje frustrację* z planu v3-04.

### 10.4. v4-05 (assumed: visibility skills)

- Reveal Map scroll przecina się z visibility-clear effects. Koordynacja: Reveal Map = traps + walls; v4-05 visibility skills = enemies + items. Komplementarne.

### 10.5. 16-trap-effects.js — reuse triggerTrap

`triggerTrap(trap)` reused w 4 miejscach: walk-on, disarm-fail, disarm-brick, throw-on-trap. Zero duplication. Dodać guard `if (trap.disarmed) return;` na początku — jedyna modyfikacja.

---

## 11. Implementation — File:Line Map

| File | Line(s) | Change |
|------|---------|--------|
| `src/04-data-cards.js` | end of CARD_DEFS | +4 cards (sense_danger, light_step, trapsense, intelligence opcjonalnie) |
| `src/03-data-items.js` | end of ITEM_DEFS | +1 accessory (detection_goggles) + 3 scrolls |
| `src/05-data-traps.js` | line 5-11 | brak zmian (trap data unchanged) |
| `src/16-trap-effects.js` | line 5 (start triggerTrap) | guard `if (trap.disarmed) return;` |
| `src/16-trap-effects.js` | new function | `attemptDisarm()` (or split → `src/20-trap-skills.js`) |
| `src/07-dungeon.js` | 152, 164 | spawn traps with `disarmed: false` |
| `src/07-dungeon.js` | 471-475 (FOV reveal) | +detection-radius reveal pass |
| `src/15-game-flow.js` | 85-86 (tryMove) | guard disarmed + Light Step skip |
| `src/15-game-flow.js` | after line 229 (scroll handler) | +3 effect branches (disarm/reveal_map/trap_mastery) |
| `src/12-input.js` | line 92 area | +`X` key → attemptDisarm() |
| `src/13-render.js` | 354-385 (trap render) | +pulsing red, +disarmed gray, +purple aura |
| `src/14-ui.js` | new | scroll-hover preview |
| `src/06-state.js` | flags struct | +trapDetectRadius, +lightStepTurns |
| `index.html` | touch UI buttons | +Disarm button |
| `src/06-state.js` (recomputeStats) | recompute pass | +goggles bonus apply |

**LOC estimate:** ~250 added, ~30 modified. Single-PR feasible.

**Dev source split:** Jeśli osobny plik `src/20-trap-skills.js` — preferowane (separation of concerns). Build (`build.sh` jeśli istnieje) konkatenuje do `index.html`.

---

## 12. Acceptance Criteria

### 12.1. Core mechanics
- [ ] Wybierając kartę Sense Danger I, pułapki w radius 3 są revealed bez konieczności wejścia w FOV.
- [ ] Equipped Detection Goggles (Common) = +3 detect; Legendary = +7 detect; bonus dodaje się do karty Sense Danger.
- [ ] `X` na adjacent revealed trap → 80% sukces (visible w testach z 100 prób — 75-85% range).
- [ ] Disarmed trap nigdy nie triggers (test: walk-over, throw-on, enemy walking).
- [ ] Disarm-success daje +5💎 widoczne w UI, +5 w `state.player.crystals`.
- [ ] Disarm-fail trigger-uje pułapkę z full-effect.
- [ ] Brick (5% chance) trigger-uje pułapkę + odejmuje 1 hp player.
- [ ] Lucky V cap-uje success na 95% (100 testów → 90-95% range).

### 12.2. Scrolle
- [ ] Disarm Scroll drop floor 3+, instant-disarm adjacent trap, brak fail.
- [ ] Reveal Map scroll: wszystkie pułapki na floor `revealed=true`, walls explored.
- [ ] Trap Mastery scroll: pułapki w r=5 disarmed + 50💎 player.
- [ ] Brak adjacenta przy Disarm Scroll → message "no revealed trap adjacent", scroll *nie* zużywa się.

### 12.3. Active skills
- [ ] Light Step active: następne 5 ruchów player może chodzić po revealed undisarmed trap → no trigger, no damage.
- [ ] Light Step expires po 5 turach (counter w UI).
- [ ] Trapsense reveals + 50% auto-disarm w r=8 (test 100 traps → 40-60% disarm rate).
- [ ] Cooldown UI w stat-panel pokazuje pozostałe tury każdej active.

### 12.4. UI / UX
- [ ] Revealed undisarmed trap miga subtle red (sin-driven shadow blur).
- [ ] Disarmed trap = gray, no animation.
- [ ] Detection radius aura widoczna jako purple subtle circle (alpha 0.08) gdy karta/goggles aktywne.
- [ ] Hover Disarm Scroll w inventory → 8 adjacent tiles outlined.
- [ ] Hover Trap Mastery Scroll → r=5 circle outlined gold.
- [ ] Mobile: Disarm button visible gdy adjacent trap revealed; tap = attemptDisarm.

### 12.5. Integration
- [ ] Sharp Eyes III + Sense Danger III simultaneous = oba bonusy stack (no conflict).
- [ ] Detection Goggles "Sharp" affix roll = +5% crit + base +trapDetect (oba apply).
- [ ] Lucky stack dodaje się do disarm-success (testowalne via dev console manipulation).
- [ ] Z save/load: trap.disarmed serializuje się i restore-uje.

### 12.6. Balance signals (post-playtest)
- [ ] Run with no trap-skills: avg 2.5 trap dmg per floor (current baseline).
- [ ] Run with Sense Danger III + Goggles Legendary: avg 0.5 trap dmg per floor (5× redukcja).
- [ ] Disarm success/fail/brick distribution w trakcie 50 disarmów: ~80/15/5.
- [ ] Player feedback (1 hands-on session): "trap-aware build feels distinct" — qualitative.

### 12.7. Anti-regression
- [ ] Stara mechanika trap-trigger (walk-on undisarmed) działa identycznie jak przed planem.
- [ ] Pit Trap zrzuca o piętro tylko jeśli undisarmed (disarmed pit = visual only, walk-through safe).
- [ ] Existing `fire_scroll` / `blink_scroll` nadal działają (no regression w `src/15-game-flow.js:205, 229`).

---

## 13. Out of Scope (future v4-04.1)

- Re-arm trap mechanic (sekcja 7.1)
- Throw item on trap (sekcja 7.2)
- Trap-themed legendary item (np. "Saboteur's Toolkit" — passive disarm 1 trap/floor auto)
- Enemy types z trap-resistance (anti-cheese w late game)
- Sound effects (cały gier ma minimalny audio currently — separate effort)

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Detection radius zbyt OP | Med | High | Cap card max 7, goggles legendary +7, total 14 — ale w testach mierzyć "trap dmg per floor" |
| Disarm farming ekonomicznie | Low | Med | 5💎 per disarm × ~5 traps/floor = 25💎/floor max. To <50% baseline crystal-income. Acceptable. |
| Klawisz konflikt (D move vs D disarm) | High | Med | Rebind to `X` (uzgodnione w 4.1) |
| Save-game compat | Med | High | Migracja: jeśli `trap.disarmed === undefined` → false. Test: load save z przed-v4-04. |
| Light Step + pit trap edge case | Low | Low | Test: walk over pit z Light Step → glide, no descend. Pit usuwa się jeśli Light Step expire na pit-tile? **Nie** — pit nie disarmed, więc next walk triggers. |
| Trap Mastery scroll spam (player hoards) | Low | Low | Drop weight 1 + minFloor 7 → max ~1 per run. Self-balanced. |

---

## 15. Definition of Done

- All acceptance criteria z sekcji 12 pass.
- Code-review pass: zero V2/legacy paths (zgodnie z global pipeline rule).
- Manual playtest: 1 full run (10 floors) z trap-aware build, 1 full run bez. Trap-dmg metrics zgodne z balance section 9.
- Commit message: `v4-04: Trap handling skills (detect/disarm/scrolls/active)`.
- Plan-issue closed via `/close` z archiwum w `docs/archive/v4-04-trap-skills.md`.

---

**Word count estimate:** ~1450 words (plan content, excluding code blocks).
**Plan author:** Game-Designer @ CCGS
**Date:** 2026-04-30
