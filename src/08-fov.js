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

function effectiveTorchRadius() {
  return CFG.TORCH_RADIUS + (state.player.torchBonus || 0);
}

function getRoomAt(x, y) {
  if (!state || !state.rooms) return null;
  for (const r of state.rooms) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
  }
  return null;
}

function computePlayerFOV() {
  const visible = computeFOV(state.player.x, state.player.y, effectiveTorchRadius());
  const room = getRoomAt(state.player.x, state.player.y);
  if (room) {
    if (room.lit) {
      // Lit rooms: every floor tile in room is visible.
      for (let dy = 0; dy < room.h; dy++) {
        for (let dx = 0; dx < room.w; dx++) {
          visible.add(key(room.x + dx, room.y + dy));
        }
      }
    }
    // Always reveal the room's perimeter (walls AND doors) so the player sees
    // the room outline & exits, even in unlit rooms — fixes the "sealed pit"
    // perception bug when torch radius is shorter than the room dimension.
    for (let dy = -1; dy <= room.h; dy++) {
      for (let dx = -1; dx <= room.w; dx++) {
        const tx = room.x + dx, ty = room.y + dy;
        if (ty < 0 || ty >= CFG.MAP_H || tx < 0 || tx >= CFG.MAP_W) continue;
        if (!state.map[ty]) continue;
        const t = state.map[ty][tx];
        if (t === TILE.WALL || t === TILE.DOOR_CLOSED || t === TILE.DOOR_OPEN) {
          visible.add(key(tx, ty));
        }
      }
    }
  }
  return visible;
}

function computeFOV(cx, cy, radius) {
  const visible = new Set();
  visible.add(key(cx, cy));

  for (let oct = 0; oct < 8; oct++) {
    castLight(cx, cy, radius, 1, 1.0, 0.0,
      OCTANT_MULT[0][oct], OCTANT_MULT[1][oct],
      OCTANT_MULT[2][oct], OCTANT_MULT[3][oct], visible);
  }
  return visible;
}

function castLight(cx, cy, radius, row, startSlope, endSlope, xx, xy, yx, yy, visible) {
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
        castLight(cx, cy, radius, j + 1, startSlope, lSlope, xx, xy, yx, yy, visible);
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
