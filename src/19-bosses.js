// ═══════════════════════════════════════════════
// 19-bosses.js — Boss System (v3-05 MVP)
// MVP scope: 5 bosses, 2 phases each (full plan = 4 phases — saved for future iteration).
//   Phase 1 (HP > 50%): basic chase + 1 telegraph attack on cooldown.
//   Phase 2 (HP <= 50%): enrage — speed +50%, cooldowns halved.
// Each boss = 1 telegraph attack only (MVP cut from full mechanic schools):
//   Crypt Lord  — bone spike (3-tile cross AoE, 1-turn telegraph)
//   Golem King  — ground slam (8-tile chebyshev-1 AoE, 1-turn telegraph)
//   Demon Lord  — teleport + fire AoE on landing zone
//   Treant Elder — root telegraph (4 ortho neighbors, 1-turn telegraph, FREEZE on hit)
//   Dragon       — cone breath (existing, hardened with telegraph)
// Cinematic intro: name banner only (2-second hold). No camera zoom.
// Boss death: particle storm + drop. No slow-mo.
// Boss arena: lit, large room, locked door (BOSS_GATE) until kill — implemented as flag, not new tile.
// ═══════════════════════════════════════════════

// ─── BOSS_DEFS ──────────────────────────────────
const BOSS_DEFS = {
  crypt_lord:   { key:'crypt_lord',   name:'Crypt Lord',   subtitle:'Warden of the Forgotten',  emoji:'👑', enemyKey:'crypt_lord',   floor:2,  hp:100, atk:12, def:6,  drop:'crypt_plate' },
  golem_king:   { key:'golem_king',   name:'Golem King',   subtitle:'The Mountain That Walks',  emoji:'🗿', enemyKey:'golem_king',   floor:4,  hp:180, atk:14, def:10, drop:'stone_kings_mantle' },
  demon_lord:   { key:'demon_lord',   name:'Demon Lord',   subtitle:'Sovereign of Hellrain',    emoji:'😈', enemyKey:'demon_lord',   floor:6,  hp:280, atk:18, def:8,  drop:'demonbone_cuirass' },
  treant_elder: { key:'treant_elder', name:'Treant Elder', subtitle:'The Rooted King',          emoji:'🌳', enemyKey:'treant_elder', floor:8,  hp:400, atk:16, def:10, drop:'heartwood_vest' },
  dragon:       { key:'dragon',       name:'Ancient Dragon', subtitle:'The Last Geas',          emoji:'🐉', enemyKey:'dragon',       floor:10, hp:80,  atk:12, def:6,  drop:'dragonscale_plate', isFinal:true },
};

// ─── BOSS DROPS (legendary armor pieces) ────────
// These are spawned as ground items on boss death. Stats follow legendary tier convention.
const BOSS_DROPS = {
  crypt_plate:        { id:'crypt_plate',        name:'Crypt Plate',         emoji:'🛡️', type:'armor', slot:'armor', tier:'legendary', def:8,  maxHp:20, color:'#a78bfa', maxDur:80 },
  stone_kings_mantle: { id:'stone_kings_mantle', name:"Stone King's Mantle", emoji:'🪨', type:'armor', slot:'armor', tier:'legendary', def:10, maxHp:25, color:'#94a3b8', maxDur:100 },
  demonbone_cuirass:  { id:'demonbone_cuirass',  name:'Demonbone Cuirass',   emoji:'💀', type:'armor', slot:'armor', tier:'legendary', def:9,  maxHp:30, color:'#f87171', maxDur:90 },
  heartwood_vest:     { id:'heartwood_vest',     name:'Heartwood Vest',      emoji:'🌲', type:'armor', slot:'armor', tier:'legendary', def:8,  maxHp:35, color:'#65a30d', maxDur:90 },
  dragonscale_plate:  { id:'dragonscale_plate',  name:'Dragonscale Plate',   emoji:'🐲', type:'armor', slot:'armor', tier:'legendary', def:12, maxHp:40, color:'#ef4444', maxDur:120 },
};

// ─── BOSS ROOM / ARENA GENERATION ───────────────
// Called from enterFloor for boss floors. Picks the largest room, marks lit, spawns boss in center.
function spawnBossArenaForFloor(floor) {
  // Determine which boss for this floor.
  const fo = (typeof FLOOR_OBJECTIVES !== 'undefined' && FLOOR_OBJECTIVES[floor]) ? FLOOR_OBJECTIVES[floor] : null;
  if (!fo || fo.main !== 'defeat_boss' || !fo.bossKey) return null;
  const def = BOSS_DEFS[fo.bossKey];
  if (!def) return null;

  // Pick largest room as boss arena — exclude rooms[0] (player start) to avoid collision.
  let arena = null;
  let bestArea = 0;
  const playerRoom = state.rooms[0];
  for (const r of state.rooms) {
    if (r === playerRoom) continue; // player spawns here
    const area = r.w * r.h;
    if (area > bestArea) { bestArea = area; arena = r; }
  }
  // Fallback: if only one room exists, allow player room.
  if (!arena) arena = state.rooms[state.rooms.length - 1] || playerRoom;
  if (!arena) return null;
  arena.boss = true;
  arena.bossKey = def.key;
  arena.lit = true;
  if (state.litRooms) state.litRooms.add(state.rooms.indexOf(arena));

  // Move stairs to arena center (after boss kill, stairs there make sense).
  state.stairsPos = { x: arena.cx, y: arena.cy };
  // Re-mark stairs tile (it might have been overwritten by populate).
  state.map[arena.cy][arena.cx] = TILE.STAIRS;

  // Spawn boss in arena.
  const enemyDef = ENEMY_DEFS.find(d => d.key === def.enemyKey);
  if (!enemyDef) {
    console.warn('[bosses] missing enemy def for', def.enemyKey);
    return null;
  }
  // Find spot near center but not exactly on stairs.
  let bx = arena.cx, by = arena.cy + 1;
  if (by >= arena.y + arena.h - 1) by = arena.cy - 1;
  if (state.map[by][bx] !== TILE.FLOOR) { bx = arena.cx + 1; by = arena.cy; }
  if (state.map[by][bx] !== TILE.FLOOR) { bx = arena.cx; by = arena.cy; }
  const bossInst = makeEnemyInstance(enemyDef, bx, by, floor);
  state.enemies.push(bossInst);
  state.bossArenaLocked = true;
  state.currentBossId = bossInst.id;

  // Trigger intro banner.
  state._bossIntroUntil = (state.turns || 0) + 3; // hold ~3 turns
  state._bossIntroName = def.name;
  state._bossIntroSubtitle = def.subtitle;

  return bossInst;
}

// ─── BOSS DROPS ─────────────────────────────────
function spawnBossDrop(boss) {
  if (!boss || !boss.bossKey) return;
  const def = BOSS_DEFS[boss.bossKey];
  if (!def || !def.drop) return;
  const dropDef = BOSS_DROPS[def.drop];
  if (!dropDef) return;
  const item = makeItemInstance(dropDef, { x: boss.x, y: boss.y });
  state.groundItems.push(item);
  addMessage(`${boss.name} dropped ${dropDef.emoji} ${dropDef.name}!`, 'pickup');
}

// ─── BOSS AI HELPERS ────────────────────────────
// Phase resolution (MVP — 2 phases).
function bossUpdatePhase(b) {
  const ratio = b.hp / b.maxHp;
  const wasPhase = b.phase || 1;
  if (ratio <= 0.5 && b.phase < 2) {
    b.phase = 2;
    b.enraged = true;
    addMessage(`${b.name} ENRAGED!`, 'combat');
    spawnParticles(b.x, b.y, 30, '#ef4444', 4, 50);
    state.screenShake = Math.max(state.screenShake, 8);
    // Speed boost on enrage (MVP — instead of full P4 mechanic).
    b.speed = Math.min(SPEED.FAST, Math.floor((b.speed || SPEED.NORMAL) * 1.5));
  }
  return b.phase !== wasPhase;
}

// Resolve telegraphed AoE tiles — apply damage to player if standing on a triggered tile.
function bossResolveTelegraphs(b) {
  if (!b.telegraphedTiles || b.telegraphedTiles.length === 0) return;
  const remaining = [];
  for (const t of b.telegraphedTiles) {
    t.ticksLeft = (t.ticksLeft || 0) - 1;
    if (t.ticksLeft <= 0) {
      // Detonate.
      if (state.player.x === t.x && state.player.y === t.y) {
        damageEntity(state.player, t.dmg || 8, t.type || 'arcane', false);
        // Optional FREEZE for treant root.
        if (t.applyFreeze) addStatusEffect(state.player, STATUS.FREEZE, 2, 0);
      }
      spawnParticles(t.x, t.y, 8, t.color || '#ef4444', 2.5, 22);
    } else {
      remaining.push(t);
    }
  }
  b.telegraphedTiles = remaining;
}

function bossTickCooldowns(b) {
  if (!b.cooldowns) return;
  for (const k of Object.keys(b.cooldowns)) {
    if (b.cooldowns[k] > 0) b.cooldowns[k]--;
  }
}

// Telegraph N tiles around (cx,cy) according to pattern.
function bossTelegraphCross(b, cx, cy, dmg, color) {
  const tiles = [{x:cx,y:cy},{x:cx+1,y:cy},{x:cx-1,y:cy},{x:cx,y:cy+1},{x:cx,y:cy-1}];
  for (const t of tiles) {
    if (t.x < 0 || t.x >= CFG.MAP_W || t.y < 0 || t.y >= CFG.MAP_H) continue;
    if (state.map[t.y][t.x] === TILE.WALL) continue;
    b.telegraphedTiles.push({ x:t.x, y:t.y, ticksLeft:1, dmg, color, type:'arcane' });
  }
}

function bossTelegraphRing(b, cx, cy, dmg, color) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= CFG.MAP_W || y < 0 || y >= CFG.MAP_H) continue;
    if (state.map[y][x] === TILE.WALL) continue;
    b.telegraphedTiles.push({ x, y, ticksLeft:1, dmg, color, type:'physical' });
  }
}

// ─── INDIVIDUAL BOSS AI ─────────────────────────
function aiCryptLord(e) {
  bossUpdatePhase(e);
  bossResolveTelegraphs(e);
  bossTickCooldowns(e);
  const cd = e.cooldowns || {};
  // Telegraph bone-spike attack.
  if ((cd.aoe || 0) <= 0 && chebyshev(e, state.player) <= 6) {
    bossTelegraphCross(e, state.player.x, state.player.y, 14, '#a78bfa');
    addMessage(`${e.name} conjures bone spikes!`, 'combat');
    cd.aoe = e.enraged ? 2 : 4;
    e.cooldowns = cd;
    e.energy -= ACTION_COST.CHARGE;
    return;
  }
  aiMoveOrAttack(e, MOVE_PATTERN.ORTHOGONAL);
}

function aiGolemKing(e) {
  bossUpdatePhase(e);
  bossResolveTelegraphs(e);
  bossTickCooldowns(e);
  const cd = e.cooldowns || {};
  // Ground slam — if player adjacent, telegraph 8-ring.
  if ((cd.slam || 0) <= 0 && chebyshev(e, state.player) <= 2) {
    bossTelegraphRing(e, e.x, e.y, 12, '#f59e0b');
    addMessage(`${e.name} raises its arm...`, 'combat');
    cd.slam = e.enraged ? 2 : 4;
    e.cooldowns = cd;
    e.energy -= ACTION_COST.CHARGE;
    return;
  }
  aiMoveOrAttack(e, MOVE_PATTERN.ORTHOGONAL);
}

function aiDemonLord(e) {
  bossUpdatePhase(e);
  bossResolveTelegraphs(e);
  bossTickCooldowns(e);
  const cd = e.cooldowns || {};
  // Teleport every 5 turns + telegraph fire AoE on landing.
  if ((cd.teleport || 0) <= 0) {
    const tgt = randomFloorTileNear(state.player, 3, state.player);
    if (tgt) {
      const ox = e.x, oy = e.y;
      e.x = tgt.x; e.y = tgt.y;
      spawnParticles(ox, oy, 18, '#f87171', 3, 30);
      spawnParticles(e.x, e.y, 18, '#f87171', 3, 30);
      addMessage(`${e.name} teleports!`, 'combat');
      // Drop fire AoE around new position.
      bossTelegraphRing(e, e.x, e.y, 10, '#fb923c');
      cd.teleport = e.enraged ? 3 : 5;
      e.cooldowns = cd;
      e.energy -= ACTION_COST.CHARGE;
      return;
    }
  }
  aiMoveOrAttack(e, MOVE_PATTERN.OMNIDIRECTIONAL);
}

function aiTreantElder(e) {
  bossUpdatePhase(e);
  bossResolveTelegraphs(e);
  bossTickCooldowns(e);
  const cd = e.cooldowns || {};
  // Root attack — telegraph cross around player + apply FREEZE.
  if ((cd.root || 0) <= 0 && chebyshev(e, state.player) <= 8) {
    const cx = state.player.x, cy = state.player.y;
    const tiles = [{x:cx,y:cy},{x:cx+1,y:cy},{x:cx-1,y:cy},{x:cx,y:cy+1},{x:cx,y:cy-1}];
    for (const t of tiles) {
      if (t.x < 0 || t.x >= CFG.MAP_W || t.y < 0 || t.y >= CFG.MAP_H) continue;
      if (state.map[t.y][t.x] === TILE.WALL) continue;
      e.telegraphedTiles.push({ x:t.x, y:t.y, ticksLeft:1, dmg:8, color:'#65a30d', type:'physical', applyFreeze:true });
    }
    addMessage(`${e.name} summons roots!`, 'combat');
    cd.root = e.enraged ? 2 : 4;
    e.cooldowns = cd;
    e.energy -= ACTION_COST.CHARGE;
    return;
  }
  // Phase 1 = stationary, Phase 2 = mobile.
  if (e.phase < 2) {
    if (chebyshev(e, state.player) <= 1) {
      enemyAttack(e);
      e.energy -= ACTION_COST.ATTACK;
    } else {
      e.energy -= ACTION_COST.WAIT;
    }
    return;
  }
  aiMoveOrAttack(e, MOVE_PATTERN.ORTHOGONAL);
}

// ─── TELEGRAPH RENDER (called from objectives HUD layer or render hook) ───
function renderBossTelegraphs(ctx, time, offsetX, offsetY, T) {
  for (const e of state.enemies) {
    if (!e.isBoss || !e.telegraphedTiles || e.telegraphedTiles.length === 0) continue;
    for (const t of e.telegraphedTiles) {
      if (!state.visible.has(`${t.x},${t.y}`)) continue;
      const sx = t.x * T + offsetX;
      const sy = t.y * T + offsetY;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.012);
      ctx.save();
      ctx.fillStyle = t.color || 'rgba(239, 68, 68, 0.45)';
      ctx.globalAlpha = 0.35 + 0.4 * pulse;
      ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
      ctx.strokeStyle = t.color || '#ef4444';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
      // Warning glyph.
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#fef3c7';
      ctx.font = `bold ${Math.floor(T * 0.55)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', sx + T / 2, sy + T / 2);
      ctx.restore();
    }
  }
}

// ─── BOSS INTRO BANNER ──────────────────────────
// Drawn at the top of the screen (DOM-overlay-ish via canvas) for ~3 game turns after boss spawn.
function renderBossIntroBanner(ctx, time) {
  if (!state._bossIntroUntil || (state.turns || 0) > state._bossIntroUntil) return;
  const cw = window.innerWidth;
  const cy = window.innerHeight * 0.32;
  ctx.save();
  // Backdrop dim
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, cy - 70, cw, 140);
  // Name
  ctx.font = `bold 38px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 24;
  ctx.fillText((state._bossIntroName || 'BOSS').toUpperCase(), cw / 2, cy - 14);
  // Subtitle
  ctx.shadowBlur = 0;
  ctx.font = `italic 14px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
  ctx.fillText(state._bossIntroSubtitle || '', cw / 2, cy + 22);
  ctx.restore();
}

// ─── REGISTER AI ENTRIES ────────────────────────
// Done in 09-ai.js by extending AI_REGISTRY — we patch here as fallback in case load order differs.
if (typeof AI_REGISTRY !== 'undefined') {
  AI_REGISTRY.cryptLord    = aiCryptLord;
  AI_REGISTRY.golemKing    = aiGolemKing;
  AI_REGISTRY.demonLord    = aiDemonLord;
  AI_REGISTRY.treantElder  = aiTreantElder;
}
