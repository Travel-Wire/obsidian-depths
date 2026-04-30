# v3-03 — Minimap Redesign
Designer: UX-Designer + UI-Programmer (CCGS)
Target: `index.html` (single-file architecture, ~4700 lines)
Map dimensions: `CFG.MAP_W = 64`, `CFG.MAP_H = 44` (aspect ~1.45:1)

---

## Problem statement

Mobile gracze NIE WIDZA minimapy — `@media (max-width: 768px)` ustawia `#minimap-container { display: none }` (CSS line 407), a render loop ma `if (!isMobile) renderMinimap()` (line 4230). User feedback: *"muszę mieć też minimapę, brakuje mi minimapy"*. Dodatkowo desktop minimap (linia 4359) pokazuje TYLKO: terrain + enemies-in-FOV + stairs + player. **Brak**: drzwi, kowadeł, pułapek, itemów, bossów, oznaczenia obecnego pokoju, oraz brak tooltips/legendy. Re-render wykonuje się co klatkę z każdą zmianą — nie używa flagi `dirty`, więc skanuje pełne 64×44 = 2816 tile co tick (perf-hotspot na słabszych telefonach).

## User goals

- **Quick spatial awareness w trakcie walki** — gracz widzi gdzie są wrogowie i którędy może uciec bez przerywania flow.
- **"Where do I go next" affordance** — stairs marker ze stanem (gold = active, gray = locked by objective).
- **Mobile parity** — telefon dostaje to samo co desktop, w trybie compact + expandable.
- **Re-orientacja po blink/teleport** — gracz traci wątek pozycji, expanded minimap = "looking at the map" pause.

## Design specification

### Compact mode (default, always visible)

| Property | Desktop | Mobile |
|---|---|---|
| Size | 160×110 px (uplift z 120×80) | 80×55 px (zachowuje aspect 1.45:1) |
| Position | top-right, 16px margin | top-right, 8px margin pod safe-area |
| Tile pixel | ~2.5 px (desktop), ~1.25 px (mobile) | — |
| Label | "MAP" tekst | brak (oszczędność miejsca) |
| Toggle | klawisz **M** chowa/pokazuje | Long-press = toggle off |
| Activation | hover pokazuje tooltip per tile | tap → expand |

**Mobile placement conflict**: aktualnie `#stats-panel` na mobile rozjeżdża się na całą szerokość górną (`top: env(safe-area-inset-top); left: 6px; right: 6px`). Rozwiązanie: stats-panel zostaje, ale rezerwuje prawe 90px (`right: 96px` zamiast `right: 6px`), a minimap wstawia się w slot `top: 6px; right: 8px; width: 80px; height: 70px` (55px canvas + 12px label/padding). Stats-panel staje się "left-aligned" zamiast full-width.

### Expanded mode

**Trigger**: tap (mobile) / click (desktop) / klawisz **M** podwójny / long-press
**Layout**: fullscreen modal `#minimap-modal`, viewport 92% × 92%, centered, z-index 95 (poniżej card-modal=100, powyżej UI=10).
**Content**:
- Pełny canvas mapy w skali (auto-fit do min(viewport.w*0.86, viewport.h*0.78) zachowując aspect 64:44).
- **Legend** (right-side panel desktop, bottom drawer mobile) — lista 9 markerów z opisem.
- **Controls bar** (top): "✕ Close" / "1×" / "2×" / "Fit" / "Markers: All ▼"
- **Floor objective banner** (top center, jeśli istnieje): "Kill all monsters: 4 / 7" lub "Find the key" z key-icon-pulse.
- **Player coordinates** (bottom-left): "x:34 y:18 — Floor 3"

**Close**: X-button, klawisz **Esc** / **M**, tap-outside (overlay backdrop).

## Render layers

Renderowane w kolejności bottom-up, każda warstwa to oddzielna pętla po dirty-region (nie pełnym mapie, gdy możliwe).

### Layer 1 — terrain palette

| Tile | Color (compact) | Color (lit room) |
|---|---|---|
| WALL | nie rysowane (background szary widać) | — |
| FLOOR (corridor-out-of-room) | `rgba(80, 80, 95, 0.55)` ciemnoszary | — |
| CORRIDOR | `rgba(110, 110, 130, 0.7)` szary | — |
| FLOOR in lit room | — | `rgba(210, 170, 70, 0.75)` żółto-szary |
| Background | `rgba(8, 8, 16, 0.85)` z `backdrop-filter: blur(8px)` | — |

### Layer 2 — explored mask

- Tile **visible (in FOV)** → renderowany pełnym alpha (z layer 1).
- Tile **explored ale poza FOV** → alpha × 0.55, "memory tint" (cooler hue: dodaj `+5%` blue).
- Tile **unexplored** → nie rysowany (czarne tło prześwituje).

Implementacja: jeden pass, branch `state.visible.has(key)` per tile (ten kod już istnieje w renderMinimap).

### Layer 3 — special markers

**Rendering**: każdy marker = 1 ikona Unicode lub kropka renderowana `fillText` z fontem `9px JetBrains Mono` (compact) / `16px` (expanded).

| Icon | Meaning | Color | Visibility rule |
|---|---|---|---|
| `●` | Player | `#fbbf24` (yellow), pulsujący `sin(t/300)*0.3+0.7` alpha | always |
| `▼` | Stairs (active) | `#fbbf24` (gold) z 2px glow | tile explored |
| `▼` | Stairs (locked by objective) | `rgba(120,120,120,0.6)` szary | tile explored, objective != done |
| `⚒` | Anvil (unused) | `#f97316` orange | tile explored, anvil.used=false |
| `⚒` | Anvil (used) | `rgba(100,100,110,0.4)` greyed | tile explored, anvil.used=true |
| `+` | Door closed | `#facc15` yellow | tile explored |
| `'` | Door open | `rgba(160,160,170,0.7)` gray | tile explored |
| `!` | Trap (revealed) | `#ef4444` red | tile explored AND trap.revealed |
| `◆` | Item on ground | `#22d3ee` cyan | tile explored (visible from memory) |
| `◉` | Enemy in FOV | `#ef4444` red | enemy.hp>0 AND visible.has(key) |
| `👑` | Boss in FOV | `#a855f7` purple, glow `boxShadow 0 0 6px` | visible AND enemy.boss=true |

**Z-order w warstwie**: stairs < anvil < doors < traps < items < enemies < player < boss-pulse-overlay. Player zawsze na top.

### Layer 4 — current room highlight

- Wykryć `getRoomAt(player.x, player.y)` (helper istnieje, line ~4373).
- Wyrysować outline 1px `rgba(251, 191, 36, 0.5)` wokół bounding-box pokoju.
- Subtle inner-glow (`rgba(251,191,36,0.08)` fill na całej powierzchni pokoju).
- Cel UX: gracz natychmiast wie *"jestem TU"* nawet jak player-dot pulsuje w gęstym tłumie wrogów.

## Marker catalog (full table)

```
Icon  Meaning                  Color           Compact  Expanded  When-shown
─────────────────────────────────────────────────────────────────────────────
●     Player                   #fbbf24 pulse   3px dot   8px      always
▼     Stairs (active)          #fbbf24 gold    3px       12px     explored
▼     Stairs (locked)          #6b7280 gray    3px       12px     explored+!obj
⚒     Anvil (unused)           #f97316         2px       12px     explored
⚒     Anvil (used)             #555 dim        skip      8px      explored
+     Door closed              #facc15         2px       10px     explored
'     Door open                #9ca3af         1px       8px      explored
!     Trap (revealed)          #ef4444         2px       12px     explored+rev
◆     Item ground              #22d3ee         2px       10px     explored
◉     Enemy (visible)          #ef4444         2px       10px     in-FOV
👑    Boss (visible)           #a855f7 glow    3px       16px     in-FOV
```

Compact mode: pomija marker jeśli pixel-size <2 (ikony tylko jako kropki barwne) — readability tradeoff. Pełne ikony Unicode wyłącznie w expanded.

## Mobile interaction

**Tap-to-expand**:
- `touchstart` na `#minimap-container` → 150ms timer; jeśli w międzyczasie nie było `touchmove` o >8px → otwórz expanded.
- Visual feedback: scale(1.05) + brightness(1.2) na `touchstart`.

**Pinch-to-zoom (w expanded)**:
- Implementacja: dwa touchpointy, śledzone w state `state.minimapZoom = 1`. Distance ratio aktualizuje zoom w zakresie [0.5, 4.0]. Throttled do 60fps.
- Zoom anchor = midpoint between touches → translacja canvas tak, by ten punkt mapy pozostał pod palcami.

**Pan (w expanded, gdy zoom > 1)**:
- Pojedynczy palec drag → translacja canvas. Bound: nie wychodzić poza krawędzie mapy (clamp).
- `touchmove` z delta → `state.minimapPan = {x, y}`.

**Close**:
- ✕ button (top-right modal corner, 44×44px touch target).
- Tap on backdrop (poza canvasem).
- Klawisz `M` lub `Esc` (jeśli klawiatura podłączona przez Bluetooth).
- Auto-close: jeśli gracz wykona ruch (D-pad press) — dyskusyjne, defaultnie tak.

**Reset zoom**: double-tap canvas → `zoom=1, pan={0,0}`.

## Performance plan

**Render-on-dirty pattern** — minimap re-renderuje się TYLKO gdy zmieni się któraś z flag.

```js
state.minimapDirty = true;  // ustawiane przez:
                            //   - movePlayer() (po skutecznym move)
                            //   - updateFOV() (po nowych explored tiles)
                            //   - addItem/removeItem na ground
                            //   - door state change (open/close)
                            //   - trap.reveal()
                            //   - anvil.use()
                            //   - enemy spawn/death
                            //   - floor change (full clear + redraw)
```

**Render loop integration** (line 4230):
```js
if (state.minimapDirty || state.minimapExpanded) {
  renderMinimap();
  state.minimapDirty = false;
}
```

**Player-pulse** = osobny lekki path (overlay canvas albo CSS animation na DOM-element nad canvas). Wtedy puls nie wymusza pełnego re-render mapy.

**Cache eksplorowanego terrain** w offscreen canvas (`OffscreenCanvas` lub fallback hidden `<canvas>`):
- `state.minimapTerrainCache` — przechowuje warstwy 1-2 (terrain + explored mask).
- Invaliduje się tylko gdy `state.exploredCount` (counter) zmienił się od ostatniego render.
- Markers (warstwa 3-4) rysowane co tick na cache (cheap — ~10-30 markerów vs 2800 tile).

**Expanded mode**: pełny redraw co klatkę dozwolony (gracz w "menu", framerate gameplay nieistotny). Animations OK.

## Data schema additions

```js
// W initial state (linia ~1781):
state.minimapDirty = true;
state.minimapExpanded = false;
state.minimapZoom = 1;        // expanded mode
state.minimapPan = { x: 0, y: 0 };
state.minimapMarkerMode = 'all'; // 'all' | 'minimal' | 'off'
state.minimapVisible = true;     // toggle via 'M' key
state.minimapTerrainCache = null; // OffscreenCanvas

// Floor objective (v3-04 hook):
state.floorObjective = {
  type: 'killAll' | 'findKey' | 'reachStairs',
  progress: 0,
  target: 7,
  done: false
};
```

Reset przy `nextFloor()` i `newRun()`: `minimapDirty=true, minimapTerrainCache=null, minimapExpanded=false`.

## CSS spec

```css
/* Compact, desktop */
#minimap-container {
  position: absolute;
  top: 16px; right: 16px;
  background: rgba(8, 8, 16, 0.85);
  border: 1px solid rgba(255, 180, 60, 0.25);
  border-radius: 12px;
  padding: 10px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4),
              inset 0 1px 0 rgba(255,180,60,0.08);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
#minimap-container:hover { transform: scale(1.02); box-shadow: 0 6px 28px rgba(255,180,60,0.15); }

/* Compact, mobile — UNHIDE i scale-down */
@media (max-width: 768px) {
  #minimap-container {
    display: block !important;        /* override poprzedniego display:none */
    top: env(safe-area-inset-top, 6px);
    right: 8px;
    padding: 4px;
    border-radius: 8px;
  }
  #minimap-container canvas { width: 80px; height: 55px; }
  #minimap-label { display: none; }
  #stats-panel { right: 96px; }       /* zrób miejsce */
}

/* Expanded modal */
#minimap-modal {
  position: fixed; inset: 0;
  z-index: 95;
  display: none;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(6px);
  align-items: center; justify-content: center;
}
#minimap-modal.open { display: flex; }
#minimap-modal-content {
  width: 92vw; height: 92vh; max-width: 1200px;
  background: rgba(12, 12, 22, 0.95);
  border: 1px solid rgba(255,180,60,0.3);
  border-radius: 16px;
  padding: 16px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr 200px;
  gap: 12px;
}
@media (max-width: 768px) {
  #minimap-modal-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto auto;
  }
}
```

## Implementation file:line

- **CSS**: `index.html` linia 149-167 (zmień `#minimap-container`), 407 (usuń `display:none`, override scale), 411 (`#stats-panel { right: 96px }` dla mobile). Dodaj nowe selektory `#minimap-modal*` przed media-query.
- **HTML**: linia 869-872 — rozszerzyć o `<canvas id="minimap-pulse">` (overlay dla player dot). Linia ~915 (przed `<div id="touch-controls">`) — dodać `<div id="minimap-modal">...</div>` (modal markup z legendą).
- **JS state init**: linia 1781 (state object) — dodać 7 minimap fields.
- **renderMinimap()**: linia 4359 — przepisać. Sygnatura: `renderMinimap(expanded = false)`.
- **Render loop hook**: linia 4230 — zamienić `if (!isMobile) renderMinimap()` na warunek dirty-flag i wywołać dla mobile także.
- **Toggle hotkey**: linia 4456 (keydown listener) — dodać case `'m'/'M'` → toggle expanded.
- **Touch handlers**: linia ~4539 (mobile touch block) — dodać listenery na `#minimap-container` (tap) i `#minimap-modal` (pinch/pan/close).
- **Dirty-flag invalidation calls**: w `movePlayer`, `updateFOV`, `placeItem`, `removeItem`, `openDoor`, `closeDoor`, `revealTrap`, `useAnvil`, `spawnEnemy`, `killEnemy`, `nextFloor` — każdy ustawia `state.minimapDirty = true`.

## ASCII mockup

```
┌─ Compact desktop (160×110) ────────────────────┐
│  MAP                                           │
│  ┌────────────────────────────────────────┐   │
│  │░░░░ ███▓▓▓ ░░░             ◉           │   │
│  │░░ ⚒░░ ▓▓▓░░ +░░░  ◆                    │   │
│  │░░░░░░░░░░░░░░ '░░░░░░░░░░░░    ●  ░░  │   │  <- player
│  │░░░░░░░  !░░░░░░░░░░░░░░░░░░░░░░  ▼    │   │  <- stairs
│  │░░░ unexplored ░░░░░░░░░ unexplored      │   │
│  └────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘

┌─ Expanded mobile (full-screen) ────────────────┐
│ ✕                            Floor 3 — Kill 4/7│
│ ┌────────────────────────────────────────────┐ │
│ │                                            │ │
│ │     ░░░░ rooms + corridors ░░░░            │ │
│ │           ⚒          ◉ ◉                   │ │
│ │              ●                             │ │
│ │                          ▼                 │ │
│ │                                            │ │
│ └────────────────────────────────────────────┘ │
│ Legend:                                        │
│ ● You   ▼ Stairs   ⚒ Anvil   + Door closed    │
│ ◆ Item  ◉ Enemy    ! Trap    👑 Boss          │
│ [1×] [2×] [Fit]      [Markers: All ▼]          │
└────────────────────────────────────────────────┘

┌─ Compact mobile (80×55, top-right) ────────────┐
│ Stats panel (left-aligned)        ┌──────────┐ │
│ HP/XP/Floor/Kills                 │mini  ●  ▼│ │  <- tap = expand
│                                   └──────────┘ │
└────────────────────────────────────────────────┘
```

## Edge cases

- **Bardzo duża mapa**: MAP_W=64, MAP_H=44 jest fixed, więc skalowanie jest deterministyczne. Przy 80×55 px mobile: 1.25 px/tile. Markery ≤ 2 px, kollidują przy gęstym room — rozwiązanie: priority z-order (player > boss > enemy > stairs > item > door) i jeden marker per pixel.
- **Permadeath / nowy run**: `newGame()` musi `state.minimapTerrainCache = null` + `minimapDirty = true` + `minimapExpanded = false`. Inaczej cache z poprzedniego floor "ghostuje".
- **Anvil after use**: marker przełącza color (orange → gray), nie znika — gracz pamięta gdzie kuł. Floor change = clear.
- **Trap unrevealed**: NIE rysuje się (gameplay reason — wykrycie pułapki to reward za eksplorację).
- **Item picked up**: invaliduje dirty, marker znika. Item dropped przez gracza → marker wraca.
- **Enemy out of FOV**: nie rysuje się (no wallhack). Boss tak samo, niezależnie od minimap-mode.
- **Boss-fight floor**: 👑 z purpurową aurą `boxShadow 0 0 8px #a855f7` blur na osobnym overlay div nad canvas.
- **Player bardzo blisko stairs**: kolizja markerów ● i ▼ — player ma priority i przesunięcie -1px góra dla stairs (pseudo-stack).
- **Touch controls overlap**: stats-panel mobile jest `position: absolute, top: 6px, left: 6px, right: 96px`. D-pad i mobile-inv-row są `bottom`-anchored, brak konfliktu z minimap (top-right).
- **Klawisz M na mobile**: nieosiągalny — long-press na minimap = toggle visibility zamiast.
- **Objective marker pre-v3-04**: jeśli `state.floorObjective` undefined → renderuj stairs zawsze jako gold. Backward-compatible.

## Acceptance criteria

- [ ] Minimap działa na mobile (compact 80×55 + tap-to-expand fullscreen modal).
- [ ] Wszystkie 9 markerów widocznych: player, stairs (×2 stany), anvil (×2 stany), doors (×2 stany), trap, item, enemy, boss.
- [ ] Mobile expand obsługuje pinch zoom [0.5×, 4×] i pan z clamp.
- [ ] Dark glassmorphism style: `rgba(8,8,16,0.85)` + `backdrop-filter: blur(8-10px)` + gold border `rgba(255,180,60,0.25)`.
- [ ] Render-on-dirty: `minimapDirty` flag set tylko przy state changes (player move, FOV, item, door, trap, anvil, enemy, floor).
- [ ] Toggle on/off: klawisz `M` desktop, long-press mobile.
- [ ] Marker mode toggle: `all` / `minimal` (only player+stairs+enemy) / `off` (terrain only).
- [ ] Current room outline gold subtle.
- [ ] Stats-panel mobile nie nakłada się na minimap (`right: 96px`).
- [ ] Reset minimap state przy `newGame()` i `nextFloor()`.
- [ ] Tooltip on desktop hover (tile-info popup `tooltip-tile`).
- [ ] Floor objective banner w expanded modal (graceful no-op gdy v3-04 nieistnieje).
- [ ] Performance: render compact <1ms (cache hit), <5ms (cache miss/full redraw 64×44).
- [ ] No emoji-rendering crash na starych iOS (fallback ASCII `*` `>` `^` jeśli Unicode glyph brakuje).

## Estimated effort

- CSS rewrite + media-query unhide: **0.5h**
- HTML modal markup + legend + controls: **0.5h**
- `renderMinimap()` rewrite (4 layers, dirty-flag, cache offscreen): **2h**
- State schema + dirty-flag invalidation w 10 miejscach: **1h**
- Mobile touch handlers (tap, pinch, pan, close, double-tap reset): **2h**
- Hotkey M + marker-mode cycle + toggle UI button: **0.5h**
- Tooltip hover (desktop): **0.5h**
- Edge cases + objective hook stub: **0.5h**
- Manual QA mobile + desktop + landscape/portrait: **1h**
- **Total: ~8.5h** (1 dzień solid work, 1 vertical slice)
