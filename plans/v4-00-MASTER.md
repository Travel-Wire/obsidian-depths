# v4 Master Plan — Obsidian Depths

**Date:** 2026-04-30
**Source:** 6 v4 planning agents responding to user playtest feedback
**Goal:** odpowiedzieć na frustrację "loot zalewa, brak pętli, brak narzędzi"

## TL;DR

Ekonomia jest fundamentem reszty. **Drop economy MUSI iść pierwsza** — bez niej fusion/UI nie mają sensu (nie ma czego fusionować, nie ma czego chować). Reszta układa się w naturalny pipeline.

## 6 v4 Plans

| # | Plan | Path | Words | Effort |
|---|------|------|-------|--------|
| **v4-01** | Drop Economy + Crystals + Shop (-70% drop, 💎 currency, 🛒 shop) | `plans/v4-01-drop-economy.md` | 3513 | 2-3 dni |
| **v4-02** | Item Fusion (2× same → upgrade, preview-lock, brick 5%) | `plans/v4-02-fusion.md` | 1800 | 2 dni |
| **v4-03** | Wider Corridors (1-3 tile + hubs, T/+ junctions) | `plans/v4-03-wider-corridors.md` | 3241 | 1-2 dni |
| **v4-04** | Trap Skills (disarm `X` key, scrolls, 4 cards, goggles) | `plans/v4-04-trap-skills.md` | 3922 | 2 dni |
| **v4-05** | Life Management (heal economy + temp HP + Cleric sustain) | `plans/v4-05-life-management.md` | 2935 | 2 dni |
| **v4-06** | UI Redesign Mobile-First (drawers + gestures + onboarding) | `plans/v4-06-ui-redesign.md` | 1400 | 3 dni |

**Total:** ~16,800 słów dokumentacji, ~12-14 dni implementacji.

## Dependency graph

```
                    ┌──────────────────┐
                    │ v4-01 ECONOMY    │  ← FIRST (foundation)
                    │ drops -70% + 💎  │
                    └────┬─────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
    ┌─────────────┐  ┌──────┐  ┌─────────┐
    │ v4-02 FUSION│  │v4-03 │  │ v4-04   │
    │ items+anvil │  │CORR  │  │ TRAPS   │
    └─────────────┘  └──────┘  └─────────┘
                         │
                         ▼
                    ┌──────┐
                    │v4-05 │  ← HP rework używa Cleric, scrolls
                    │ HP   │
                    └──┬───┘
                       │
                       ▼
                    ┌──────┐
                    │v4-06 │  ← UI redesign captures all new flows
                    │ UI   │  (shop modal, fusion modal, trap disarm key)
                    └──────┘
```

## Implementation sequence (rekomendowane)

### EPIC v4-A — Foundation (2-3 dni)
**v4-01 Drop Economy** — pierwsza, bo zmienia FUNDAMENT (drops, crystals, shop). Wszystko inne dotyka tego.

### EPIC v4-B — Content systems (parallel-safe, 4-5 dni)
**v4-02 Fusion + v4-03 Corridors + v4-04 Traps** w worktrees:
- Fusion → `03-data-items.js`, `06-state.js`, `12-input.js`, `14-ui.js`
- Corridors → `07-dungeon.js` (isolated)
- Traps → `04-data-cards.js`, `16-trap-effects.js`, `12-input.js`

Konflikty w `12-input.js` (klawiszy F vs X) i `14-ui.js` (modals) — rozwiązywalne przy merge.

### EPIC v4-C — Polish (3 dni)
**v4-05 HP** — używa Cleric class, fusion, scrolls — najlepiej PO v4-B.

### EPIC v4-D — UI rebuild (3 dni)
**v4-06 UI** — capture'uje WSZYSTKIE nowe flows (shop, fusion, traps, HP overlay). Najlepiej OSTATNIE.

## Critical decisions (already made by planners)

1. **v4-01:** drop cut 70%, run total 1150💎 = 1 Legendary + consumables (perfect tightness)
2. **v4-02:** preview-then-lock random outcomes, brick 5%, max +5 level, Legendary blocked
3. **v4-03:** widths 30/50/15/5% (W1/W2/W3/HUB), T/+ junctions, BFS connectivity guarantee
4. **v4-04:** counter-play not avoidance, klawisz `X` (NIE D), 4 cards + 1 accessory + 3 scrolls
5. **v4-05:** wariant A++ — heal reform + temp HP shields + Cleric "rzadko ale stale" sustain
6. **v4-06:** mobile-first, drawers + gestures, 4-step onboarding, MVP cut pinch zoom

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Drop cut 70% może frustrować nowych graczy | HIGH | Cleric daje pasywny sustain, F1-F3 ma większą gęstość drops, tutorial wyjaśnia |
| Wider corridors zwiększają render area na mobile | MED | Render-on-dirty z v3-vis-map nadal kluczowe — bez tego FPS poniżej 30 |
| Fusion brick 5% odpadnie testerom | MED | Tier-skip safety-valve (3× identical → wyższy tier) ratuje pechowców |
| UI swipe gestures konfliktują z swipe-to-move (canvas) | HIGH | Gestures TYLKO na drawer/modal, nie na canvas |
| v4 razem to ~14 dni → user się zniechęci | HIGH | Implementacja per EPIC w worktrees parallel + commit każdy = visible progress |

## Strategie szybkiego dostarczenia

**Pełny v4 w 2-3h pracy AI:** worktrees + parallel agents per EPIC + MVP cuts (jak v3 sprint). Sprawdzona strategia.

Albo selektywnie:
- **MVP only:** v4-01 (drops/shop) + v4-06 (UI) → 1.5-2h, dramatically lepsza UX
- **Content focused:** v4-02 (fusion) + v4-03 (corridors) → 1h, więcej depth gameplay
- **All-in:** wszystkie 6 → 3-4h pracy AI w worktrees

## Recommended next action

**Strategy: Full v4 in worktrees (jak v3 sprint, ~3h AI work):**

1. Branch off main
2. 4 worktrees:
   - `wt-v4-economy` (v4-01)
   - `wt-v4-content` (v4-02 + v4-03 razem — fusion + corridors)
   - `wt-v4-systems` (v4-04 + v4-05 razem — traps + HP)
   - `wt-v4-ui` (v4-06)
3. 4 EPIC leads parallel
4. Sequential merge: economy → content → systems → ui (najambitniejsze ostatnie)
5. Smoke test po każdym merge
6. Push do main → GH Pages auto-deploy

Czekam na "go" albo selekcję EPICs.
