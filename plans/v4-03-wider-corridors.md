# v4-03: Dungeon Topology Rework — Wider Corridors + Branching

**Status:** PLAN
**Owner:** Level-Designer + Engine-Programmer
**Files:** `src/07-dungeon.js` (focus), `src/01-config.js` (new constants), `src/13-render.js` (visual variation), `src/06-state.js` (roomGrid sizing)
**Depends on:** v3-01 (visibility/exploredCorridors), v3-03 (minimap), v3-05 (boss arenas — must remain compatible)

---

## 1. Problem

The current dungeon generator (`07-dungeon.js`, lines 174–189) uses a single algorithm `digCorridor(map, x1, y1, x2, y2)` that draws a **1-tile-wide L-shaped path** between every pair of consecutive room centers, plus 1–3 extra random connections. This produces:

- **Suffocating corridors.** Every encounter in a corridor is a forced 1v1 head-on collision. Player cannot side-step a Goblin, cannot kite, cannot reposition. Skeleton archers in corridors are death sentences. Web tiles in 1-wide corridors are unbypassable.
- **Boring topology.** Each room is a leaf or pass-through node on a near-tree graph. There are no T-intersections, no plazas, no places where three paths meet and the player has to choose.
- **No tactical surface.** Wide-AOE items (Fireball scroll, Dragon breath) collapse to "single-target with extra steps" because the only victims line up in 1-tile rows.
- **Floor objectives feel cramped.** v3-04 objectives like "kill X enemies on this floor" are pursued through identical narrow tunnels.

User feedback (verbatim): *"Korytarze mogą być szersze niż na jedną linijkę. Żeby się różne rzeczy mogły dziać i łączyć się z innymi korytarzami."* The player wants **room to breathe** and **branching** — explicit demands for wider tunnels and intersections that act as decision points.

This rework targets the corridor system end-to-end: width distribution, junction shapes, multi-edge connectivity, and visual reinforcement of the new topology.

---

## 2. Design Philosophy — "Breathing Dungeons"

The guiding metaphor is **lungs, not veins.** Veins carry one-way flow at constant pressure. Lungs branch, widen, contract, and meet at chambers where exchange happens. We want corridors that:

1. **Vary in width** so the player's spatial expectation resets every transition. A long 2-tile artery feeding into a 5×5 hub-junction creates a felt change in tempo: the same way a forest path opens into a clearing.
2. **Branch at decision-points** so the player chooses, rather than walks. A T-junction in front of an unexplored map third forces a "left or right" moment that pure trees never produce.
3. **Loop back** so retreat is a real option. A floor with cycles means kiting an enemy down corridor A, around a junction, back through corridor B is possible. Trees punish mistakes; cycles reward planning.
4. **Hint at function via shape.** A 5×5 hub with floor-tier lighting reads "this is important" before the player even sees what's in it. Width becomes a level-design language.

The constraint: **never sacrifice connectivity** (every room reachable) and **never blow the perf budget** (the Uint8Array roomGrid must still cover every floor tile). Wider corridors mean more tiles, so we cap aggregate corridor area per floor.

The aesthetic: dungeons should feel **carved**, not **drawn**. Mixed widths and intersections look like geology — water cut these passages over centuries — not like a Tron grid.

---

## 3. Width Distribution Table

Per-corridor decision sampled at corridor-build time:

| Width class | Probability | Tile span | Use case | Notes |
|-------------|-------------|-----------|----------|-------|
| **W1 — narrow** | 30% | 1 tile | Leaf connections, single-room dead-ends | Current behavior — preserved for variety |
| **W2 — standard** | 50% | 2 tiles (orthogonal pair) | Default arteries | New default; fits 2 enemies abreast |
| **W3 — broad** | 15% | 3 tiles | "Room-corridors", high-traffic spines | Reads as a long room |
| **HUB — junction plaza** | 5% | 5×5 floor area at midpoint | Where 3+ corridors converge | Lit-by-default, tactical anchor |

Width is **rolled once per corridor edge** and held for the entire L-path. Floor 1 forces ≥30% W1 (gentle introduction); floors 5+ raise W2/W3 share by +5% each (deep dungeon = more open).

Junction-plaza budget: max **2 hubs per floor** (cap to keep room/corridor balance from inverting).

---

## 4. Junction Types Catalog

When two corridor segments meet, we promote the meeting tile to a junction shape:

### 4.1 L-corner (current)
```
  ##
  ##
##XX
##XX
```
Two segments at 90°. No promotion — this is the W1/W2 default. Width-aware: a W2 L-corner widens both legs.

### 4.2 T-junction
```
########
####XX##
##XXXX##
##XX####
```
Three segments meet. The meeting tile is widened to a 3×3 floor patch. Used when an extra MST edge re-enters a corridor mid-segment instead of at a room.

### 4.3 + intersection
```
####XX####
####XX####
XXXXXXXXXX
XXXXXXXXXX
####XX####
####XX####
```
Four segments. Meeting becomes a 3×3 (or 4×4 if any leg is W3). Rare — only emerges when two cross-floor cycles intersect orthogonally. Soft-cap: 1 per floor.

### 4.4 Y-junction (non-orthogonal)
True Y is impossible in a 4-connected grid, so we **fake it** with an offset T: two segments enter at adjacent (not opposite) sides of the junction tile. Visually this reads as a fork rather than a perpendicular T.

### 4.5 Hub (5×5 plaza)
```
##XXXXX##
##XXXXX##
XXXXXXXXX
XXXXXXXXX
XXXXXXXXX
##XXXXX##
##XXXXX##
```
A 5×5 floor square placed at the midpoint of a HUB-class corridor. From the hub, the original corridor continues to its endpoint, AND the generator may attach an opportunistic third corridor to a nearby room (within `HUB_FORK_RADIUS = 12` tiles). Hubs are pre-flagged `lit = true` and added to `litSet` so they render with the lit-room palette.

---

## 5. Generator Algorithm (Pseudocode)

```
function generateDungeon(floor):
  rooms = placeRooms(numRooms, ROOM_MIN..ROOM_MAX)        # unchanged
  edges = buildMST(rooms)                                  # NEW: explicit MST
  cycleEdges = pickExtraEdges(rooms, ratio=0.3..0.5)       # NEW: 30–50% extra
  allEdges = edges ∪ cycleEdges

  for edge (a, b) in allEdges:
    width = pickCorridorWidth(floor)                       # W1/W2/W3/HUB

    if width == HUB and hubsThisFloor < HUB_CAP:
      mid = midpoint(a.center, b.center)
      hub = tryPlaceHub(mid, size=5)
      if hub == null:
        width = W2                                          # fallback
      else:
        digCorridor(map, a.center, hub.center, W2)
        digCorridor(map, hub.center, b.center, W2)
        markHubLit(hub)
        # opportunistic third leg:
        c = nearestUnconnectedRoomWithin(hub, HUB_FORK_RADIUS)
        if c: digCorridor(map, hub.center, c.center, W2)
        hubsThisFloor++
        continue

    digCorridor(map, a.center, b.center, width)

  promoteJunctions(map)                                     # widen overlaps to T/+
  guaranteeConnectivity(map, rooms)                         # BFS sweep, fix isolated
  placeDoors(map, rooms)                                    # width-aware doors
  ... (torches, traps, anvil, lit, stairs — unchanged)
```

### 5.1 `digCorridor(map, x1, y1, x2, y2, width)`

```
function digCorridor(map, x1, y1, x2, y2, width):
  horizFirst = random() > 0.5
  carve(x1, y1, x2, y1, width)  if horizFirst else carve(x1, y1, x1, y2, width)
  carve(elbow, ..., x2, y2, width)

function carve(ax, ay, bx, by, width):
  # axis-aligned segment, paint tiles within width radius
  dx = sign(bx - ax); dy = sign(by - ay)
  x = ax; y = ay
  loop until (x,y) == (bx,by):
    for offset in halfSpan(width):                          # see §5.2
      paintCorridor(x + offset.dx, y + offset.dy)
    x += dx; y += dy
```

### 5.2 `halfSpan(width)`

| width | offsets (perpendicular to travel axis) |
|-------|----------------------------------------|
| 1 | `[(0,0)]` |
| 2 | `[(0,0), (+1,0)]` (or `(0,+1)` if horizontal-first segment is vertical) |
| 3 | `[(-1,0), (0,0), (+1,0)]` |

Width-2 picks the offset side **once per corridor** (left or right of axis) so the corridor doesn't zigzag. Width-3 is symmetric.

### 5.3 `paintCorridor(x, y)`

Bounds-check against `[1, MAP_W-2] × [1, MAP_H-2]`. If the target tile is `WALL`, set `CORRIDOR`. If it's already `FLOOR` (i.e., we're entering a room), leave it alone. If out-of-bounds → **fallback narrower** for this segment (see §10).

### 5.4 `promoteJunctions(map)`

Sweep all corridor tiles. For each, count corridor neighbors (4-orthogonal). If `≥3` neighbors are corridor (T or +), widen the local 3×3 patch to corridor (subject to bounds). This is a post-pass that converts incidental crossings into proper junctions.

### 5.5 `pickCorridorWidth(floor)`

```
r = random()
if r < 0.30: return W1
if r < 0.80: return W2
if r < 0.95: return W3
return HUB
```

Floor scaling: `W1 += 0.05` per floor below 3, `W3 += 0.05` per floor above 5 (clamped). This delivers narrower early-game and broader late-game without needing per-floor tables.

---

## 6. Multi-Connection (MST + Extra Edges)

Current code chains rooms sequentially (`rooms[i-1] → rooms[i]`). This produces a path graph, not even a real tree. Replacement:

1. **Build proper MST.** Treat rooms as nodes, edge weight = manhattan distance between centers. Prim's algorithm — O(N²), N ≤ 14, trivial.
2. **Add extra edges for cycles.** From the remaining (non-MST) candidate edges, sample `floor(0.3..0.5 × N)` random edges, preferring shorter ones (weighted random). This guarantees loops without runaway corridor density.
3. **Per-room degree cap = 4.** A room has at most 4 corridor connections (one per cardinal side). If the cap is hit, try the next candidate edge.
4. **Result:** rooms have **1–4 connections** (large rooms more likely to hit cap). MST guarantees baseline connectivity; extra edges add tactical loops.

Pseudo:
```
function buildMST(rooms):
  inTree = {rooms[0]}; edges = []
  while |inTree| < |rooms|:
    pick min-weight edge (a in inTree, b not in inTree)
    edges.push((a, b)); inTree.add(b)
  return edges

function pickExtraEdges(rooms, ratio):
  candidates = allPairs(rooms) − mstEdges
  shuffleWeighted(candidates, weight = 1 / distance)
  count = floor(ratio × |rooms|)
  return candidates.slice(0, count) filtered by degreeCap
```

---

## 7. BFS Connectivity Guarantee

Must run **after** all corridors and junction promotions are placed:

```
function guaranteeConnectivity(map, rooms):
  visited = new Uint8Array(MAP_W * MAP_H)
  queue = [rooms[0].center]
  visited[idx(rooms[0].center)] = 1

  while queue not empty:
    (x, y) = queue.shift()
    for (nx, ny) in 4-neighbors(x, y):
      if map[ny][nx] in {FLOOR, CORRIDOR, DOOR_CLOSED, DOOR_OPEN, STAIRS, ANVIL}:
        if not visited[idx(nx, ny)]:
          visited[idx(nx, ny)] = 1
          queue.push((nx, ny))

  for room in rooms[1..]:
    if not visited[idx(room.center)]:
      # find nearest visited tile, dig W1 corridor to it
      target = nearestVisitedTile(room.center, visited)
      digCorridor(map, room.cx, room.cy, target.x, target.y, 1)
      # re-run BFS from this room to update visited
      bfsExpand(visited, room.center)
```

Worst-case the rescue dig is a 1-tile corridor through wall — guaranteed to land on the connected component because we picked the nearest visited tile. Maximum two passes needed even with adversarial room placement.

---

## 8. Door Placement Update

Current rule (lines 50–73): every CORRIDOR tile orthogonally adjacent to FLOOR becomes DOOR_CLOSED, with a no-stack-adjacent-doors rule. We extend:

### 8.1 Width-aware doorways

For W2/W3 corridors entering a room, the boundary between corridor and room is now 2–3 contiguous tiles wide. Naively the existing pass would create a single door (then skip the rest due to `doorNeighbour`), leaving the rest as plain corridor — opening the door wouldn't unblock the full passage.

New rule:
1. Identify **doorway segments**: maximal runs of corridor tiles all adjacent to the same room, perpendicular to corridor axis.
2. For each segment of length L:
   - L=1: place 1 DOOR_CLOSED (current behavior).
   - L=2: place **2 DOOR_CLOSED** flagged as a `doorGroup` (shared id).
   - L=3: place **3 DOOR_CLOSED** in the same `doorGroup`.

### 8.2 Synchronized opening

Add `state.doorGroups: Map<id, [{x,y}, ...]>`. When the player (or any actor that opens doors) opens any DOOR_CLOSED with a group id, **all tiles in that group flip to DOOR_OPEN in the same turn**. This means a wide doorway behaves as a single door panel, not a portcullis-style fence.

Implementation site: `src/12-input.js` open-door handler + `src/09-ai.js` if monsters open doors. Look for current `TILE.DOOR_CLOSED → TILE.DOOR_OPEN` transitions and route through `openDoor(x, y)` helper which fans out to the group.

### 8.3 Storage

Each door tile retains its TILE id; group membership lives in `state.doorGroups`. Rebuild on `enterFloor`. Memory: ~60 doors per floor × <8 bytes = negligible.

---

## 9. Visual Variation

Render layer changes (`src/13-render.js`):

### 9.1 W2 floor pattern
Alternating shades on the two-tile width: even-axis tile uses `corridorBase`, odd-axis uses `corridorBase × 1.08` (slightly lighter). The eye reads it as cobblestone/plank pattern rather than a flat strip.

### 9.2 W3 "main path" highlight
Center column of a W3 corridor renders at `corridorBase × 1.15`; flanks at `corridorBase × 0.95`. Subliminal "follow the path" hint without needing arrows.

### 9.3 Hub plaza
Hub tiles use `litRoomFloor` palette and are added to `litSet` at generation. This makes hubs visually pop from regular corridors — a tactical landmark visible on the minimap.

### 9.4 Minimap (v3-03)
Hubs render as a 5×5 lit cluster on the minimap; T/+ junctions as a small bright pip at the meeting point. No new code needed if minimap already iterates `state.map` and `state.litRooms`.

### 9.5 Identification at runtime
We don't need to store width per tile — width is implicit in the floor pattern (count contiguous corridor tiles on the perpendicular axis). For perf, a one-time pass at end of generation can write `state.corridorWidthGrid: Uint8Array` so render reads it in O(1).

---

## 10. Performance Impact

### 10.1 Tile budget

Current floor: ~14 rooms × ~30 tiles + ~14 corridors × ~20 tiles ≈ 700 floor/corridor tiles out of `MAP_W × MAP_H = 64 × 44 = 2816`.

New floor (worst case, all W3): 14 corridors × 60 tiles + 2 hubs × 25 tiles = ~890 corridor tiles. Total ~1100, still <40% of map. Render cost scales linearly with **visible** tiles (FOV-bounded), which doesn't grow with corridor width — FOV radius is ~9, so any single frame still touches at most ~250 tiles.

**Verdict:** render-side perf is unchanged.

### 10.2 `roomGrid` (Uint8Array)

`state.roomGrid` (line 396 of current 07-dungeon.js) maps tile → roomIdx+1 with 0 = none. Hubs are **not rooms** in the data sense — they live as corridor tiles, so they don't consume room slots. The 254-room cap is unaffected. We continue to use `Uint8Array(W*H)` and skip hub tiles in the room-write loop.

If we ever wanted hubs to be "first-class rooms" for objectives/lit logic, we'd add them to `rooms[]` with a `kind: 'hub'` flag. **Recommendation: do this** — it makes "lit hubs" automatic and lets the minimap reuse the `state.exploredRooms` Set. We're well under the 254-room cap (max 14 rooms + 2 hubs = 16).

### 10.3 Generation cost

MST on 14 nodes: 196 distance calcs, sub-millisecond. BFS sweep on 2816 tiles: microseconds. Junction promotion: single map sweep, O(W×H). Total generation budget grows by maybe 5–10ms, imperceptible.

### 10.4 Mobile rendering / camera

`CFG.TILE = 28px`. Viewport at 360×640 mobile = ~13×23 tiles visible. A W3 corridor (3 tiles thick) fills 12% of viewport height — totally fine. Hub plaza (5×5) is ~28% of viewport — comfortable. Camera follow logic in `src/13-render.js` centers on player position, which doesn't care about corridor width. **No camera changes needed.**

---

## 11. Edge Cases

| Case | Handling |
|------|----------|
| W2/W3 corridor adjacent to map edge (offset would go out of bounds) | `paintCorridor` bounds-check: silently drop the offset tile. If the result is L=0 (corridor disappears), retry with `width-1`. |
| Hub placement collides with existing room (overlap test fails) | `tryPlaceHub` returns null; downgrade corridor to W2 and dig normal L. |
| Hub placement collides with another corridor mid-dig | Allow overlap — corridor tiles get overwritten by hub floor, and the hub effectively absorbs the crossing. Junction promotion will tidy edges. |
| MST degree cap blocks all extra-edge candidates | Stop adding extras early; floor still plays, just with fewer loops. |
| BFS rescue dig itself blocked (extreme map fill) | Hard cap: 100 generation attempts per `generateDungeon` call; on failure, regenerate the entire floor (existing loop pattern). |
| Width-3 corridor entering a room narrower than 3 tiles | Doorway segment is clamped to room width. L=1 or L=2 doors are placed normally. |
| Corridor tile already FLOOR (room overlap) | Leave it. Room floors take precedence over corridor paint — unchanged from current. |
| Door group spans a corner | Doorway detection runs **per straight segment**, so a corner forces two groups. Acceptable — corners are rare on doorways. |
| Trap on a hub tile | Hubs are explicitly tactical anchors; spawning a trap there is good design. No filter needed. |
| Boss arena (v3-05) on a hub floor | Boss arena promotion happens after corridor gen. If boss room overlaps a hub, the hub is absorbed into the arena floor — visually fine, gameplay fine. |

---

## 12. Implementation File:Line Map

All edits in `src/07-dungeon.js` unless noted.

| Section | Action | Lines (approx, current file) |
|---------|--------|------------------------------|
| `generateDungeon` room placement | Unchanged | 7–34 |
| Replace sequential `digCorridor` chain | Build MST + extras | 36–48 → new `buildMST`, `pickExtraEdges`, edge loop |
| `digCorridor(map, x1, y1, x2, y2)` | Add `width` param | 174–189 |
| Add `pickCorridorWidth(floor)` | New | new helper |
| Add `tryPlaceHub(mid, size)` | New | new helper |
| Add `promoteJunctions(map)` | New | new helper |
| Add `guaranteeConnectivity(map, rooms)` | New | new helper |
| Door placement loop | Width-aware groups; emit `doorGroups` | 54–73 |
| `enterFloor` | Reset `state.doorGroups`; consider hubs in `roomGrid` skip | 370–451 |
| `01-config.js` | Add `CORRIDOR_W1/W2/W3/HUB` weights, `HUB_CAP=2`, `HUB_FORK_RADIUS=12`, `EXTRA_EDGE_RATIO=[0.3, 0.5]` | append |
| `06-state.js` | Add `state.doorGroups = new Map()`, `state.corridorWidthGrid = null` | wherever state shape is initialized |
| `12-input.js` | Route door open through `openDoor(x, y)` that flips full group | door handler |
| `09-ai.js` | Same as above for monster door-open paths | door handler |
| `13-render.js` | Use `corridorWidthGrid` for shade variation; hub uses lit palette | corridor draw branch |

---

## 13. Acceptance Criteria

A floor passes review when:

1. **Width distribution** observed across 100 generated floors falls within ±5% of the table in §3 (W1≈30%, W2≈50%, W3≈15%, HUB≈5% per-edge; floor scaling applied correctly).
2. **Connectivity:** BFS from `playerStart` reaches every room (and stairs and anvil) on **every** generated floor across a 1000-floor stress run. Zero isolations.
3. **Junction promotion:** at least 30% of generated floors contain ≥1 T-junction or + intersection (verified by counting corridor tiles with ≥3 corridor neighbors).
4. **Hub spawn rate:** averaged over 100 floors, mean hub count is in `[0.7, 1.3]` per floor (target 1, capped at 2).
5. **Door synchronization:** opening any tile in a doorGroup flips all members in the same turn. Verified by manually triggering on W2/W3 doorways and checking pixel-perfect render.
6. **Visual variation:** W2 corridors render with alternating shades; W3 has a center-bright column; hubs render with lit palette. No regressions on W1 corridors.
7. **Perf:** floor generation < 20ms on desktop, < 40ms on mid-tier mobile (Chrome devtools throttling: "Mid-tier mobile"). Render frame time unchanged within ±2ms.
8. **roomGrid integrity:** `state.roomGrid[y*W+x]` correctly returns roomIdx+1 for every room tile, 0 elsewhere — including hub tiles (which return 0 unless we promote hubs to first-class rooms per §10.2).
9. **No crash on edge:** generate floor with fixed seed where rooms hug map bounds — wide corridor near edge falls back to narrower without exception.
10. **Backwards compatibility:** v3-01 visibility (`exploredCorridors`), v3-03 minimap, v3-04 objectives, v3-05 boss arenas all continue to function. No regressions in existing playthroughs.
11. **Mobile camera:** on a 360×640 viewport, walking through a hub does not push the camera into out-of-map territory; player remains centered.
12. **Tactical readability:** in playtest, the player can correctly identify a hub as "different from a corridor" within 1 second of entering FOV (subjective, validated via 5-player walkthrough).

---

## 14. Out of Scope (deferred)

- Curved/diagonal corridors (would require subpixel paint, breaks tile grid).
- Procedural cave/cellular-automata regions (different aesthetic, would conflict with room-based generator).
- Multi-floor hubs that span stair transitions (architectural rework, not a corridor change).
- Per-corridor decorations (rubble, water, pillars) — visual polish, separate plan.
- AI pathing changes — the existing A* (or whatever's in `09-ai.js`) handles wider corridors out of the box because they're just more FLOOR/CORRIDOR tiles; no algorithmic change needed.

---
