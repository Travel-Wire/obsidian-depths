// ═══════════════════════════════════════════════
// 09-ai.js — Turn engine, AI helpers, 15 AI behaviors, AI_REGISTRY
// ═══════════════════════════════════════════════

// ─── TURN ENGINE ────────────────────────────────
function getCandidateMoves(pattern, zigzagPhase) {
  switch (pattern) {
    case MOVE_PATTERN.ORTHOGONAL:
      return [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    case MOVE_PATTERN.DIAGONAL:
      return [{dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:1,dy:1}];
    case MOVE_PATTERN.OMNIDIRECTIONAL:
      return [
        {dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0},
        {dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:1,dy:1},
      ];
    case MOVE_PATTERN.KNIGHT:
      return [
        {dx:1,dy:2},{dx:2,dy:1},{dx:-1,dy:2},{dx:-2,dy:1},
        {dx:1,dy:-2},{dx:2,dy:-1},{dx:-1,dy:-2},{dx:-2,dy:-1},
      ];
    case MOVE_PATTERN.LEAP:
      return [{dx:0,dy:-2},{dx:0,dy:2},{dx:-2,dy:0},{dx:2,dy:0}];
    case MOVE_PATTERN.ZIGZAG:
      return zigzagPhase % 2 === 0
        ? [{dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:1,dy:1}]
        : [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    default:
      return [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
  }
}

function stepTowardWithPattern(ex, ey, px, py, pattern, zigzagPhase, otherEnemies) {
  const candidates = getCandidateMoves(pattern, zigzagPhase);
  const skipsWalls = (pattern === MOVE_PATTERN.KNIGHT || pattern === MOVE_PATTERN.LEAP);

  let best = null;
  let bestDist = Infinity;
  let anyValid = false;

  for (const c of candidates) {
    const nx = ex + c.dx, ny = ey + c.dy;
    if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) continue;
    const tile = state.map[ny][nx];
    if (tile === TILE.WALL) continue;
    if (tile === TILE.DOOR_CLOSED) continue; // doors blocked here; aiMoveOrAttack handles opening
    if (nx === px && ny === py) continue; // can't step onto player (attack handled separately)
    if (otherEnemies.some(e => e.x === nx && e.y === ny && !(e.x === ex && e.y === ey) && e.hp > 0)) continue;
    anyValid = true;
    const d = dist(nx, ny, px, py);
    if (d < bestDist) {
      bestDist = d;
      best = { x: nx, y: ny, newZigzagPhase: (zigzagPhase || 0) + 1 };
    }
  }

  if (best) return best;

  // Fallback: non-orthogonal pattern with no valid candidates → try ORTHOGONAL
  if (pattern !== MOVE_PATTERN.ORTHOGONAL) {
    return stepTowardWithPattern(ex, ey, px, py, MOVE_PATTERN.ORTHOGONAL, zigzagPhase, otherEnemies);
  }

  return null;
}

function isAdjacentForAttack(att, tgt) {
  const ax = Math.abs(att.x - tgt.x);
  const ay = Math.abs(att.y - tgt.y);
  if (att.movementPattern === MOVE_PATTERN.ORTHOGONAL) {
    return (ax + ay) <= 1 && (ax + ay) > 0;
  }
  return Math.max(ax, ay) <= 1 && (ax + ay) > 0;
}

// ─── AI HELPERS ──────────────────────────────
function chebyshev(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function sign(n) { return n > 0 ? 1 : (n < 0 ? -1 : 0); }
function sameRowOrCol(a, b) { return a.x === b.x || a.y === b.y; }

function fleeDirection(e, target) {
  const candidates = getCandidateMoves(e.movementPattern || MOVE_PATTERN.ORTHOGONAL, e.zigzagPhase || 0);
  let best = null, bestDist = -1;
  for (const c of candidates) {
    const nx = e.x + c.dx, ny = e.y + c.dy;
    if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) continue;
    const tile = state.map[ny][nx];
    if (tile === TILE.WALL) continue;
    if (tile === TILE.DOOR_CLOSED) continue; // can't flee through a closed door
    if (nx === state.player.x && ny === state.player.y) continue;
    if (state.enemies.some(o => o !== e && o.x === nx && o.y === ny && o.hp > 0)) continue;
    const d = chebyshev({ x: nx, y: ny }, target);
    if (d > bestDist) { bestDist = d; best = { x: nx, y: ny }; }
  }
  return best;
}

function nearestAlly(e, predicate, range) {
  let best = null, bestDist = Infinity;
  for (const a of state.enemies) {
    if (a === e || a.hp <= 0) continue;
    if (predicate && !predicate(a)) continue;
    const d = chebyshev(e, a);
    if (range && d > range) continue;
    if (d < bestDist) { bestDist = d; best = a; }
  }
  return best;
}

function tilesAround(p, r) {
  const tiles = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx === 0 && dy === 0) continue;
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || x >= CFG.MAP_W || y < 0 || y >= CFG.MAP_H) continue;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
    tiles.push({ x, y });
  }
  return tiles;
}

function coneTiles(origin, dir, len) {
  const out = [];
  const horiz = Math.abs(dir.x) >= Math.abs(dir.y);
  for (let i = 1; i <= len; i++) {
    if (horiz) {
      const cx = origin.x + dir.x * i;
      for (let j = -i; j <= i; j++) {
        const cy = origin.y + j;
        if (cx < 0 || cx >= CFG.MAP_W || cy < 0 || cy >= CFG.MAP_H) continue;
        out.push({ x: cx, y: cy });
      }
    } else {
      const cy = origin.y + dir.y * i;
      for (let j = -i; j <= i; j++) {
        const cx = origin.x + j;
        if (cx < 0 || cx >= CFG.MAP_W || cy < 0 || cy >= CFG.MAP_H) continue;
        out.push({ x: cx, y: cy });
      }
    }
  }
  return out;
}

function randomFloorTileNear(p, r, exclude) {
  const opts = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || x >= CFG.MAP_W || y < 0 || y >= CFG.MAP_H) continue;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > r || (dx === 0 && dy === 0)) continue;
    const t = state.map[y][x];
    if (t !== TILE.FLOOR && t !== TILE.CORRIDOR && t !== TILE.STAIRS) continue;
    if (exclude && exclude.x === x && exclude.y === y) continue;
    if (state.enemies.some(en => en.x === x && en.y === y && en.hp > 0)) continue;
    opts.push({ x, y });
  }
  if (opts.length === 0) return null;
  return opts[rand(0, opts.length - 1)];
}

function placeChild(parent, def) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const x = parent.x + dx, y = parent.y + dy;
    if (x < 0 || x >= CFG.MAP_W || y < 0 || y >= CFG.MAP_H) continue;
    const t = state.map[y][x];
    if (t === TILE.WALL || t === TILE.DOOR_CLOSED) continue;
    if (state.enemies.some(en => en.x === x && en.y === y && en.hp > 0)) continue;
    const child = makeEnemyInstance(def, x, y, state.floor);
    child.maxHp = Math.floor((parent.maxHp || def.hp) * 0.5);
    child.hp = child.maxHp;
    child.splitGen = (parent.splitGen || 0) - 1;
    child.isChild = true;
    child.awake = true;
    state.enemies.push(child);
    return true;
  }
  return false;
}

function rangedAttackPlayer(e, dmg, particleColor) {
  if (!lineOfSight(e, state.player)) return false;
  const eff = Math.max(1, dmg - getPlayerDef());
  state.player.hp -= eff;
  spawnFloatingText(state.player.x, state.player.y, `-${eff}`, particleColor || '#fb923c');
  spawnParticles(state.player.x, state.player.y, 8, particleColor || '#fb923c', 2.5, 22);
  state.screenShake = Math.max(state.screenShake, 4);
  damageArmorDur(getEquippedArmor(), dmg);
  if (state.player.hp <= 0 && gamePhase === 'playing') {
    state.player.hp = 0;
    gamePhase = 'dead';
    showDeathScreen();
  }
  return true;
}

// Generic damage for AoE / cone breath
function damageEntity(entity, amount, type, ignoreDef) {
  const def = ignoreDef ? 0 : (entity.def || 0);
  const dealt = Math.max(1, amount - def);
  entity.hp -= dealt;
  spawnFloatingText(entity.x, entity.y, `-${dealt}`, type === 'fire' ? '#fb923c' : '#f87171');
  if (entity === state.player) {
    spawnParticles(entity.x, entity.y, 8, type === 'fire' ? '#f97316' : '#ef4444', 2.5, 20);
    damageArmorDur(getEquippedArmor(), amount);
    if (state.player.hp <= 0 && gamePhase === 'playing') {
      state.player.hp = 0;
      gamePhase = 'dead';
      showDeathScreen();
    }
  } else {
    spawnParticles(entity.x, entity.y, 6, type === 'fire' ? '#f97316' : '#ef4444', 2, 18);
  }
  return dealt;
}

// ─── AI BEHAVIORS ────────────────────────────
// Helper: if a closed door is the most-direct neighbour toward target, open it (1-turn action).
// Returns true if the door was opened.
function tryOpenAdjacentDoor(e, tgtX, tgtY, pattern) {
  const candidates = getCandidateMoves(pattern || e.movementPattern || MOVE_PATTERN.ORTHOGONAL, 0);
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    const nx = e.x + c.dx, ny = e.y + c.dy;
    if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) continue;
    if (state.map[ny][nx] !== TILE.DOOR_CLOSED) continue;
    const d = dist(nx, ny, tgtX, tgtY);
    if (d < bestDist) { bestDist = d; best = { x: nx, y: ny }; }
  }
  if (best) {
    // Only open if it actually moves us closer to target than our current tile.
    if (bestDist <= dist(e.x, e.y, tgtX, tgtY)) {
      state.map[best.y][best.x] = TILE.DOOR_OPEN;
      e.energy -= ACTION_COST.WAIT;
      return true;
    }
  }
  return false;
}

function aiMoveOrAttack(e, pattern) {
  const px = state.player.x, py = state.player.y;
  if (isAdjacentForAttack({ ...e, movementPattern: pattern || e.movementPattern }, state.player)) {
    enemyAttack(e);
    e.energy -= ACTION_COST.ATTACK;
    return;
  }

  // PLAN — Chase Memory: pick chase target. If we currently see the player, refresh memory.
  // Otherwise fall back to lastSeenPlayer if recent.
  let chaseX = px, chaseY = py;
  let usingMemory = false;
  const seesPlayer = state.visible.has(key(e.x, e.y)) || lineOfSight(e, state.player);
  if (seesPlayer) {
    e.lastSeenPlayer = { x: px, y: py, tick: state.worldTick };
  } else if (e.lastSeenPlayer && (state.worldTick - e.lastSeenPlayer.tick) <= 15) {
    chaseX = e.lastSeenPlayer.x;
    chaseY = e.lastSeenPlayer.y;
    usingMemory = true;
    // Reset memory when we reach the spot.
    if (e.x === chaseX && e.y === chaseY) {
      e.lastSeenPlayer = null;
      chaseX = px; chaseY = py;
      usingMemory = false;
    }
  } else if (e.lastSeenPlayer) {
    e.lastSeenPlayer = null; // expired
  }

  const step = stepTowardWithPattern(e.x, e.y, chaseX, chaseY, pattern || e.movementPattern || MOVE_PATTERN.ORTHOGONAL, e.zigzagPhase || 0, state.enemies);
  if (step) {
    const ox = e.x, oy = e.y;
    e.x = step.x; e.y = step.y;
    e.zigzagPhase = step.newZigzagPhase || 0;
    state.animations = state.animations.filter(a => a.entity !== e);
    addMoveAnim(e, ox, oy);
    e.energy -= ACTION_COST.MOVE;
  } else if (tryOpenAdjacentDoor(e, chaseX, chaseY, pattern)) {
    // Door was opened; turn consumed inside helper.
  } else {
    e.energy -= ACTION_COST.WAIT;
  }
}

function aiBasic(e) {
  aiMoveOrAttack(e);
}

function aiCoward(e) {
  if (e.hp / e.maxHp < 0.3) {
    const flee = fleeDirection(e, state.player);
    if (flee) {
      const ox = e.x, oy = e.y;
      e.x = flee.x; e.y = flee.y;
      state.animations = state.animations.filter(a => a.entity !== e);
      addMoveAnim(e, ox, oy);
      e.energy -= ACTION_COST.MOVE;
      return;
    }
  }
  aiMoveOrAttack(e);
}

function aiZigzagger(e) {
  aiMoveOrAttack(e, MOVE_PATTERN.ZIGZAG);
}

function aiFlyer(e) {
  // 50% random diagonal step, otherwise approach diagonally
  if (Math.random() < 0.5) {
    const cands = getCandidateMoves(MOVE_PATTERN.DIAGONAL, 0).filter(c => {
      const nx = e.x + c.dx, ny = e.y + c.dy;
      if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) return false;
      const ft = state.map[ny][nx];
      if (ft === TILE.WALL || ft === TILE.DOOR_CLOSED) return false;
      if (nx === state.player.x && ny === state.player.y) return false;
      if (state.enemies.some(o => o !== e && o.x === nx && o.y === ny && o.hp > 0)) return false;
      return true;
    });
    if (cands.length > 0) {
      const c = cands[rand(0, cands.length - 1)];
      const ox = e.x, oy = e.y;
      e.x += c.dx; e.y += c.dy;
      state.animations = state.animations.filter(a => a.entity !== e);
      addMoveAnim(e, ox, oy);
      e.energy -= ACTION_COST.MOVE;
      return;
    }
  }
  aiMoveOrAttack(e, MOVE_PATTERN.DIAGONAL);
}

function aiAmbusher(e) {
  if (e.state === 'HIDDEN') {
    if (chebyshev(e, state.player) <= (e.ambushRange || 2) && lineOfSight(e, state.player)) {
      e.state = 'ACTIVE';
      e.awake = true;
      spawnParticles(e.x, e.y, 12, '#a78bfa', 2.5, 25);
      addMessage(`A ${e.name} ambushes you!`, 'combat');
    } else {
      e.energy -= ACTION_COST.WAIT;
      return;
    }
  }
  aiMoveOrAttack(e);
}

function aiReviver(e) {
  // Death-time logic happens in resurrect pass; living turn = standard chase
  aiMoveOrAttack(e);
}

function aiPhaser(e) {
  if (e.hp / e.maxHp < (e.vanishBelow || 0.5) && !e.vanished && !e.usedVanish) {
    e.vanished = true;
    e.vanishUntilTick = state.worldTick + (e.vanishTicks || 3);
    e.usedVanish = true;
    spawnParticles(e.x, e.y, 16, '#cbd5e1', 2.5, 30);
    addMessage(`The Ghost vanishes!`, 'combat');
    e.energy -= ACTION_COST.WAIT;
    return;
  }
  if (e.vanished) {
    if (state.worldTick >= e.vanishUntilTick) {
      e.vanished = false;
      spawnParticles(e.x, e.y, 16, '#cbd5e1', 2, 25);
    } else {
      e.energy -= ACTION_COST.WAIT;
      return;
    }
  }
  // Phase-walls: omnidirectional ignoring walls (we approximate by stepping toward player even through walls)
  if (e.phaseWalls) {
    const px = state.player.x, py = state.player.y;
    if (isAdjacentForAttack(e, state.player)) {
      enemyAttack(e);
      e.energy -= ACTION_COST.ATTACK;
      return;
    }
    // Pick direction reducing chebyshev, allow walls
    const candidates = getCandidateMoves(MOVE_PATTERN.OMNIDIRECTIONAL, 0);
    let best = null, bestDist = chebyshev(e, state.player);
    for (const c of candidates) {
      const nx = e.x + c.dx, ny = e.y + c.dy;
      if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) continue;
      if (nx === px && ny === py) continue;
      if (state.enemies.some(o => o !== e && o.x === nx && o.y === ny && o.hp > 0)) continue;
      const d = chebyshev({ x: nx, y: ny }, state.player);
      if (d < bestDist) { bestDist = d; best = { x: nx, y: ny }; }
    }
    if (best) {
      const ox = e.x, oy = e.y;
      e.x = best.x; e.y = best.y;
      state.animations = state.animations.filter(a => a.entity !== e);
      addMoveAnim(e, ox, oy);
      e.energy -= ACTION_COST.MOVE;
      return;
    }
    e.energy -= ACTION_COST.WAIT;
    return;
  }
  aiMoveOrAttack(e);
}

function aiThrower(e) {
  const d = chebyshev(e, state.player);
  if (d <= 1) { aiMoveOrAttack(e); return; }
  if (d <= (e.throwRange || 3) && lineOfSight(e, state.player) && Math.random() < (e.throwChance || 0.35)) {
    addMessage(`The ${e.name} throws a stone!`, 'combat');
    rangedAttackPlayer(e, e.throwDmg || 3, '#a3a3a3');
    e.energy -= ACTION_COST.ATTACK;
    return;
  }
  aiMoveOrAttack(e);
}

function aiCharger(e) {
  if (e.charging) {
    // Leap up to chargeRange tiles in chargeDir
    const dir = e.chargeDir;
    let landed = false;
    for (let i = 1; i <= (e.chargeRange || 3); i++) {
      const nx = e.x + dir.x, ny = e.y + dir.y;
      if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) break;
      const ct = state.map[ny][nx];
      if (ct === TILE.WALL || ct === TILE.DOOR_CLOSED) {
        e.hp -= 1; // recoil
        spawnFloatingText(e.x, e.y, '-1', '#ef4444');
        break;
      }
      if (state.enemies.some(o => o !== e && o.x === nx && o.y === ny && o.hp > 0)) break;
      const ox = e.x, oy = e.y;
      e.x = nx; e.y = ny;
      state.animations = state.animations.filter(a => a.entity !== e);
      addMoveAnim(e, ox, oy);
      if (isAdjacentForAttack(e, state.player)) { landed = true; break; }
    }
    if (landed) {
      enemyAttack(e);
    }
    e.charging = false;
    e.chargeDir = null;
    e.energy -= ACTION_COST.CHARGE;
    return;
  }
  // Trigger charge?
  if (sameRowOrCol(e, state.player)) {
    const d = chebyshev(e, state.player);
    if (d >= 2 && d <= (e.chargeRange || 3) && lineOfSight(e, state.player)) {
      e.charging = true;
      e.chargeDir = { x: sign(state.player.x - e.x), y: sign(state.player.y - e.y) };
      addMessage(`The ${e.name} prepares to charge!`, 'combat');
      spawnParticles(e.x, e.y, 8, '#ef4444', 2, 20);
      e.energy -= ACTION_COST.WAIT;
      return;
    }
  }
  aiMoveOrAttack(e);
}

function aiSplitter(e) {
  // Death-handling in split pass; living = standard
  aiMoveOrAttack(e);
}

function aiXpDrainer(e) {
  // Drain handled in enemyAttack hook
  aiMoveOrAttack(e);
}

function aiJuggernaut(e) {
  aiMoveOrAttack(e);
}

function aiMimic(e) {
  if (e.state === 'DISGUISED') {
    if (chebyshev(e, state.player) <= (e.disguiseRange || 1)) {
      e.state = 'ACTIVE';
      e.awake = true;
      addMessage('The chest was a mimic!', 'combat');
      spawnParticles(e.x, e.y, 18, '#d97706', 3, 30);
      enemyAttack(e); // free strike
      e.energy -= ACTION_COST.ATTACK;
    } else {
      e.energy -= ACTION_COST.WAIT;
    }
    return;
  }
  aiMoveOrAttack(e);
}

function aiCaster(e) {
  const d = chebyshev(e, state.player);
  if (d <= (e.fleeRange || 2)) {
    const flee = fleeDirection(e, state.player);
    if (flee) {
      const ox = e.x, oy = e.y;
      e.x = flee.x; e.y = flee.y;
      state.animations = state.animations.filter(a => a.entity !== e);
      addMoveAnim(e, ox, oy);
      e.energy -= ACTION_COST.MOVE;
      return;
    }
  }
  if (d <= (e.spellRange || 5) && lineOfSight(e, state.player)) {
    if (Math.random() < 0.5) {
      // Fireball
      addMessage(`The ${e.name} casts a fireball!`, 'combat');
      rangedAttackPlayer(e, e.fireDmg || 4, '#fb923c');
    } else {
      // Frost
      addMessage(`The ${e.name} casts frost!`, 'combat');
      addStatusEffect(state.player, STATUS.FREEZE, e.freezeTicks || 2, 0);
      spawnParticles(state.player.x, state.player.y, 14, '#38bdf8', 2, 25);
    }
    e.energy -= ACTION_COST.ATTACK;
    return;
  }
  aiMoveOrAttack(e);
}

function aiTeleporter(e) {
  e.tpCounter = (e.tpCounter || 0) + 1;
  if (e.tpCounter >= (e.teleportEvery || 5)) {
    e.tpCounter = 0;
    const tgt = randomFloorTileNear(state.player, 4, state.player);
    if (tgt) {
      const ox = e.x, oy = e.y;
      e.x = tgt.x; e.y = tgt.y;
      spawnParticles(ox, oy, 18, '#f87171', 3, 25);
      spawnParticles(e.x, e.y, 18, '#f87171', 3, 25);
      addMessage(`The ${e.name} teleports!`, 'combat');
    }
    // AoE blast
    const r = e.aoeRadius || 2;
    for (const t of tilesAround(e, r)) {
      spawnParticles(t.x, t.y, 4, '#f97316', 2, 18);
    }
    if (chebyshev(e, state.player) <= r) {
      damageEntity(state.player, e.aoeDmg || 6, 'fire', false);
    }
    e.energy -= ACTION_COST.CHARGE;
    return;
  }
  aiMoveOrAttack(e);
}

function aiDragon(e) {
  e.breathCd = e.breathCd || 0;
  if (e.breathCd === 0 && lineOfSight(e, state.player) && chebyshev(e, state.player) <= (e.breathRange || 5)) {
    const dir = { x: sign(state.player.x - e.x), y: sign(state.player.y - e.y) };
    if (dir.x === 0 && dir.y === 0) dir.x = 1;
    addMessage(`The Dragon breathes fire!`, 'combat');
    const tiles = coneTiles(e, dir, e.breathRange || 5);
    for (const t of tiles) {
      spawnParticles(t.x, t.y, 4, '#f97316', 2.5, 22);
      if (state.player.x === t.x && state.player.y === t.y) {
        damageEntity(state.player, e.breathDmg || 8, 'fire', false);
      }
    }
    e.breathCd = e.breathCooldown || 3;
    state.screenShake = 8;
    e.energy -= ACTION_COST.CHARGE;
    return;
  }
  if (e.breathCd > 0) e.breathCd--;
  aiMoveOrAttack(e);
}

const AI_REGISTRY = {
  coward:      aiCoward,
  zigzagger:   aiZigzagger,
  flyer:       aiFlyer,
  ambusher:    aiAmbusher,
  reviver:     aiReviver,
  phaser:      aiPhaser,
  thrower:     aiThrower,
  charger:     aiCharger,
  splitter:    aiSplitter,
  xpdrainer:   aiXpDrainer,
  juggernaut:  aiJuggernaut,
  mimic:       aiMimic,
  caster:      aiCaster,
  teleporter:  aiTeleporter,
  dragon:      aiDragon,
  // ─── BOSS AI (v3-05) — populated from 19-bosses.js, registered here as forward-decl placeholders ───
  // Real functions live in 19-bosses.js; we wire them at load time via late binding.
  cryptLord:   function(e){ if (typeof aiCryptLord === 'function') return aiCryptLord(e); aiBasic(e); },
  golemKing:   function(e){ if (typeof aiGolemKing === 'function') return aiGolemKing(e); aiBasic(e); },
  demonLord:   function(e){ if (typeof aiDemonLord === 'function') return aiDemonLord(e); aiBasic(e); },
  treantElder: function(e){ if (typeof aiTreantElder === 'function') return aiTreantElder(e); aiBasic(e); },
};

function getEffectiveSpeed(entity) {
  let mult = 1;
  if (entity.statusEffects) {
    for (const fx of entity.statusEffects) {
      if (fx.type === STATUS.FREEZE) return 0;
      if (fx.type === STATUS.SLOW) mult *= 0.5;
      if (fx.type === STATUS.HASTE) mult *= 2;
    }
  }
  return (entity.speed || SPEED.NORMAL) * mult;
}

function enemyAct(enemy) {
  if (enemy.hp <= 0) { enemy.energy = 0; return; }
  // PLAN 05 — allied (necromancer): drain energy, don't act hostile (simplified)
  if (enemy.allied) {
    enemy.energy = 0;
    return;
  }
  if (enemy.vanished && state.worldTick < (enemy.vanishUntilTick || 0)) {
    enemy.energy -= ACTION_COST.WAIT;
    return;
  }

  // Wake-up gating
  if (!enemy.awake) {
    if (state.visible.has(key(enemy.x, enemy.y))) {
      enemy.awake = true;
    } else if (chebyshev(enemy, state.player) <= 8 && lineOfSight(enemy, state.player)) {
      enemy.awake = true;
    }
  }

  // Mimic stays in DISGUISED until close — let AI drive
  // Spider HIDDEN handled inside aiAmbusher
  if (!enemy.awake && enemy.state !== 'DISGUISED' && enemy.state !== 'HIDDEN') {
    enemy.energy -= ACTION_COST.WAIT;
    return;
  }

  // Web tile check on enemy starting tile
  if (state.webTiles.find(w => w.x === enemy.x && w.y === enemy.y)) {
    addStatusEffect(enemy, STATUS.SLOW, 2, 0);
  }

  const fn = AI_REGISTRY[enemy.ai] || aiBasic;
  fn(enemy);
}
