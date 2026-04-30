# Sprint Dashboard — Obsidian Depths

**Date:** 2026-04-30
**Coordinator:** Technical-Director (CCGS)
**Source:** 6 parallel teams (QA-Lead, QA-Tester, Game-Designer, Systems-Designer, Performance-Analyst, Lead-Programmer)

---

## Executive Summary

Gra jest **grywalna i stabilna** (replayability 7/10) z trzema klasami problemów:

1. **Critical bugs** — 1 confirmed bug (gamePhase='won' never set → floor 10 victory broken), 1 frustration trap (pit = silent floor descent)
2. **Balance outliers** — Dragon F10 borderline-unwinnable bez specific build, Mythril Body trywializuje durability subsystem, Pity counter za hojny (3-4 legendary/run)
3. **Mobile performance** — RISKY 25-45 FPS bez fixów; render-on-dirty + updateUI cache + roomGrid lookup = comfortable 50-60 FPS

---

## Ranked Priority List

### P1 — CRITICAL (must fix this sprint)

| # | Finding | Source | File:Line | Effort |
|---|---------|--------|-----------|--------|
| P1.1 | `gamePhase='won'` never written → floor 10 victory broken | code-review | `enterFloor` floor>=11 check | 5 min |
| P1.2 | Pit trap = silent floor descent w/o warning | playtest | `triggerTrap('pit')` | 15 min |
| P1.3 | Render-on-dirty: 80-95% CPU save on mobile | perf | `render()` rAF loop | 30 min |
| P1.4 | Dragon F10 unwinnable bez Berserker+Doppelganger | balance | dragon stats / boss room | 20 min (nerf HP/ATK or ramp player) |

### P2 — HIGH (next sprint at latest)

| # | Finding | Source | Effort |
|---|---------|--------|--------|
| P2.1 | Mythril Body trywializuje durability — cap effect to 50% reduction | balance | 10 min |
| P2.2 | Pity counter 7 → 10 leveli; pula legendary +5 kart (z Phoenix Vial item route) | balance | 30 min |
| P2.3 | updateUI() innerHTML → cached refs (6-10ms hitchy mobile) | perf | 45 min |
| P2.4 | getRoomAt → roomGrid Uint8Array O(1) | perf | 20 min |
| P2.5 | AI chase memory: open doors close after enemy passes (player can re-block) | playtest | 15 min |
| P2.6 | Tutorial overlay first run: drzwi `+`, anvil `R`, mimic warning, pit trap revealed-glyph wider | playtest | 60 min |

### P3 — CONTENT (sprint+1)

| # | Finding | Source | Effort |
|---|---------|--------|--------|
| P3.1 | Integrate 10 mobs + 10 items + 3 new AI types | content-pack | 90 min |
| P3.2 | Implement Biome 1 (Crypt) for floors 1-2 — color tint, spawn pool, boss room | biomes-gdd | 90 min |

### P4 — REFACTOR (long-term)

| # | Finding | Source | Effort |
|---|---------|--------|--------|
| P4.1 | Extract UI from logic — gameplay-code.md compliance from 1/8 to 7/8 | code-review | 1-2 dni |
| P4.2 | Add esbuild step → split sources to 9 modules, deploy single-file | code-review | 2-3 dni |
| P4.3 | Data-drive combat tunables (CFG_COMBAT) | code-review | 1 dzień |

---

## Source Reports

- `production/qa/balance-report.md` — 12 tuning recs, floor curve 1-10, risk register
- `production/qa/simulated-playtest.md` — 3 runs, replayability 7/10, top 5 frustrations
- `production/qa/perf-profile.md` — 10 hotspots, 5+ optimizations, mobile verdict
- `production/qa/code-review.md` — architectural findings, single-file no-go past 6000 lines
- `parallel-tasks/04-content-pack.md` — 10 mobs + 10 items spec, JS-ready
- `design/systems/biomes-system.md` — 5 biomes, 2300 słów, integration notes

---

## Implementation Sprint Plan

**Goal:** P1 + P2 in one implementation pass (~4h work).

**Skip for now:** P3 (content/biomes) and P4 (refactor) — wymagają osobnego sprintu po przetestowaniu P1+P2 wpływu na rozgrywkę.

**Acceptance gate:** smoke-check po implementation (HTML parse, JS check, HTTP 200, 1 manual playtest from user).

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Render-on-dirty psuje animacje (particles, sin pulse) | MED | rAF nadal działa dla animations queue, render only when `state.dirty=true` set explicitly |
| Mythril cap psuje stack synergii Resilient Aura | LOW | cap stosuje się tylko po multiplikacji wszystkich źródeł |
| Pity 7→10 + +5 leg kart razem może odwrócić problem (zbyt rzadkie) | MED | monitorować w simulated-playtest po patchu |
| Dragon nerf psuje "boss feel" | MED | preferuj player ramp (gwarantowany legendary card slot we floor 9 reward) zamiast nerf HP |

---

## Next Action

Dispatch single implementation agent for **P1 (4 fixy) + P2 (6 fixów) = 10 changes** w jednym commicie. Po skończeniu: smoke check + push do main.
