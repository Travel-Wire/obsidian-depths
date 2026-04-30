# v4-06 — UI Redesign Mobile-First

## Problem

Aktualny UI ma:
- Wszystko visible naraz na desktop (stats panel, equipment bar, inventory bar, message log, minimap, cards row, active skills row) — overwhelming
- Mobile: stats panel zasłania pole gry, equipment bar pojawia się/znika
- Pickup zalewa ekran lootem (per v4-01 — to feedback root cause)
- Brak gestures (tylko D-pad + tap-to-move)
- Modals niespójne (card draft full-screen, character select inline, brak shop/inventory drawer)

## Design philosophy

**"Ambient awareness, on-demand depth."**

Critical info (HP, floor, objective, minimap) zawsze widoczne. Wszystko inne (stats, equipment details, inventory, cards, skills) — schowane za 1 gestem albo przyciskiem.

## Layout — Mobile (priority platform)

### Always visible
- **Top bar (50px height):**
  - Left: HP bar large + XP cienka pod nim (HP ratio + level number)
  - Center: Floor `F:N` + objective text (1 linia, 14px)
  - Right: Minimap compact 60×40 + crystal counter `💎 N`
- **Bottom dock (fixed bottom, 220px):**
  - Left: D-pad 4 kierunkowy (sticky, każdy 56×56px)
  - Center: 4 action buttons (Pick / Stairs / Wait / Repair) — każdy 48×48
  - Right: 3 favorite inventory slots + drawer button (📂)
- **Active skills strip (above dock, 50px):**
  - Q slot + E slot — emoji + cooldown overlay

### Hidden by default — gesture/button activated
- **Stats drawer** — long-press na HP bar → 70% bottom overlay, ATK/DEF/torch/crystals/cards summary
- **Inventory drawer** — swipe up od dock OR tap drawer button → 70% bottom overlay z 10 slots + 5 equipment slots + sell tab
- **Cards modal** — tap on cards icon w stats drawer → full-screen grid wszystkich pickup'ed cards, sortowane per tier
- **Shop modal** (v4-01) — auto-otwiera się po wejściu w shop tile → tabs Buy/Sell/Buyback/Repair

### Onboarding (first-run only)
4-step tutorial:
1. "Tap on a tile to move there" → arrow pointing to game area
2. "Tap on a monster to attack" → spawn dummy enemy w start room
3. "Swipe up for inventory" → arrow up from dock
4. "Walk to the stairs ▼ to descend" → highlight stairs

Stored in `localStorage.seenTutorial = '1'`. Skippable button "Skip".

## Layout — Desktop

### Always visible
- **Stats panel top-left collapsed** — HP bar + level + floor (1-line summary)
- **Minimap top-right** (z v3-03)
- **Cards row + active skills bar bottom** (current placement)

### On hover/click
- Stats panel hover → expand do full panel (HP/XP/ATK/DEF/torch/poison/crystals/passive status)
- Equipment bar — hover slot → tooltip
- Inventory bar — keyboard 1-9, 0 — direct use; hover slot → tooltip
- Cards row → click "All Cards" button → full-screen grid

### Settings drawer
- Top-right gear icon → modal:
  - Volume slider
  - Theme toggle (default amber / high-contrast white)
  - Font size (12/14/16)
  - Show damage numbers (on/off)
  - Auto-pickup crystals (on/off, default on)

## Pickup UX rework (responds to v4-01 feedback)

- Walk over item → **NO auto-pickup** (except crystals)
- Floating tooltip "G" key (desktop) / "Tap" badge (mobile) over walked-over item
- If 2+ items on tile: emoji + `+2` badge, pickup opens "Pick which?" mini-modal
- Drop pile (>3 items): single emoji 📦 + "+3" badge, modal with all items

## Modal system rework

| Modal | Trigger | Layout |
|-------|---------|--------|
| **Card draft** (v3-05) | level-up | Full-screen 3 cards |
| **Character select** (v3-06) | new run | Full-screen grid 6 cards |
| **Inventory drawer** (NEW) | swipe-up / 📂 button / `I` | Bottom 70% overlay |
| **Stats drawer** (NEW) | long-press HP / `Tab` | Bottom 70% overlay |
| **Shop modal** (v4-01) | enter shop tile | Center 80% modal w/ tabs |
| **Fusion modal** (v4-02) | enter anvil + tab Fuse | Center 70% modal |
| **All cards** (NEW) | tap All Cards | Full-screen grid |
| **Settings** (NEW) | gear icon | Center 50% modal |
| **Onboarding** (NEW) | first run | Full-screen tutorial |

Wszystkie zamykają się: tap outside, ESC, X button, swipe down (mobile drawers).

## Gestures (mobile)

| Gesture | Action |
|---------|--------|
| Tap on tile | Move toward / attack monster on tile |
| Long-press tile | "Look at" — info popup (mob stats / item / trap) |
| Swipe up | Open inventory drawer |
| Swipe down (in drawer) | Close drawer |
| 2-finger tap | Wait turn (alternative do Space/Wait button) |
| 3-finger tap | Quick options (settings/menu) |
| Pinch in | Zoom out (dev/debug — skipped MVP) |

## Visual hierarchy cleanup

- **Color palette:** dark navy `#05050a` + amber `#fbbf24` + danger red `#ef4444` + success green `#34d399`. NO more colors.
- **Glassmorphism subtle:** `rgba(8,8,16,0.85)` + `blur(6px)` (zmniejszone z `blur(10px)` dla mobile perf)
- **Typography:** Inter 400/600/700 only. No JetBrains Mono w UI (zostaje tylko dla numerów stats).
- **Animacje:** 200ms `ease-out` na wszystkich state changes. NO instant pop-ins (jarring).
- **Empty states:** "Inventory empty" placeholder slot, not blank squares.

## Accessibility

- Color-blind friendly: tier borders mają WZÓR (kropki/kreski) + kolor
- High-contrast toggle in settings
- Font size slider (12/14/16)
- Touch target min 44×44px (Apple HIG)
- Screen-reader: aria-label na wszystkich buttons
- Reduced motion: ustawia animation-duration: 0 dla `(prefers-reduced-motion: reduce)`

## MVP cuts (do późniejszej iteracji)

- **PINCH zoom** — out of MVP (tech debt, mobile only)
- **3-finger gesture** — out (rzadko używane, można zastąpić button)
- **Settings drawer** — kept (basic 5 options)
- **Onboarding** — kept (critical for new users)
- **All cards modal** — kept

## Implementation file:line

| File | Change |
|------|--------|
| `index.html` | nowe DOM: `#top-bar`, `#bottom-dock`, `#inventory-drawer`, `#stats-drawer`, `#shop-modal`, `#all-cards-modal`, `#settings-modal`, `#onboarding-overlay`, `#tutorial-step-1..4` |
| `index.html` CSS | full rewrite — mobile-first media queries, drawer animations (translateY transitions), backdrop-filter, gestures CSS |
| `src/12-input.js` | swipe-up handler, long-press handler (timeout 500ms), 2-finger wait, drawer toggle |
| `src/14-ui.js` | rewrite layout fns: `renderTopBar()`, `renderBottomDock()`, `renderStatsDrawer()`, `renderInventoryDrawer()`, `renderShopModal()`, `renderAllCardsModal()`, `renderSettingsModal()`. Drop legacy `updateUI` per-element calls. |
| `src/06-state.js` | `state.uiDrawerOpen = null` (none/'inventory'/'stats'), `state.settings = { volume, theme, fontSize, showDamageNumbers, autoPickupCrystals }` |
| `src/15-game-flow.js` | onboarding trigger w `initGame` jeśli `!localStorage.seenTutorial` |

## Acceptance criteria

- [ ] Mobile: HP bar + minimap + dock zawsze widoczne, NIC innego nie zasłania pola gry
- [ ] Mobile swipe-up → inventory drawer otwiera się płynnie (200ms)
- [ ] Mobile long-press na HP bar → stats drawer
- [ ] Mobile long-press na tile → "Look at" popup
- [ ] Mobile 2-finger tap → wait turn
- [ ] Desktop hover na stats panel → expand z 1-line summary do full panel
- [ ] Pickup wymaga `G` klawisz / tap (auto only crystals)
- [ ] Drop pile (>3 items) pokazuje single emoji + badge
- [ ] Cards row visible na desktop, hidden na mobile (jest w stats drawer)
- [ ] Wszystkie modals zamykają się tap-outside / ESC / X
- [ ] First run: 4-step onboarding pokazuje się, skippable
- [ ] Settings drawer: 5 opcji (volume / theme / font / dmg numbers / auto-pickup)
- [ ] High-contrast theme zmienia akcent z amber na biały
- [ ] Reduced motion respected
- [ ] Touch targets min 44×44px
- [ ] Mobile FPS ≥ 30 (po render-on-dirty z v3-vis-map prereq)

## Estimated effort

3-4 dni AI/dev pracy. Najtrudniejsze: drawer animations + swipe gestures (fizyka inertii). MVP cut pinch zoom + 3-finger gestures = ~2.5 dni.
