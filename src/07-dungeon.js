// ═══════════════════════════════════════════════
// 07-dungeon.js — Dungeon generation, populate, enter floor
// ═══════════════════════════════════════════════

// ─── DUNGEON GENERATION ─────────────────────────
function generateDungeon(floor) {
  const w = CFG.MAP_W, h = CFG.MAP_H;
  const map = Array.from({ length: h }, () => new Uint8Array(w));
  const explored = Array.from({ length: h }, () => new Uint8Array(w));
  const rooms = [];
  const numRooms = rand(8, 14) + Math.floor(floor / 2);
  const torches = [];

  for (let attempt = 0; attempt < numRooms * 5; attempt++) {
    if (rooms.length >= numRooms) break;
    const rw = rand(CFG.ROOM_MIN, CFG.ROOM_MAX);
    const rh = rand(CFG.ROOM_MIN_H, CFG.ROOM_MAX_H);
    const rx = rand(2, w - rw - 2);
    const ry = rand(2, h - rh - 2);

    let overlap = false;
    for (const r of rooms) {
      if (rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y) {
        overlap = true; break;
      }
    }
    if (overlap) continue;

    for (let dy = 0; dy < rh; dy++)
      for (let dx = 0; dx < rw; dx++)
        map[ry + dy][rx + dx] = TILE.FLOOR;

    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
  }

  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    digCorridor(map, a.cx, a.cy, b.cx, b.cy);
  }

  if (rooms.length > 3) {
    const extra = rand(1, 3);
    for (let i = 0; i < extra; i++) {
      const a = rooms[rand(0, rooms.length - 1)];
      const b = rooms[rand(0, rooms.length - 1)];
      if (a !== b) digCorridor(map, a.cx, a.cy, b.cx, b.cy);
    }
  }

  // ─── DOORS ─────────────────────────────────
  // Place a closed door on every corridor tile orthogonally adjacent to room floor.
  // We snapshot the original CORRIDOR positions then upgrade qualifying ones to DOOR_CLOSED.
  // This guarantees: every connection between corridor and room is a door (suspense + FOV blocking).
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (map[y][x] !== TILE.CORRIDOR) continue;
      // adjacent to room floor (4-orthogonal)
      let touchesRoom = false;
      if (map[y - 1] && map[y - 1][x] === TILE.FLOOR) touchesRoom = true;
      if (map[y + 1] && map[y + 1][x] === TILE.FLOOR) touchesRoom = true;
      if (map[y][x - 1] === TILE.FLOOR) touchesRoom = true;
      if (map[y][x + 1] === TILE.FLOOR) touchesRoom = true;
      if (!touchesRoom) continue;
      // avoid stacking two doors next to each other
      let doorNeighbour = false;
      if (map[y - 1] && map[y - 1][x] === TILE.DOOR_CLOSED) doorNeighbour = true;
      if (map[y + 1] && map[y + 1][x] === TILE.DOOR_CLOSED) doorNeighbour = true;
      if (map[y][x - 1] === TILE.DOOR_CLOSED) doorNeighbour = true;
      if (map[y][x + 1] === TILE.DOOR_CLOSED) doorNeighbour = true;
      if (doorNeighbour) continue;
      map[y][x] = TILE.DOOR_CLOSED;
    }
  }

  for (const room of rooms) {
    const numTorches = rand(0, 2);
    for (let t = 0; t < numTorches; t++) {
      const tx = rand(room.x, room.x + room.w - 1);
      const ty = rand(room.y, room.y + room.h - 1);
      let isWall = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (map[ty + dy] && map[ty + dy][tx + dx] === TILE.WALL) isWall = true;
      if (isWall && map[ty][tx] === TILE.FLOOR) {
        torches.push({ x: tx, y: ty, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  const playerRoom = rooms[0];
  const stairsRoom = rooms[rooms.length - 1];
  const stairsPos = { x: stairsRoom.cx, y: stairsRoom.cy };
  map[stairsPos.y][stairsPos.x] = TILE.STAIRS;

  // ─── ANVIL ─────────────────────────────────
  const anvils = [];
  if (floor >= 3 && Math.random() < 0.5 && rooms.length > 2) {
    // pick a room different from player and stairs
    let attempts = 0;
    while (attempts < 20) {
      const idx = rand(1, rooms.length - 2);
      const r = rooms[idx];
      const ax = rand(r.x + 1, r.x + r.w - 2);
      const ay = rand(r.y + 1, r.y + r.h - 2);
      if (map[ay][ax] === TILE.FLOOR &&
          !(ax === stairsPos.x && ay === stairsPos.y) &&
          !(ax === playerRoom.cx && ay === playerRoom.cy)) {
        map[ay][ax] = TILE.ANVIL;
        anvils.push({ x: ax, y: ay, used: false });
        break;
      }
      attempts++;
    }
  }

  // ─── LIT ROOMS ─────────────────────────────
  const litSet = new Set();
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    r.lit = false;
    const area = r.w * r.h;
    let chance = CFG.LIT_ROOM_CHANCE;
    if (area > CFG.LIT_ROOM_AREA_THRESHOLD) chance += 0.30;
    if (i === 0 || i === rooms.length - 1) chance -= 0.10;
    if (Math.random() < chance) {
      r.lit = true;
      litSet.add(i);
    }
  }
  if (litSet.size < CFG.LIT_ROOM_MIN_PER_FLOOR && rooms.length > 2) {
    const candidates = [];
    for (let i = 1; i < rooms.length - 1; i++) if (!litSet.has(i)) candidates.push(i);
    if (candidates.length > 0) {
      const pick = candidates[rand(0, candidates.length - 1)];
      rooms[pick].lit = true;
      litSet.add(pick);
    }
  }

  // ─── TRAPS ─────────────────────────────────
  const traps = [];
  const availableTraps = TRAP_DEFS.filter(t => t.minFloor <= floor);
  if (availableTraps.length > 0) {
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      if (Math.random() < CFG.TRAP_CHANCE_PER_ROOM) {
        const def = availableTraps[rand(0, availableTraps.length - 1)];
        const tx = rand(r.x + 1, r.x + r.w - 2);
        const ty = rand(r.y + 1, r.y + r.h - 2);
        if (tx === stairsPos.x && ty === stairsPos.y) continue;
        if (traps.some(t => t.x === tx && t.y === ty)) continue;
        traps.push({ ...def, x: tx, y: ty, revealed: false, triggered: false });
      }
    }
    // corridor traps — only spike + pit
    const corridorTrapDefs = availableTraps.filter(t => t.type === 'spike' || t.type === 'pit');
    if (corridorTrapDefs.length > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (map[y][x] !== TILE.CORRIDOR) continue;
          if (Math.random() < CFG.TRAP_CHANCE_CORRIDOR) {
            if (traps.some(t => t.x === x && t.y === y)) continue;
            const def = corridorTrapDefs[rand(0, corridorTrapDefs.length - 1)];
            traps.push({ ...def, x, y, revealed: false, triggered: false });
          }
        }
      }
    }
  }

  return { map, explored, rooms, playerStart: { x: playerRoom.cx, y: playerRoom.cy }, stairsPos, torches, litSet, traps, anvils };
}

function digCorridor(map, x1, y1, x2, y2) {
  let x = x1, y = y1;
  const horizFirst = Math.random() > 0.5;

  if (horizFirst) {
    while (x !== x2) { if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR; x += x < x2 ? 1 : -1; }
    if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR;
    while (y !== y2) { if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR; y += y < y2 ? 1 : -1; }
    if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR;
  } else {
    while (y !== y2) { if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR; y += y < y2 ? 1 : -1; }
    if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR;
    while (x !== x2) { if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR; x += x < x2 ? 1 : -1; }
    if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR;
  }
}

function pickWeightedEnemy(floor) {
  const eligible = ENEMY_DEFS.filter(d => {
    const fr = d.floor || [d.minFloor || 1, 99];
    return floor >= fr[0] && floor <= (fr[1] ?? 99) && !d.forceSpawn;
  });
  if (eligible.length === 0) return null;
  const total = eligible.reduce((s, d) => s + (d.weight || 1), 0);
  let r = Math.random() * total;
  for (const d of eligible) {
    r -= (d.weight || 1);
    if (r <= 0) return d;
  }
  return eligible[eligible.length - 1];
}

function makeEnemyInstance(def, x, y, floor) {
  const scale = 1 + (floor - 1) * 0.15;
  return {
    ...def,
    id: ++state.nextEnemyId,
    x, y,
    hp: Math.floor(def.hp * scale),
    maxHp: Math.floor(def.hp * scale),
    atk: Math.floor(def.atk * scale),
    def: Math.floor((def.def || 0) * scale),
    awake: false,
    energy: 0,
    speed: def.speed,
    movementPattern: def.movementPattern,
    statusEffects: [],
    zigzagPhase: 0,
    state: def.ai === 'ambusher' ? 'HIDDEN' : (def.ai === 'mimic' ? 'DISGUISED' : 'ACTIVE'),
    tpCounter: 0,
    breathCd: 0,
    charging: false,
    revived: false,
    vanished: false,
    splitGen: def.splitGen || 0,
    isChild: false,
  };
}

function findFreeTileInRoom(room, occupied) {
  for (let attempts = 0; attempts < 30; attempts++) {
    const x = rand(room.x + 1, room.x + room.w - 2);
    const y = rand(room.y + 1, room.y + room.h - 2);
    if (state.map[y][x] !== TILE.FLOOR) continue;
    if (occupied.some(o => o.x === x && o.y === y)) continue;
    return { x, y };
  }
  return null;
}

function populateFloor(floor) {
  const enemies = [];
  let items = [];

  // ─── ENEMIES ───
  for (let i = 1; i < state.rooms.length; i++) {
    const room = state.rooms[i];
    const numEnemies = rand(1, Math.min(3, 1 + Math.floor(floor / 2)));
    for (let j = 0; j < numEnemies; j++) {
      const def = pickWeightedEnemy(floor);
      if (!def) continue;
      const free = findFreeTileInRoom(room, enemies);
      if (!free) continue;
      enemies.push(makeEnemyInstance(def, free.x, free.y, floor));
    }
  }

  // Forced dragon spawn on floor 10
  if (floor === 10) {
    const dragonDef = ENEMY_DEFS.find(d => d.key === 'dragon');
    if (dragonDef && !enemies.some(e => e.key === 'dragon')) {
      const lastRoom = state.rooms[state.rooms.length - 1];
      const free = findFreeTileInRoom(lastRoom, enemies);
      if (free) enemies.push(makeEnemyInstance(dragonDef, free.x, free.y, floor));
    }
  }

  // ─── ITEMS (per-room 2-3) ───
  for (let i = 1; i < state.rooms.length; i++) {
    const room = state.rooms[i];
    const numItems = rand(2, 3);
    for (let k = 0; k < numItems; k++) {
      const def = pickWeightedItem(floor);
      if (!def) continue;
      const free = findFreeTileInRoom(room, [...enemies, ...items]);
      if (!free) continue;
      items.push(makeItemInstance(def, { x: free.x, y: free.y }));
    }
  }

  // ─── MIMIC SUBSTITUTION (10% chance per item) ───
  if (floor >= 3) {
    const mimicDef = ENEMY_DEFS.find(d => d.key === 'mimic');
    if (mimicDef) {
      for (let k = items.length - 1; k >= 0; k--) {
        if (Math.random() < 0.10) {
          const it = items[k];
          enemies.push(makeEnemyInstance(mimicDef, it.x, it.y, floor));
          items.splice(k, 1);
        }
      }
    }
  }

  // ─── ENSURE MIN (post-mimic so guarantees aren't replaced) ───
  function ensureItemPredicate(predicate, defOrPicker) {
    if (!items.some(predicate)) {
      const room = state.rooms[rand(1, Math.max(1, state.rooms.length - 1))];
      const free = findFreeTileInRoom(room, [...enemies, ...items]);
      if (!free) return;
      let def = (typeof defOrPicker === 'function') ? defOrPicker() : defOrPicker;
      if (!def) return;
      items.push(makeItemInstance(def, { x: free.x, y: free.y }));
    }
  }
  ensureItemPredicate(i => i.type === 'weapon', () => pickWeightedItem(floor, d => d.type === 'weapon'));
  ensureItemPredicate(i => i.type === 'armor',  () => pickWeightedItem(floor, d => d.type === 'armor'));
  // 2x potions
  for (let p = 0; p < 2; p++) {
    if (items.filter(i => i.type === 'potion').length < 2) {
      const room = state.rooms[rand(1, Math.max(1, state.rooms.length - 1))];
      const free = findFreeTileInRoom(room, [...enemies, ...items]);
      if (!free) break;
      const def = pickWeightedItem(floor, d => d.type === 'potion') || findItemDef('herb');
      if (def) items.push(makeItemInstance(def, { x: free.x, y: free.y }));
    }
  }

  return { enemies, items };
}

// ─── ENTER FLOOR / MARK EXPLORED ────────────────
function enterFloor(floor) {
  state.floor = floor;
  const dungeon = generateDungeon(floor);
  state.map = dungeon.map;
  state.explored = dungeon.explored;
  state.rooms = dungeon.rooms;
  state.stairsPos = dungeon.stairsPos;
  state.torches = dungeon.torches;
  state.traps = dungeon.traps || [];
  state.litRooms = dungeon.litSet || new Set();
  state.anvils = dungeon.anvils || [];
  state.webTiles = [];
  state.player.x = dungeon.playerStart.x;
  state.player.y = dungeon.playerStart.y;
  state.player.energy = 0;
  state.player.poisoned = 0;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;

  // ─── v3-01: per-floor visibility/exploration buffers ───
  const W = CFG.MAP_W, H = CFG.MAP_H;
  state.tileLightLevel = new Float32Array(W * H);
  state.exploredCorridors = new Uint8Array(W * H);
  state.exploredRooms = new Set();

  // ─── perf P2.4: roomGrid Uint8Array, value = roomIdx+1 (0 = none) ───
  // Cap rooms to 254 (Uint8 limit minus the 0-sentinel) — far above the 14-room max.
  state.roomGrid = new Uint8Array(W * H);
  for (let i = 0; i < state.rooms.length && i < 254; i++) {
    const r = state.rooms[i];
    for (let dy = 0; dy < r.h; dy++) {
      for (let dx = 0; dx < r.w; dx++) {
        const xx = r.x + dx, yy = r.y + dy;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
          state.roomGrid[yy * W + xx] = i + 1;
        }
      }
    }
  }

  const pop = populateFloor(floor);
  state.enemies = pop.enemies;
  state.groundItems = pop.items;
  state.visible = computePlayerFOV();
  markExplored();

  // Force re-render & minimap rebuild.
  state.dirty = true;
  state.minimapDirty = true;
  state.minimapExpanded = false;
}

function markExplored() {
  const W = CFG.MAP_W;
  for (const k of state.visible) {
    const [x, y] = k.split(',').map(Number);
    if (y >= 0 && y < CFG.MAP_H && x >= 0 && x < W) {
      state.explored[y][x] = 1;
      // v3-01: corridor "trail" memory — brighter render when out of FOV.
      const t = state.map[y][x];
      if (t === TILE.CORRIDOR || t === TILE.DOOR_OPEN || t === TILE.DOOR_CLOSED) {
        if (state.exploredCorridors) state.exploredCorridors[y * W + x] = 1;
      }
    }
  }
  // v3-01: mark current room as explored (room contour memory).
  if (state.roomGrid) {
    const idx = state.roomGrid[state.player.y * W + state.player.x] - 1;
    if (idx >= 0) state.exploredRooms.add(idx);
  }
  // Reveal traps in current FOV
  if (state.traps) {
    for (const trap of state.traps) {
      if (!trap.revealed && !trap.triggered && state.visible.has(key(trap.x, trap.y))) {
        trap.revealed = true;
      }
    }
  }
}
