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

  // v4-03 (MVP) — Width 1 or 2, 50/50 distribution. Per-edge width roll.
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    const width = (Math.random() < 0.5) ? 1 : 2;
    digCorridor(map, a.cx, a.cy, b.cx, b.cy, width);
  }

  if (rooms.length > 3) {
    const extra = rand(1, 3);
    for (let i = 0; i < extra; i++) {
      const a = rooms[rand(0, rooms.length - 1)];
      const b = rooms[rand(0, rooms.length - 1)];
      if (a !== b) {
        const width = (Math.random() < 0.5) ? 1 : 2;
        digCorridor(map, a.cx, a.cy, b.cx, b.cy, width);
      }
    }
  }

  // v4-03 — BFS connectivity guarantee. Player must reach every room.
  guaranteeConnectivity(map, rooms);

  // ─── DOORS ─────────────────────────────────
  // v4-03 (MVP) — Width-aware doorway groups. Identify maximal runs of corridor
  // tiles touching room floor (perpendicular to corridor axis). Single-tile
  // doorways behave as before; 2-tile doorways form a `doorGroup` so opening
  // any tile flips both. Also collects groups in `doorGroupList` for state binding.
  const doorGroupList = []; // [[{x,y},{x,y}], ...]

  // Helper: corridor tile (x,y) is "doorway candidate" iff it's CORRIDOR and
  // orthogonally adjacent to a FLOOR (room interior) tile.
  function isDoorwayCandidate(x, y) {
    if (map[y][x] !== TILE.CORRIDOR) return false;
    if (map[y - 1] && map[y - 1][x] === TILE.FLOOR) return true;
    if (map[y + 1] && map[y + 1][x] === TILE.FLOOR) return true;
    if (map[y][x - 1] === TILE.FLOOR) return true;
    if (map[y][x + 1] === TILE.FLOOR) return true;
    return false;
  }

  const claimed = new Uint8Array(w * h); // tiles already placed as door
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (claimed[y * w + x]) continue;
      if (!isDoorwayCandidate(x, y)) continue;

      // Look for an adjacent doorway candidate in either direction (N/S/E/W).
      // We pair AT MOST one neighbor (width-2 cap) to form a group.
      // Avoid pairing across an L-corner (we accept only orthogonally adjacent
      // candidates that share the same axis-row/col).
      let pair = null;
      const tryPair = (nx, ny) => {
        if (pair) return;
        if (nx < 1 || nx >= w - 1 || ny < 1 || ny >= h - 1) return;
        if (claimed[ny * w + nx]) return;
        if (!isDoorwayCandidate(nx, ny)) return;
        pair = { x: nx, y: ny };
      };
      tryPair(x + 1, y);
      tryPair(x, y + 1);
      tryPair(x - 1, y);
      tryPair(x, y - 1);

      // Place door(s).
      map[y][x] = TILE.DOOR_CLOSED;
      claimed[y * w + x] = 1;
      const group = [{ x, y }];
      if (pair) {
        map[pair.y][pair.x] = TILE.DOOR_CLOSED;
        claimed[pair.y * w + pair.x] = 1;
        group.push(pair);
      }
      if (group.length > 1) doorGroupList.push(group);
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

  return { map, explored, rooms, playerStart: { x: playerRoom.cx, y: playerRoom.cy }, stairsPos, torches, litSet, traps, anvils, doorGroupList };
}

// v4-03 (MVP) — Width-aware corridor digger. Supported widths: 1, 2.
// Width 2 paints a 2-tile-thick path (axis tile + one perpendicular offset).
// Offset side is chosen once per corridor to avoid zig-zag. Out-of-bounds offsets
// are silently dropped (paintCorridor bounds-checks).
function digCorridor(map, x1, y1, x2, y2, width) {
  if (width == null) width = 1;
  width = (width === 2) ? 2 : 1;

  // Choose perpendicular offset side once per corridor (left/right of axis).
  // For width-2: offset is +1 in the perpendicular dimension of the current segment.
  // perpSign in {-1, +1} (we lean toward +1 unless that hits the edge for entire segment).
  const perpSign = (Math.random() < 0.5) ? -1 : 1;

  const horizFirst = Math.random() > 0.5;

  // Carve a single horizontal segment from (ax,y) to (bx,y); width adds tiles in y±perp.
  function carveH(ax, bx, y) {
    const step = (bx >= ax) ? 1 : -1;
    let x = ax;
    while (true) {
      paintCorridor(map, x, y);
      if (width === 2) paintCorridor(map, x, y + perpSign);
      if (x === bx) break;
      x += step;
    }
  }
  // Carve a single vertical segment from (x,ay) to (x,by); width adds tiles in x±perp.
  function carveV(ay, by, x) {
    const step = (by >= ay) ? 1 : -1;
    let y = ay;
    while (true) {
      paintCorridor(map, x, y);
      if (width === 2) paintCorridor(map, x + perpSign, y);
      if (y === by) break;
      y += step;
    }
  }

  if (horizFirst) {
    carveH(x1, x2, y1);
    carveV(y1, y2, x2);
  } else {
    carveV(y1, y2, x1);
    carveH(x1, x2, y2);
  }
}

// v4-03 — paint a single corridor tile if in-bounds and currently WALL.
// FLOOR/CORRIDOR/etc are left alone (room overlap takes precedence).
function paintCorridor(map, x, y) {
  const W = CFG.MAP_W, H = CFG.MAP_H;
  if (x < 1 || x > W - 2 || y < 1 || y > H - 2) return;
  if (map[y][x] === TILE.WALL) map[y][x] = TILE.CORRIDOR;
}

// v4-03 — BFS from rooms[0].center across passable tiles; for any unreached
// room, dig a width-1 corridor from its center to the nearest visited tile,
// then continue BFS from that room. Guarantees full connectivity post-pass.
function guaranteeConnectivity(map, rooms) {
  if (rooms.length === 0) return;
  const W = CFG.MAP_W, H = CFG.MAP_H;
  const visited = new Uint8Array(W * H);

  function isPassable(t) {
    return t === TILE.FLOOR || t === TILE.CORRIDOR || t === TILE.DOOR_CLOSED || t === TILE.DOOR_OPEN || t === TILE.STAIRS || t === TILE.ANVIL;
  }

  function bfsFrom(sx, sy) {
    const queue = [sx, sy];
    visited[sy * W + sx] = 1;
    while (queue.length) {
      const x = queue.shift();
      const y = queue.shift();
      const neigh = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neigh) {
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (visited[ny * W + nx]) continue;
        if (!isPassable(map[ny][nx])) continue;
        visited[ny * W + nx] = 1;
        queue.push(nx, ny);
      }
    }
  }

  bfsFrom(rooms[0].cx, rooms[0].cy);

  for (let pass = 0; pass < 3; pass++) {
    let allReached = true;
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      if (visited[r.cy * W + r.cx]) continue;
      allReached = false;
      // Find nearest visited tile by manhattan distance.
      let best = null, bestD = Infinity;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!visited[y * W + x]) continue;
          const d = Math.abs(x - r.cx) + Math.abs(y - r.cy);
          if (d < bestD) { bestD = d; best = { x, y }; }
        }
      }
      if (best) {
        digCorridor(map, r.cx, r.cy, best.x, best.y, 1);
        bfsFrom(r.cx, r.cy);
      }
    }
    if (allReached) break;
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
  // P1.4: per-enemy hpScaleOverride — bosses use 1.0 (use exact def.hp), Dragon uses 0.10 (gentler ramp).
  // Default scale = 1 + (floor-1)*0.15. Bosses skip the scaling entirely (hpScaleOverride === 1).
  const scaleRate = (def.hpScaleOverride != null) ? def.hpScaleOverride : 0.15;
  const scale = def.isBoss ? 1 : (1 + (floor - 1) * scaleRate);
  const inst = {
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
  // ─── BOSS instance fields (v3-05) ───
  if (def.isBoss) {
    inst.isBoss = true;
    inst.bossKey = def.bossKey;
    inst.phase = 1;
    inst.cooldowns = { summon: 0, aoe: 0, teleport: 0, breath: 0, slam: 0, root: 0 };
    inst.telegraphedTiles = [];
    inst.minionsAlive = [];
    inst.lastDamagedTick = 0;
    inst.enraged = false;
    inst.introPlayed = false;
    inst.awake = true; // bosses are always active
  }
  return inst;
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

  // ─── ITEMS (per-room 2-3) — v3-02: tier-aware spawn ───
  // Boss room flag: F4/F6/F8/F10 — 1st item drop guaranteed min Rare (Epic at F8/F10)
  let bossDropPending = (floor === 4 || floor === 6 || floor === 8 || floor === 10);
  for (let i = 1; i < state.rooms.length; i++) {
    const room = state.rooms[i];
    const numItems = rand(2, 3);
    for (let k = 0; k < numItems; k++) {
      const free = findFreeTileInRoom(room, [...enemies, ...items]);
      if (!free) continue;
      // First, decide tier (only for equippables; consumables stay flat)
      const tier = pickItemTier(floor, { bossDrop: bossDropPending });
      if (bossDropPending) bossDropPending = false; // consume guarantee
      let inst = null;
      if (tier === TIER.LEGENDARY) {
        const legDef = pickLegendaryDef(floor);
        if (legDef) {
          inst = makeLegendaryItem(legDef, { x: free.x, y: free.y });
        }
      }
      if (!inst) {
        // Roll a base def — prefer equippables for tier rolls; fall back to any
        let baseDef = pickWeightedItem(floor, d => d.slot && !!d.tierBase != null);
        if (!baseDef) baseDef = pickWeightedItem(floor);
        if (!baseDef) continue;
        if (baseDef.slot) {
          inst = makeTieredItem(baseDef, tier, { x: free.x, y: free.y });
        } else {
          inst = makeItemInstance(baseDef, { x: free.x, y: free.y });
        }
      }
      items.push(inst);
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
      // v3-02: equippable guarantees roll a tier; consumables stay flat
      if (def.slot) {
        const tier = pickItemTier(floor);
        items.push(makeTieredItem(def, tier, { x: free.x, y: free.y }));
      } else {
        items.push(makeItemInstance(def, { x: free.x, y: free.y }));
      }
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

  // v4-03 — bind multi-tile door groups. doorGroups: Map<groupId, [{x,y},...]>;
  // doorGroupByCoord (lazily-built lookup) is exposed via openDoor() helper.
  state.doorGroups = new Map();
  if (dungeon.doorGroupList && dungeon.doorGroupList.length) {
    for (let gi = 0; gi < dungeon.doorGroupList.length; gi++) {
      state.doorGroups.set(gi, dungeon.doorGroupList[gi]);
    }
  }
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

  // ─── BOSS ARENA (v3-05) ───
  // On boss floors (F2/4/6/8/10), promote largest room to lit arena and spawn the boss.
  // Note: on F10 the legacy "force dragon" is still in populateFloor; spawnBossArenaForFloor uses the same
  // dragon enemy def, so we de-dupe by removing legacy dragon spawn before placing the canonical one.
  if (typeof spawnBossArenaForFloor === 'function') {
    const fo = (typeof FLOOR_OBJECTIVES !== 'undefined') ? FLOOR_OBJECTIVES[floor] : null;
    if (fo && fo.main === 'defeat_boss') {
      // Remove any prior dragon (force-spawn from populateFloor) so we have only one boss entry.
      state.enemies = state.enemies.filter(e => !(e.key === 'dragon' && !e.isBoss));
      spawnBossArenaForFloor(floor);
    }
  }

  // ─── OBJECTIVES (v3-04) ───
  if (typeof setupFloorObjective === 'function') {
    setupFloorObjective(floor);
  }

  state.visible = computePlayerFOV();
  markExplored();

  // v3-02 — Reset per-floor revive flags (Obsidian Heart)
  state.heartUsedThisFloor = false;

  // P2.2 — Phoenix Spirit: full heal + cleanse statuses on floor enter
  if (state.player.flags && state.player.flags.phoenixSpirit) {
    state.player.hp = state.player.maxHp;
    state.player.statusEffects = [];
    state.player.poisoned = 0;
    spawnParticles(state.player.x, state.player.y, 18, '#f97316', 2.5, 30);
    addMessage('Phoenix Spirit cleanses you!', 'level');
  }

  // v3-01 / v3-03 — Force re-render & minimap rebuild.
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

// v4-03 — open a door at (x,y). If the tile belongs to a doorGroup, all member
// tiles flip to DOOR_OPEN in the same call. Safe to invoke for non-grouped doors.
// Returns the array of tiles that were actually flipped.
function openDoor(x, y) {
  const flipped = [];
  if (!state.map[y] || state.map[y][x] !== TILE.DOOR_CLOSED) {
    // Already open or not a door — no-op.
    return flipped;
  }
  // Find group membership (linear scan; groups are small and few per floor).
  let group = null;
  if (state.doorGroups && state.doorGroups.size) {
    for (const tiles of state.doorGroups.values()) {
      if (tiles.some(t => t.x === x && t.y === y)) { group = tiles; break; }
    }
  }
  const targets = group || [{ x, y }];
  for (const t of targets) {
    if (state.map[t.y] && state.map[t.y][t.x] === TILE.DOOR_CLOSED) {
      state.map[t.y][t.x] = TILE.DOOR_OPEN;
      flipped.push({ x: t.x, y: t.y });
    }
  }
  return flipped;
}
