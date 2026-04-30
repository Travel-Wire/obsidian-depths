# Code Review — Obsidian Depths
Date: 2026-04-30
Reviewer: Lead-Programmer (CCGS)
Target: `/home/krzysztof/Projects/Personal/Roguelike/obsidian-depths/index.html` (4706 lines, single file)

## Executive Summary

Codebase has scaled far beyond `CLAUDE.md`'s claim of "~1700 lines" — actual is 4706. Single-file approach is past breaking point: global mutable `state` touched by ~150 functions, 49 DOM accesses entangled with game logic, zero tests, zero error handling, non-seedable RNG. Still readable thanks to good section comments, but each feature ships with a "PLAN 05" comment promising a refactor that never lands. **Priority: (1) extract data tables to JSON, (2) seedable RNG, (3) split render/UI from logic before line 6000.**

## Architecture Findings

### A1. Single-file 4706 lines — split candidates
**Status**: CRITICAL. CSS 10-842, HTML 842-940, JS 940-4706.
**Split along existing `// ───` headers:**
- `src/data/{enemies,items,cards,traps}.js` (~1100 lines combined)
- `src/engine/{fov,dungeon,turn,combat}.js`
- `src/ai/registry.js` + `aiXxx` functions
- `src/render/{world,ui,minimap}.js`
- `src/main.js`

**Effort**: HIGH (2–3 days). **Value**: HIGH. Use esbuild/rollup to preserve single-file deploy.

### A2. Global `state` object — ambient dependency
Declared line 1749; mutated by ~every function. No module accepts `state` as a parameter. Schema grew organically (`webTiles`, `tornadoes`, `allies`, `litRooms`, `pendingCardChoices`, free-form `flags` bag) — implicit + undocumented. Reentrancy issue: `triggerTrap` (pit, 3752) calls `enterFloor()` mid-`processWorld` — saved currently by `gamePhase` checks + defensive filters, but fragile (see A4).
**Fix**: Phase 1 — JSDoc typedef + `WorldState` factory. Phase 2 — pass `state` explicitly. Phase 3 — split into `engineState/renderState/uiState`. **Effort**: MED.

### A3. `gamePhase` state machine — likely bug
Declared 1750. `dead` written at 3580/2755/3802; `playing` at 4459/4468. **`gamePhase = 'won'` is never written anywhere** (grep verified) — only read. Floor 10 `descendStairs` likely doesn't transition. Recommend explicit `PHASE_TRANSITIONS` table + `setPhase()` with assertion. **Severity**: MED.

### A4. Init/reentrancy
`triggerTrap` pit (3752) calls `enterFloor()` mid-`processWorld` enemy loop. Defer floor transitions to end-of-tick via `state.pendingFloorChange`.

## Function-level Findings

### F1. `render()` is 417 lines (3817–4232)
Does camera, shake, terrain, torches, webs, items, traps, enemies, player, particles, floating texts, animation tick, vignette, UI update, minimap, mobile UI. Exceeds 40-line rule by 10×. Split into `renderTerrain/Entities/Effects/Overlay`.

### F2. `attackEnemy()` — 93 lines, 14 flag branches (2609–2701)
`swordMastery, marksman, berserker, maceCrusher, dragonsBlood, tactical, daggerDanceCharged, doppelganger, dualWield, lifestealPct`. Adding a perk = editing the function. **Open/Closed violation.** Replace with CARD_DEFS-registered `onAttack(ctx)` hooks. Same for `enemyAttack` (block/dodge/dmgReduction chain).

### F3. `executeActiveSkill(id)` — switch-by-string (1513–1632)
Five inline `if (id === 'whirlwind')` branches. Should live in CARD_DEFS as `active.execute(state)`. Cards already have `active.cooldown` — extend contract.

### F4. AI: partially data-driven
`AI_REGISTRY` mapping is good; but `aiCoward` 0.3 HP threshold (3221), `aiFlyer` 0.5 prob (3241), wake `chebyshev <= 8` (3611) are inline. Some tunables sit in ENEMY_DEFS (`reviveRange`), others in code. Inconsistent.

## Data Structure Findings

**D1.** `ENEMY_DEFS` + `AI_REGISTRY` are **good**: adding a mob with existing AI = 1 line.
**D2.** `ITEM_DEFS` schema drift: ad-hoc fields (`twoHanded, critChance, stunChance, ranged, magic, blockChance, lanternBonus, critBonus, dropBonus`) each consumed in one specific place. Add `effects:[{type,magnitude}]` array + central iterator.
**D3.** `CARD_DEFS` use `recompute(p,st,s)` cleanly; active skills bypass via `executeActiveSkill` switch — inconsistent.
**D4.** `TRAP_DEFS` `effect` strings dispatch in switch — same as D2.

## Magic Numbers Audit (top 10)
1. **Combat**: 0.5 second-strike (2679), 0.3 berserker HP threshold (2647), 1.3/1.5/2.0 damage multipliers (2643–2650).
2. **AI**: 0.3 cower (3221), 0.5 flyer prob (3241), 8 wake chebyshev (3611), 64 safety (3653).
3. **Render**: `T*4` torch glow (3987), `T*3` player aura (4151), 0.85 shake decay (3832), camera lerp 0.12 (3825).
4. **Status**: web TTL 30 (3705), tornado dmg 2/3 (1648), poison fallback 1.
5. **XP**: `xpNext * 1.5` (2767), +6 HP/level baked in (2771).
6. **UI**: minimap 120×80 (4360), 0.08 speckle prob (3927).
7. **Cards**: `pityCounter >= 7` (1301).
8. **Vignette**: 0.45 lit, 0.75 dark (4221).
9. **Mobile shift**: `ch*0.12` (3836).
10. **Reroll/skip heal**: 10% maxHp (1472).

CFG covers only map/room/inventory sizing. ~80% of tunables are inline literals. **Combat math, AI, visuals are not data-driven** — direct violation of `gameplay-code.md`.

## Coupling

- **Render ↔ state**: render reads ~15 state fields directly. No abstraction.
- **AI → combat**: AI calls `enemyAttack/damageEntity/gainXP/onEnemyKilled` directly. No event bus.
- **UI ↔ logic — VIOLATION**: hp≤0 triggers `gamePhase='dead'; showDeathScreen()` from logic (3580, 2755, 3802). 49 `getElementById/querySelector` calls scattered through logic. Direct violation of `gameplay-code.md` "NO direct references to UI code — use events/signals".

## Tests / Verifiability
- **Zero tests, zero `console.assert`, zero `try/catch`** in 4706 lines (grep verified).
- **Non-deterministic**: 26 raw `Math.random()` calls. `state.seed` is generated but only used cosmetically in `tileHash` for tile-color jitter. No seedable PRNG — regression/replay impossible.
- **Fix**: add `mulberry32(seed)` PRNG, expose `?seed=NNN` URL param. ~2h task.

## Error Handling
- `findCardDef`/`findItemDef` return `undefined`; some callers check (4330), others don't (`equipStartingGear` 2011 trusts ID). One typo = silent crash.
- No graceful degradation for missing canvas/DOM nodes.

## Tech Debt Register

| ID | Type | Location | Severity | Effort |
|---|---|---|---|---|
| TD1 | Doc drift | `CLAUDE.md` says 1700 lines, actual 4706 | MED | 5 min |
| TD2 | TODO debt | 18+ "PLAN 05" comments (1763, 1880, 1892, 1985, 2492, 2543, 2580, 2589, 2627, 2707, 2770, 2893, 3597, 3637, 4325, 4338, 4475, 4524). Hooks declared, never wired | HIGH | varies |
| TD3 | DRY | `state.animations.filter(a => a.entity !== e)` copy-pasted ~12× (3226, 3255, 3325…). Wrap in `replaceMoveAnim()` | LOW | 15 min |
| TD4 | Implicit contract | `state.player.energy -= ACTION_COST.X` scattered 30+ sites. Need `spendAction(actor, costKey)` | MED | 1h |
| TD5 | Duplication | Two parallel poison systems: legacy `state.player.poisoned` (3572) + `STATUS.POISON` (3549). Comment at 3571 admits it | MED | 1h |
| TD6 | Style | Mostly `function foo()`; arrows for callbacks. Acceptable | LOW | — |
| TD7 | Dead config | `FOV_RADIUS: 9, // legacy fallback (unused)` (955) | LOW | 1 min |
| TD8 | Unimplemented | `gainXP` comment "we can't detect bone enemies here" (2761) — perk dead | MED | varies |
| TD9 | Dead field | `state.items` declared (1781), never used | LOW | 1 min |

## Quick Wins (1-day refactors)
- [ ] 1. Add seedable PRNG (`mulberry32`) + replace `Math.random()` site-by-site. Unlocks determinism. ~2h.
- [ ] 2. Extract magic numbers from `attackEnemy`/AI functions into a `BALANCE = {…}` block at top of file. ~3h.
- [ ] 3. Wrap repeated `state.animations.filter(a => a.entity !== e); addMoveAnim(...)` into `replaceMoveAnim(e, ox, oy)`. ~30min.
- [ ] 4. Delete dead code: `state.items`, `FOV_RADIUS`, legacy `state.player.poisoned`. ~1h.
- [ ] 5. Refresh `CLAUDE.md` line counts + section table. ~15min.
- [ ] 6. Add `console.assert` smoke checks for required CARD/ITEM ids on boot (`assert(findItemDef('rusty_dagger'))`). ~30min.
- [ ] 7. Introduce `setPhase(next)` with allowed-transitions assertion. ~30min.
- [ ] 8. Add `won` transition in `descendStairs` past floor 10 (likely a bug). ~15min.
- [ ] 9. Wrap DOM lookups in cached refs at boot (`UI = { hpFill: getElementById(...), … }`). ~1h.
- [ ] 10. Promote `damageEntity` to single source of truth for HP changes (currently bypassed in trap/AOE code).

## Strategic Refactors (1-week+)
- [ ] 1. Extract `ENEMY_DEFS`, `ITEM_DEFS`, `CARD_DEFS`, `TRAP_DEFS` to JSON files (data-driven; loadable; modder-friendly).
- [ ] 2. Module split with esbuild bundle — 8 files listed in A1, single-file deploy preserved.
- [ ] 3. Event bus (`emit('enemyKilled', e)`) — decouple AI/render/UI from direct calls. Enables achievements, sound, analytics later for free.
- [ ] 4. Card-effect contract: every card declares `{ recompute?, onAttack?, onDamaged?, onTurn?, active? }`. Removes flag-soup from `attackEnemy`/`enemyAttack`.
- [ ] 5. Test harness: a headless Node runner that loads engine modules sans DOM, runs `processWorld` with seeded RNG, asserts invariants over 100-floor runs.

## Coding Standards Compliance (per `.claude/rules/gameplay-code.md`)
| Rule | Status | Notes |
|---|---|---|
| Gameplay values from config | FAIL | ~80% inline literals |
| Delta time for time calcs | N/A | turn-based; render uses `time` param consistently — OK |
| No direct UI refs from logic | FAIL | 49 DOM accesses, gameplay calls `showDeathScreen` directly |
| Clear interface per system | FAIL | No interfaces; everything mutates global `state` |
| Explicit state-machine transitions | FAIL | `gamePhase` has implicit transitions, no table |
| Unit tests for logic | FAIL | Zero tests |
| Doc comments per design doc | PARTIAL | "PLAN 05" markers exist; no per-function docs |
| No singletons for state | FAIL | `state` and `gamePhase` are module-level singletons |

Compliance score: **1/8 passing**.

## Verdict
- **Continue single-file: NO** beyond the next milestone. Acceptable up to ~6000 lines if a build step is added (preserves "open index.html" UX). Without that, growth past 5500 will collapse readability.
- **Refactor priority (top 3):**
  1. **Extract data tables to JSON** (ENEMY/ITEM/CARD/TRAP) — unlocks modding and is mechanical work.
  2. **Decouple UI from logic via event bus** — fixes the worst standards violation; enables tests.
  3. **Seedable PRNG + smoke-test harness** — unlocks regression testing before complexity grows further.
