# v3 Master Plan — Obsidian Depths

**Date:** 2026-04-30
**Coordinator:** Technical-Director (CCGS)
**Source:** 6 planning agents (visibility / tiers / minimap / objectives / bosses / characters) + SPRINT-DASHBOARD (P1+P2 fixes)

## TL;DR

User raportuje 6 brakujących systemów. Każdy zaplanowany jako osobny dokument. **Wszystkie dzielą wspólny prereq: P1+P2 fixy z SPRINT-DASHBOARD muszą być pierwsze** (gamePhase='won' bug, render-on-dirty, Dragon nerf, roomGrid Uint8Array). Bez tego v3 wprowadza nowe regresje w starych bugach.

## 6 Plans Overview

| # | Plan | Path | Words | Effort | Dependency |
|---|------|------|-------|--------|------------|
| **v3-01** | Visibility (4-layer FOV gradient) | `plans/v3-01-visibility.md` | 2481 | 1-2 dni | Perf O1+O3+O5 (SPRINT P2) |
| **v3-02** | Equipment Tiers (Common→Legendary) | `plans/v3-02-equipment-tiers.md` | ~2200 | 2-3 dni | Balance tuning (SPRINT P1.4) |
| **v3-03** | Minimap (mobile + desktop dual-mode) | `plans/v3-03-minimap.md` | 1900 | 1 dzień | Brak |
| **v3-04** | Floor Objectives (10 typów + 5 boss-floors) | `plans/v3-04-floor-objectives.md` | 3200 | 2-3 dni | v3-05 (overlap ~80%) |
| **v3-05** | Boss System (6 bossów × 4 fazy) | `plans/v3-05-boss-system.md` | ~3000 | 3-4 dni | Biomes GDD jako reference |
| **v3-06** | Character Selection (6 klas) | `plans/v3-06-character-selection.md` | 3481 | 2 dni | Brak |

**Łącznie:** ~16,300 słów dokumentacji, ~11-15 dni implementacji.

## Dependency Graph

```
                  ┌─────────────────────────────┐
                  │ SPRINT-DASHBOARD P1+P2 fixy │  ← MUST DO FIRST
                  │ (gamePhase bug, perf, balance)│
                  └──────────┬──────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ v3-01    │         │ v3-03    │         │ v3-06    │
  │ Visibility│         │ Minimap  │         │ Characters│
  └──────────┘         └──────────┘         └──────────┘
        │                                         │
        │     ┌──────────────────────────────────┘
        │     │
        ▼     ▼
  ┌──────────────────────────┐
  │ v3-04 + v3-05 (MERGED)   │  ← OBJECTIVES + BOSSES razem
  │ Floor Objectives + Bosses │
  └──────────┬───────────────┘
             │
             ▼
        ┌──────────┐
        │ v3-02    │
        │ Tiers    │  ← Best efekt po bossach (Legendary drops mają sens)
        └──────────┘
```

## Recommended Implementation Sequence

### EPIC 0 — Foundation (must-have, ~1 dzień)
Zrobione przed v3 startem:
- SPRINT-DASHBOARD P1.1: gamePhase='won' bug fix
- SPRINT-DASHBOARD P1.3: render-on-dirty
- SPRINT-DASHBOARD P2.4: getRoomAt → roomGrid Uint8Array
- SPRINT-DASHBOARD P1.4: Dragon F10 nerf (HP scaling 0.10 + speed FAST not BLINK)
- SPRINT-DASHBOARD P2.1: Mythril Body cap 50%
- SPRINT-DASHBOARD P2.2: Pity counter 7→10

### EPIC 1 — Visibility + Minimap (parallel-safe, ~2 dni)
Niezależne od bossów/objectives. Można dostać szybkie wins:
- v3-01 Visibility 4-layer gradient → fix problemu user ("nie widać dookoła")
- v3-03 Minimap mobile + expand → fix brakującej minimapy

### EPIC 2 — Characters (independent, ~2 dni)
Można równolegle z EPIC 1:
- v3-06 Character Selection — 6 klas, screen na title

### EPIC 3 — Boss + Objectives (merged, ~4 dni)
Single epic bo overlap 80%:
- v3-04 + v3-05 razem
- 5 bossów na F2/4/6/8/10
- 10 typów objectives (slay_beast/find_key/survive/altar/cleanse/defeat_boss/race/loot/no_damage/champion)
- Stairs gating na completion
- HUD objective tracker

### EPIC 4 — Equipment Tiers (last, ~3 dni)
Po bossach — Legendary drops mają sens:
- v3-02 Tier system + 22 itemów remap + 5-7 unique Legendary
- Tier color borders + affix system

## Critical Decisions (already made by planning agents)

1. **Visibility:** 4-layer gradient (BRIGHT 2 / DIM 5 / EDGE 8 / fog), Sharp Eyes nie skalują BRIGHT (immersja)
2. **Tiers:** Identify mechanic OUT (redundant z color border). Consumables tier-EXEMPT.
3. **Minimap:** Dual-mode (compact + tap-expand). Dirty-flag pattern.
4. **Objectives:** Boss-floors są must (cut = cut całego planu).
5. **Bosses:** Dragon Flight Phase 3 jako capstone wszystkiego.
6. **Characters:** Berserker jako "systemowa innowacja" (jedyna klasa łamiąca turn engine).

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| EPIC 3 + 4 razem zniwelują przewidywalność (boss vs new tier loot RNG) | HIGH | EPIC 3 najpierw, monitoring 1 sprint, dopiero potem EPIC 4 |
| 4-layer FOV bez perf prereqs zabije FPS na mobile | HIGH | EPIC 0 musi być first |
| Character class power creep (Berserker vs Knight) | MED | balance pass po EPIC 2 |
| Boss arena layout wymaga generator refactor | MED | osobne `generateBossRoom()` funkcji |
| Objectives "find key" softlock jeśli player zniszczy chest | MED | zaplanowane fallback w v3-04 |

## Implementation Resourcing

**Single agent z mega-briefem** — tak jak w pierwszym refaktorze (5 planów → 1 mega agent → 4576 linii) — działa, ale długo (~1h+).

**Albo: 1 sequential agent per EPIC** — czystsze commits, lepsza recoverability, ~2h per EPIC × 5 EPICs = 10h pracy AI.

**Rekomendacja:** sekwencyjnie per EPIC. Po każdym epicu user testuje i daje GO/NO-GO.

## Next Action

Czekam na priorytety od usera:
- **A) Pełny v3 sequence** — ja koordynuję wszystkie 5 EPIC sekwencyjnie (10-15h pracy AI w tle)
- **B) Wybiórczy** — wybierasz 1-2 EPIC priorytetowe, reszta na później
- **C) Kosmetyka first** — tylko EPIC 1 (visibility + minimap) bo to user main pain point
- **D) Inne** — napisz priorytety
