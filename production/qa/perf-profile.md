# Performance Profile — Obsidian Depths
Date: 2026-04-30
Analyst: Performance-Analyst (CCGS, static analysis)

## Methodology
Static code analysis of `index.html` (4706 lines, single-file HTML5 Canvas). No live profiling — all numbers are estimates derived from operation counts, common JS engine costs, and Canvas2D draw-call overhead at 60 FPS.

## Performance Budget Targets
- Desktop: 60 FPS @ 1080p (16.67 ms per frame)
- Mobile: 30–60 FPS @ varied DPI
- Memory: < 100 MB after a 30-min run

---

## Hotspots (priority order)

### H1. `render()` runs at full rAF rate even when nothing changes
**Location**: line 3817–4232.
**Issue**: Turn-based game, but `requestAnimationFrame(render)` redraws the entire scene every ~16 ms. Outside particle/animation/screen-shake activity, the scene is identical between frames. ~95% of frames could be skipped.
**Cost**: full pipeline cost paid 60×/s — terrain pass + UI rebuild + minimap + DOM writes ≈ 6–10 ms/frame on desktop, 12–25 ms on mid-tier mobile.
**Fix**: dirty-frame flag — only render when `state.particles.length > 0 || state.animations.length > 0 || state.floatingTexts.length > 0 || state.screenShake > 0 || state.cameraMoving || dirty`. Skip render otherwise.
**Estimated savings**: 80–95% CPU reduction during idle exploration; mobile thermal throttling avoided. ~+30 FPS headroom on mobile.

### H2. `getRoomAt()` linear scan per visible tile per frame
**Location**: line 2354–2360, called at lines 3859, 3878 (twice per tile inside the terrain pass) plus 4219 (vignette) and 4373 (minimap).
**Issue**: O(rooms) linear scan. 8–14 rooms per floor × ~600 visible tiles × 2 calls/tile = ~14k–17k room iterations/frame. The minimap pass adds ~2,800 more calls per frame for explored tiles.
**Cost**: ~1.5–3 ms/frame on desktop, 4–7 ms on mobile. Hot inner loop, no early-out for "tile not in any room".
**Fix**: precompute `state.roomGrid = Uint8Array(MAP_W*MAP_H)` during `generateDungeon()` storing roomIndex+1 (0 = no room). O(1) lookup.
**Estimated savings**: 1.5–2.5 ms/frame.

### H3. `updateUI()` rebuilds entire DOM every frame via innerHTML
**Location**: line 4256–4357, called from `render()` at line 4229 — i.e. **every rAF frame**.
**Issue**: 5 separate `innerHTML` assignments (message-log, equipment-bar, inventory-bar, cards-row, active-skills-row) plus 8+ `document.getElementById().textContent` writes. Each `innerHTML` reflow forces full layout. ~10 inventory slots + 5 equip slots + cards rebuilt 60×/s though state changes only on player turn.
**Cost**: 2–4 ms/frame desktop, 6–12 ms mobile (DOM layout/parse cost dominates on mobile WebKit).
**Fix**: only call `updateUI()` after `processWorld()` and after item/stat changes. Cache DOM refs, mutate `textContent`/`style.width` in place; only rebuild slot HTML on inventory change.
**Estimated savings**: 2–4 ms/frame on desktop, 6–10 ms on mobile.

### H4. Minimap full-map redraw every frame
**Location**: `renderMinimap()` line 4359–4399.
**Issue**: iterates all 64×44 = 2,816 tiles every frame, plus `getRoomAt()` per tile, plus `state.visible.has()` per tile. Minimap only changes when player moves or FOV updates.
**Cost**: ~1.5–3 ms/frame.
**Fix**: render minimap to an offscreen canvas only when explored/visible/floor changes; blit cached image each frame. Add player+enemy dots as overlay.
**Estimated savings**: ~2 ms/frame.

### H5. Per-tile `Math.sin(time * ...)` for torch flicker, anvil pulse, trap pulse
**Location**: 3894 (per-tile torch flicker inside terrain loop), 3949 (anvil), 3986 (torch glyph), 4068 (trap pulse).
**Issue**: line 3894 runs `Math.sin()` for **every torch × every visible tile within radius 6** per frame. With 4–6 torches per floor and ~600 visible tiles, that's 2k–3k `Math.sin` calls/frame just for ambient lighting.
**Cost**: ~0.5–1.5 ms/frame.
**Fix**: precompute one flicker value per torch per frame (`torch._flicker = ...` at top of render), reuse in inner loop. Same for global anvil/trap pulse: compute once, reuse.
**Estimated savings**: ~1 ms/frame.

### H6. `state.visible` is a `Set<string>` keyed by `"x,y"` strings
**Location**: `key()` helper, used in shadowcasting (line 2425), lit-room reveal (2370/2384), markExplored split (2526), render visibility checks (3854, 3983, 4013, 4028, 4052, 4087, 4372, 4387).
**Issue**: every `visible.has(key(x,y))` allocates a new string ("12,7") and runs string hashing. Render loop calls this for every visible tile + every enemy + every item + every torch + every trap = ~700–1200 string allocations/frame. Heavy GC pressure.
**Cost**: ~1–2 ms/frame steady state, plus GC spikes (5–15 ms hitches every few seconds).
**Fix**: encode as single int `y * MAP_W + x` and use `Uint8Array(MAP_W*MAP_H)` flag buffer. Same for `state.explored` is already typed (good), but visible is not.
**Estimated savings**: ~1.5 ms/frame and elimination of GC hitches.

### H7. `state.animations.find()` called per enemy per frame
**Location**: line 4090 (enemies), 4141 (player).
**Issue**: O(animations × enemies) lookup. Usually animations.length is small (1–3) so OK, but `.find()` allocates closure per call. With 10+ active enemies on screen, this is 10+ array scans per frame.
**Cost**: <0.5 ms but contributes to GC churn from arrow-fn closures.
**Fix**: store `entity.activeAnim` reference directly when adding animation, clear when complete. Avoids array scan and closure alloc.
**Estimated savings**: ~0.3 ms + GC reduction.

### H8. Particle update + render combined — no early-out for off-screen
**Location**: line 4168–4188.
**Issue**: every particle is rendered with `ctx.save()`, `shadowBlur=4`, `arc()`, `fill()`, `restore()`. Shadow blur is one of the most expensive Canvas2D ops. Torch particles spawn `Math.random() < 0.08` per torch per frame — with 6 torches and 60 fps that's ~30 new particles/sec just from torches. No off-screen culling either.
**Cost**: 0.5–2 ms/frame depending on count; spike to 5+ ms during big effects (explosions spawn 30 particles, scrolls spawn AoE). Each shadowBlur is a separate raster.
**Fix**: drop shadowBlur on particles (use additive composite or pre-baked glow sprite); cull particles outside viewport rect; cap `state.particles.length` (e.g. trim oldest beyond 200).
**Estimated savings**: 1–3 ms/frame on heavy effects.

### H9. Heavy `ctx.save() / ctx.restore()` + per-tile `ctx.font = ...` in terrain loop
**Location**: terrain pass 3935–3977 (stairs/anvil/door blocks each save/restore + reassign font).
**Issue**: `ctx.font = ...` triggers font shaping; reassigning the same string still triggers parser cost in some browsers. `save/restore` push/pop full state. Only a handful of tiles need it per frame, but if many doors are visible (long corridor), this is 20–40 saves/frame.
**Cost**: ~0.3–1 ms/frame.
**Fix**: hoist common font strings to constants set once before loop (`ctx.font = DOOR_FONT`); only `save/restore` when shadow/alpha actually changes; batch all stair-tile draws together, then doors, etc.
**Estimated savings**: ~0.5 ms/frame.

### H10. `processWorld()` outer `while` loop with `filter+sort` per iteration
**Location**: line 3655–3668.
**Issue**: every iteration allocates a fresh array via `state.enemies.filter(...).sort(...)`. With safety=64 and many enemies, this can be 10–30 allocations + sorts per turn. Not per-frame but per turn — still GC pressure.
**Cost**: <1 ms but contributes to GC spikes after many turns.
**Fix**: maintain energy-priority via insertion or a single sort; iterate by index.
**Estimated savings**: minor CPU, meaningful GC stability.

### H11. `markExplored()` splits string keys to recover ints
**Location**: line 2524–2530.
**Issue**: `state.visible` keys are strings; `markExplored` calls `k.split(',').map(Number)` for every visible tile. Each call allocates 2 strings + a number array.
**Cost**: ~0.2 ms per call, only on turn — but pure GC waste.
**Fix**: addressed by H6 (switch visible to int-keyed).

### H12. `lineOfSight` Bresenham used in enemy AI
**Location**: line 2991–3010, called by enemy AI per turn (likely many).
**Issue**: per-cell `state.map[y][x]` array-of-arrays double-deref (cache miss). With 10+ enemies × 5–15 tile range × multiple LoS checks per turn = 100–500 grid probes per turn.
**Cost**: <1 ms/turn, but with the rAF render loop firing simultaneously, cumulative.
**Fix**: low priority. Could flatten map to 1-D `Uint8Array` once for cache-friendly access.

---

## Optimization Recommendations (priority)

### O1. HIGH — Render-on-dirty (skip rAF redraws when idle)
Wrap `render()` body so it only executes when state has changed since last draw. Particles/anims/shake set `dirty=true`. The animation tick still runs at 60 fps but skips the heavy terrain/UI pipeline. **Single biggest win for mobile.** Est. +20–30 FPS on mobile.

### O2. HIGH — Decouple `updateUI()` from render loop
Call only after `processWorld()`, after item pickup, after stat change. Cache `document.getElementById` lookups at init. Mutate `textContent`/`.style.width` instead of innerHTML wherever possible. Inventory/equipment HTML rebuild only on change. Est. 2–4 ms/frame desktop, 6–10 ms mobile.

### O3. HIGH — Precompute roomGrid + flat int visibility
Replace `getRoomAt()` linear scan with `Uint8Array(MAP_W*MAP_H)` lookup. Replace `state.visible: Set<string>` with `Uint8Array(MAP_W*MAP_H)` flag buffer (or `Set<number>` keyed by `y*MAP_W+x`). Est. 2–4 ms/frame + GC stability.

### O4. MEDIUM — Cached minimap layer
Render minimap to offscreen `OffscreenCanvas` only when explored/visible diff. Composite cached image + overlay player/enemy dots each frame. Est. ~2 ms/frame.

### O5. MEDIUM — Hoist time-based pulses out of inner loops
Compute `const torchFlicker = 0.85 + Math.sin(time * 0.005 + ...) * 0.15` once per torch per frame, anvil pulse once per frame, trap pulse once per frame. Est. ~1 ms/frame.

### O6. MEDIUM — Particle pool + cap + drop shadowBlur
Pre-allocate fixed particle pool (e.g. 256), reuse slots, mark inactive instead of `splice()` (which is O(n)). Cap `state.particles.length` at ~200 (trim oldest). Drop `shadowBlur` for particles or replace with a single pre-rendered radial-gradient sprite reused via `drawImage`. Est. 1–3 ms during heavy effects.

### O7. LOW — Reduce ctx.save/restore in terrain loop
Hoist font strings, batch by tile type, only save/restore when shadow/alpha truly changes. Est. ~0.5 ms/frame.

---

## Memory Concerns

### M1. Triggered traps — bounded (no leak)
`state.traps = dungeon.traps` in `enterFloor()` (line 2506); old floor's traps are dropped. No accumulation across floors. Within a floor: traps are bounded at gen-time (~5–10). OK.

### M2. Particle GC churn
`state.particles.splice(i, 1)` per dying particle (line 4175) is O(n) and relocates the array. With ~30 particles/sec from torches alone plus combat bursts, GC pressure is non-trivial. Switch to swap-pop or a pool. Concrete fix in O6.

### M3. `state.visible = new Set<string>()` rebuilt every turn
`computePlayerFOV()` allocates a fresh `Set` plus N strings per turn (line 2393). On a fast walker, that's 5–20 turns/sec → 5–20 fresh Sets + 100–500 string allocs/sec. Major contributor to GC hitches. Fix via O3.

### M4. `state.floatingTexts` and `state.animations` — bounded by life timers
Both arrays clean themselves via in-place `splice` on life expiry. Splice is O(n) but counts are small (<20). Acceptable.

### M5. Map arrays — ~5.6 KB per floor (Uint8Array)
`map` and `explored` are `Uint8Array(64*44) ≈ 2.8 KB each`. Reallocated on `enterFloor()` (line 2025–2026). No leak — old map is GC'd. Total active memory ~6 KB. Fine.

### M6. DOM string allocations from `updateUI()` (per frame)
Each frame ~5–10 KB of throwaway HTML strings via template literals + innerHTML parsing. Over 30 minutes: ~30k frames × 8 KB = ~240 MB of garbage. GC handles it but causes periodic 5–15 ms hitches. Fix via O2.

---

## Mobile-specific

### Mobile1. D-pad touch repeat at 150 ms
`touchstart` triggers an action then `setInterval(fire, 150)` → ~6–7 actions/sec. Each `tryMove → processWorld → render` chain runs synchronously. If processWorld+render exceeds 150 ms on a low-end device, queue backs up. Acceptable on mid-tier; risk on bottom-tier.

### Mobile2. Canvas backing-store at devicePixelRatio
`resize()` (line 3808–3815) uses `dpr = window.devicePixelRatio || 1`. On retina iPhone (dpr=3), a 1170×2532 logical canvas backs to 3510×7596 = 26.6 megapixels. Each fillRect/text op costs 9× a non-DPR canvas. Combined with full-frame redraw (H1), mobile struggles. Mitigation: cap DPR at 2 (`Math.min(window.devicePixelRatio, 2)`) — visual quality loss negligible on 28 px tiles.

### Mobile3. `passive: false` listeners + `e.preventDefault()` block scroll
D-pad and action buttons use `{ passive: false }`. Required for `preventDefault`, but means iOS Safari cannot fast-path-scroll. Acceptable since the game canvas is full-screen — no scrolling expected.

### Mobile4. No requestAnimationFrame backoff when tab hidden
rAF auto-throttles when hidden, but particles still tick on resume → potential burst. Minor.

### Mobile5. Google Fonts CSS @import — network hit on cold load
First load fetches Inter + JetBrains Mono (~200–400 KB woff2). Game canvas may render with fallback monospace for 100–500 ms on slow 4G. Mitigation: `font-display: swap` on the @import + preload critical font, or self-host one woff2 file (~30 KB).

---

## Quick wins (<10 lines code change each)
- [ ] 1. **Cap DPR at 2** in `resize()` — `const dpr = Math.min(window.devicePixelRatio || 1, 2);`
- [ ] 2. **Cache DOM refs** for HP/XP/stats elements once at init; replace `getElementById` calls in `updateUI()`.
- [ ] 3. **Hoist torch flicker outside inner tile loop** — compute `torch._flicker` once per torch per frame.
- [ ] 4. **Hoist `playerRoom`/`playerInLit`/`tr` outside terrain loop** — currently recomputed every tile iteration (lines 3878–3880).
- [ ] 5. **Particle cap** — `if (state.particles.length > 200) state.particles.length = 200;` after spawn calls.
- [ ] 6. **Drop `shadowBlur` on particles** (line 4181) — biggest per-particle cost.
- [ ] 7. **Add `font-display: swap`** to Google Fonts @import to prevent FOIT on slow networks.
- [ ] 8. **Cache `getRoomAt(player)`** once per frame instead of calling at lines 3878 and 4219.

## Long-term refactors (>50 lines)
- [ ] 1. **Render-on-dirty pattern** (O1) — biggest single win. ~30–60 lines: introduce `state.dirty` flag, set true on any state change, particle/anim spawn, screenShake; render() early-returns if !dirty && no active effects.
- [ ] 2. **Flat typed-array world buffers** (O3) — replace `state.map[y][x]` array-of-arrays with `Uint8Array(W*H)`, replace `state.visible` Set<string> with `Uint8Array(W*H)`, add `state.roomGrid: Uint8Array(W*H)`. Touches FOV, render, minimap, lineOfSight, isOpaque.
- [ ] 3. **Decouple UI rebuild from render** (O2) — wire `updateUI()` to event-driven changes (player turn end, inventory delta, stat change). Cache slot HTML, diff vs previous, only mutate changed slots.
- [ ] 4. **Particle pool + offscreen sprite** (O6) — pre-allocate `Float32Array` SoA particle buffer, render via cached gradient sprite + drawImage instead of arc+shadowBlur.

---

## Verdict
- **Desktop 60 FPS**: **achievable today** with ~3–6 ms/frame slack. Current static estimate is 8–14 ms/frame typical → fits 16.67 ms budget but no margin for GC hitches. With O1 alone, idle frames drop to <1 ms.
- **Mobile 30 FPS**: **risky without O1+O2+Mobile2 cap**. Current estimate 22–40 ms/frame on mid-tier mobile with DPR=3 → 25–45 FPS unstable, with periodic hitches from GC and innerHTML reflow. After quick wins #1, #2, #6 + O1: comfortable 50–60 FPS on mid-tier.
- **Memory**: **stable, no leaks identified**. Map state is per-floor, traps reset on floor change, particles/animations self-clean. Concern is GC churn (string allocation in visibility Set, innerHTML throwaway, particle splice) causing frame hitches rather than memory growth. After O3 + O6, churn drops by ~70%.
