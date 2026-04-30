// ═══════════════════════════════════════════════
// 08-fov.js — Recursive shadowcasting FOV, line of sight
// ═══════════════════════════════════════════════

// ─── FOV (RECURSIVE SHADOWCASTING) ──────────────
const OCTANT_MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

// ─── 4-layer torch radii (v3-01) ────────────────
function effectiveBrightRadius() {
  // BRIGHT never grows with Sharp Eyes — preserves "oddech potwora" feel.
  return CFG.TORCH_BRIGHT;
}
function effectiveDimRadius() {
  return Math.min(CFG.TORCH_MAX, CFG.TORCH_DIM
    + (state.player.torchBonus || 0)
    + (state.player.eternalCandle ? 2 : 0));
}
function effectiveEdgeRadius() {
  return Math.min(CFG.TORCH_MAX, CFG.TORCH_EDGE
    + (state.player.torchBonus || 0)
    + (state.player.eternalCandle ? 2 : 0));
}

// Legacy alias — UI / older callers still ask for one number; return DIM as the "main" radius.
function effectiveTorchRadius() {
  return effectiveDimRadius();
}

// Perf P2.4 — O(1) roomGrid lookup. Falls back to scan if grid not built yet.
function getRoomAt(x, y) {
  if (!state || !state.rooms) return null;
  if (state.roomGrid) {
    if (x < 0 || x >= CFG.MAP_W || y < 0 || y >= CFG.MAP_H) return null;
    const idx = state.roomGrid[y * CFG.MAP_W + x] - 1;
    return idx >= 0 ? state.rooms[idx] : null;
  }
  for (const r of state.rooms) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
  }
  return null;
}

// ─── Player FOV: 4-layer (BRIGHT/DIM/EDGE) ───────
// Returns a Set<key> for back-compat (state.visible). Side effect: writes
// state.tileLightLevel (Float32Array, source-of-truth for renderer).
function computePlayerFOV() {
  const W = CFG.MAP_W, H = CFG.MAP_H;
  if (!state.tileLightLevel || state.tileLightLevel.length !== W * H) {
    state.tileLightLevel = new Float32Array(W * H);
  } else {
    state.tileLightLevel.fill(0);
  }

  const cx = state.player.x, cy = state.player.y;
  const rBright = effectiveBrightRadius();
  const rDim    = effectiveDimRadius();
  const rEdge   = effectiveEdgeRadius();

  // Cast at the largest radius — write per-tile lightLevel based on distance buckets.
  const visible = computeFOVWithLight(cx, cy, rEdge, rBright, rDim);

  // Lit-room override + perimeter reveal (kept from v2).
  const room = getRoomAt(cx, cy);
  if (room) {
    if (room.lit) {
      for (let dy = 0; dy < room.h; dy++) {
        for (let dx = 0; dx < room.w; dx++) {
          const tx = room.x + dx, ty = room.y + dy;
          visible.add(key(tx, ty));
          const idx = ty * W + tx;
          // Lit tile → at least DIM-zone brightness (0.7).
          if (state.tileLightLevel[idx] < 0.7) state.tileLightLevel[idx] = 0.7;
        }
      }
    }
    // Always reveal room perimeter walls + doors.
    for (let dy = -1; dy <= room.h; dy++) {
      for (let dx = -1; dx <= room.w; dx++) {
        const tx = room.x + dx, ty = room.y + dy;
        if (ty < 0 || ty >= H || tx < 0 || tx >= W) continue;
        if (!state.map[ty]) continue;
        const t = state.map[ty][tx];
        if (t === TILE.WALL || t === TILE.DOOR_CLOSED || t === TILE.DOOR_OPEN) {
          visible.add(key(tx, ty));
          const idx = ty * W + tx;
          if (state.tileLightLevel[idx] < 0.35) state.tileLightLevel[idx] = 0.35;
        }
      }
    }
  }

  return visible;
}

// Drop-in shim for legacy callers (none currently — but kept for safety / tests).
function computeFOV(cx, cy, radius) {
  return computeFOVWithLight(cx, cy, radius, Math.min(2, radius), Math.min(5, radius));
}

// Recursive shadowcasting — also writes lightLevel per tile based on radius bucket.
function computeFOVWithLight(cx, cy, rEdge, rBright, rDim) {
  const visible = new Set();
  visible.add(key(cx, cy));
  // origin tile is always BRIGHT (1.0)
  if (state.tileLightLevel) state.tileLightLevel[cy * CFG.MAP_W + cx] = 1.0;

  for (let oct = 0; oct < 8; oct++) {
    castLight(cx, cy, rEdge, rBright, rDim, 1, 1.0, 0.0,
      OCTANT_MULT[0][oct], OCTANT_MULT[1][oct],
      OCTANT_MULT[2][oct], OCTANT_MULT[3][oct], visible);
  }
  return visible;
}

// distance → lightLevel mapping (4 zones).
function distToLightLevel(d, rBright, rDim, rEdge) {
  if (d <= rBright) return 1.0;          // BRIGHT
  if (d <= rDim)    return 0.7;          // DIM
  if (d <= rEdge)   return 0.3;          // EDGE
  return 0;
}

function castLight(cx, cy, radius, rBright, rDim, row, startSlope, endSlope, xx, xy, yx, yy, visible) {
  if (startSlope < endSlope) return;

  let nextStart = startSlope;

  for (let j = row; j <= radius; j++) {
    let blocked = false;

    for (let dx = -j; dx <= 0; dx++) {
      const dy = -j;
      const mapX = cx + dx * xx + dy * xy;
      const mapY = cy + dx * yx + dy * yy;

      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rSlope) continue;
      if (endSlope > lSlope) break;

      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= radius && mapX >= 0 && mapX < CFG.MAP_W && mapY >= 0 && mapY < CFG.MAP_H) {
        visible.add(key(mapX, mapY));
        if (state.tileLightLevel) {
          const lvl = distToLightLevel(d, rBright, rDim, radius);
          const idx = mapY * CFG.MAP_W + mapX;
          if (state.tileLightLevel[idx] < lvl) state.tileLightLevel[idx] = lvl;
        }
      }

      if (blocked) {
        if (isOpaque(mapX, mapY)) {
          nextStart = rSlope;
          continue;
        } else {
          blocked = false;
          startSlope = nextStart;
        }
      } else if (isOpaque(mapX, mapY) && j < radius) {
        blocked = true;
        castLight(cx, cy, radius, rBright, rDim, j + 1, startSlope, lSlope, xx, xy, yx, yy, visible);
        nextStart = rSlope;
      }
    }

    if (blocked) break;
  }
}

function isOpaque(x, y) {
  if (x < 0 || x >= CFG.MAP_W || y < 0 || y >= CFG.MAP_H) return true;
  const t = state.map[y][x];
  return t === TILE.WALL || t === TILE.DOOR_CLOSED;
}

// ─── LINE OF SIGHT ──────────────────────────────
function lineOfSight(a, b) {
  // Bresenham; allow endpoint walls but block on intermediate walls.
  let x0 = a.x | 0, y0 = a.y | 0, x1 = b.x | 0, y1 = b.y | 0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let first = true;
  while (true) {
    if (!first && !(x0 === x1 && y0 === y1)) {
      if (x0 < 0 || x0 >= CFG.MAP_W || y0 < 0 || y0 >= CFG.MAP_H) return false;
      const lt = state.map[y0][x0];
      if (lt === TILE.WALL || lt === TILE.DOOR_CLOSED) return false;
    }
    first = false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }
  }
}
