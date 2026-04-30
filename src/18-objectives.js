// ═══════════════════════════════════════════════
// 18-objectives.js — Floor objectives system (v3-04 MVP)
// MVP scope: 5 of 10 objective types implemented.
//   slay_beast, find_key, defeat_boss, race_curse, no_damage_bonus
// Other 5 (survive_tide, slay_champion, reach_altar, cleanse_pools, loot_vault) = placeholder fallback to slay_beast.
// HUD tracker top-center, stairs gated to completion.
// ═══════════════════════════════════════════════

// ─── OBJECTIVE_DEFS ─────────────────────────────
// Wszystkie objectives mają: id, name, hudText(p,t,extra)→string, isComplete(state)→bool, onSetup(floor)→void
const OBJECTIVE_DEFS = {
  slay_beast: {
    id: 'slay_beast',
    name: 'Slay the Beast',
    hudText: (p, t) => `Slay the Beast (${p}/${t})`,
    setup(floor) {
      // target = enemy count present at floor entry (after populate). Counted live.
      const targetCount = state.enemies.filter(e => !e.allied).length;
      state.currentObjective.target = Math.max(1, targetCount);
      state.currentObjective.progress = 0;
    },
    isComplete() {
      const aliveHostile = state.enemies.filter(e => e.hp > 0 && !e.allied).length;
      return aliveHostile === 0;
    },
    progressFor() {
      const total = state.currentObjective.target || 1;
      const aliveHostile = state.enemies.filter(e => e.hp > 0 && !e.allied).length;
      return Math.max(0, total - aliveHostile);
    },
  },
  find_key: {
    id: 'find_key',
    name: 'Find the Key',
    hudText: (p, t) => `Find the Key (${p}/${t})`,
    setup(floor) {
      state.currentObjective.target = 1;
      state.currentObjective.progress = 0;
      state.hasObjectiveKey = false;
      // Spawn 3-5 chests; key in one of them.
      const numChests = 3 + Math.floor(floor / 3);
      const chestList = [];
      for (let i = 1; i < state.rooms.length && chestList.length < numChests; i++) {
        const room = state.rooms[i];
        const free = findFreeTileInRoom(room, [...state.enemies, ...state.groundItems, ...chestList]);
        if (!free) continue;
        chestList.push({ x: free.x, y: free.y, opened: false, hasKey: false });
      }
      if (chestList.length > 0) {
        chestList[rand(0, chestList.length - 1)].hasKey = true;
      }
      state.objectiveChests = chestList;
    },
    isComplete() {
      return !!state.hasObjectiveKey;
    },
    progressFor() {
      return state.hasObjectiveKey ? 1 : 0;
    },
  },
  defeat_boss: {
    id: 'defeat_boss',
    name: 'Defeat the Boss',
    hudText(p, t, extra) {
      const bossName = (extra && extra.bossName) || 'the Boss';
      return `Defeat ${bossName} (${p}/${t})`;
    },
    setup(floor) {
      state.currentObjective.target = 1;
      state.currentObjective.progress = 0;
      // Boss spawning is handled by spawnBoss() in dungeon flow.
    },
    isComplete() {
      const bossKey = state.currentObjective.bossKey;
      if (!bossKey) return false;
      // Complete when boss is gone (killed) and was previously present.
      const stillAlive = state.enemies.some(e => e.hp > 0 && e.bossKey === bossKey);
      return state.bossDefeated && state.bossDefeated.includes(bossKey) && !stillAlive;
    },
    progressFor() {
      return this.isComplete() ? 1 : 0;
    },
  },
  race_curse: {
    id: 'race_curse',
    name: 'Race the Curse',
    hudText: () => `Race the Curse — HP drains!`,
    setup(floor) {
      state.currentObjective.target = 1;
      state.currentObjective.progress = 0;
      state.curseActive = true;
      state.curseLastTickTurn = state.turns;
    },
    isComplete() {
      // Auto-complete when player reaches stairs tile (handled in tick).
      return state.currentObjective._reachedStairs === true;
    },
    progressFor() {
      return this.isComplete() ? 1 : 0;
    },
  },
  // ─── PLACEHOLDERS — fallback to slay_beast behavior (MVP cut) ───
  survive_tide:   { id:'survive_tide',   name:'Survive the Tide (placeholder)',   hudText:(p,t)=>`Survive (${p}/${t})`,    setup(f){ OBJECTIVE_DEFS.slay_beast.setup(f); }, isComplete(){ return OBJECTIVE_DEFS.slay_beast.isComplete(); }, progressFor(){ return OBJECTIVE_DEFS.slay_beast.progressFor(); } },
  slay_champion:  { id:'slay_champion',  name:'Slay the Champion (placeholder)',  hudText:(p,t)=>`Champion (${p}/${t})`,   setup(f){ OBJECTIVE_DEFS.slay_beast.setup(f); }, isComplete(){ return OBJECTIVE_DEFS.slay_beast.isComplete(); }, progressFor(){ return OBJECTIVE_DEFS.slay_beast.progressFor(); } },
  reach_altar:    { id:'reach_altar',    name:'Reach the Altar (placeholder)',    hudText:()=>`Reach the Altar`,           setup(f){ OBJECTIVE_DEFS.slay_beast.setup(f); }, isComplete(){ return OBJECTIVE_DEFS.slay_beast.isComplete(); }, progressFor(){ return OBJECTIVE_DEFS.slay_beast.progressFor(); } },
  cleanse_pools:  { id:'cleanse_pools',  name:'Cleanse the Pools (placeholder)',  hudText:(p,t)=>`Cleanse (${p}/${t})`,    setup(f){ OBJECTIVE_DEFS.slay_beast.setup(f); }, isComplete(){ return OBJECTIVE_DEFS.slay_beast.isComplete(); }, progressFor(){ return OBJECTIVE_DEFS.slay_beast.progressFor(); } },
  loot_vault:     { id:'loot_vault',     name:'Loot the Vault (placeholder)',     hudText:(p,t)=>`Vault (${p}/${t})`,      setup(f){ OBJECTIVE_DEFS.slay_beast.setup(f); }, isComplete(){ return OBJECTIVE_DEFS.slay_beast.isComplete(); }, progressFor(){ return OBJECTIVE_DEFS.slay_beast.progressFor(); } },
};

// ─── FLOOR_OBJECTIVES (deterministic mapping) ───
const FLOOR_OBJECTIVES = {
  1:  { main: 'slay_beast' },
  2:  { main: 'defeat_boss', bossKey: 'crypt_lord' },
  3:  { main: 'find_key' },
  4:  { main: 'defeat_boss', bossKey: 'golem_king' },
  5:  { main: 'survive_tide' }, // placeholder → slay_beast behavior
  6:  { main: 'defeat_boss', bossKey: 'demon_lord' },
  7:  { main: 'reach_altar' },  // placeholder → slay_beast behavior
  8:  { main: 'defeat_boss', bossKey: 'treant_elder' },
  9:  { main: 'race_curse' },
  10: { main: 'defeat_boss', bossKey: 'dragon' },
};

// ─── STATE INIT (called from enterFloor) ────────
function initObjectiveState() {
  if (!state.bossDefeated) state.bossDefeated = [];
  if (!state.bossArenaLocked) state.bossArenaLocked = false;
  state.currentObjective = { id: null, progress: 0, target: 1, complete: false, bossKey: null, _reachedStairs: false };
  state.objectiveCompleted = false;
  state.objectiveCompletedAt = 0;
  state.bonusNoDamageActive = true;     // resets each floor
  state.floorEnteredHp = state.player.hp;
  state.floorEnteredTurn = state.turns;
  state.curseActive = false;
  state.objectiveChests = [];
  state.hasObjectiveKey = false;
  state.objectiveBossName = null;
}

function setupFloorObjective(floor) {
  initObjectiveState();
  const fo = FLOOR_OBJECTIVES[floor] || { main: 'slay_beast' };
  const def = OBJECTIVE_DEFS[fo.main] || OBJECTIVE_DEFS.slay_beast;
  state.currentObjective.id = def.id;
  state.currentObjective.bossKey = fo.bossKey || null;
  if (fo.bossKey && typeof BOSS_DEFS !== 'undefined' && BOSS_DEFS[fo.bossKey]) {
    state.objectiveBossName = BOSS_DEFS[fo.bossKey].name;
  }
  // Run setup hook AFTER enemies/items have populated.
  try { def.setup(floor); } catch (e) { console.error('[objective.setup]', e); }
}

// ─── PER-TURN TICKS ─────────────────────────────
function tickObjectives() {
  if (!state.currentObjective || !state.currentObjective.id) return;
  const def = OBJECTIVE_DEFS[state.currentObjective.id];
  if (!def) return;

  // Race curse drain — 1 HP per 2 turns when not in combat (chebyshev to nearest enemy > 1).
  if (state.curseActive) {
    const adjEnemy = state.enemies.some(e => e.hp > 0 && Math.max(Math.abs(e.x - state.player.x), Math.abs(e.y - state.player.y)) <= 1);
    if (!adjEnemy && (state.turns - (state.curseLastTickTurn || 0)) >= 2) {
      state.curseLastTickTurn = state.turns;
      state.player.hp = Math.max(1, state.player.hp - 1);
      spawnFloatingText(state.player.x, state.player.y, '-1 curse', '#a78bfa');
    }
    // Auto-mark complete on stairs tile
    if (state.player.x === state.stairsPos.x && state.player.y === state.stairsPos.y) {
      state.currentObjective._reachedStairs = true;
    }
  }

  // Update progress display.
  try {
    state.currentObjective.progress = def.progressFor();
  } catch (e) {}

  // Check completion (one-shot).
  if (!state.objectiveCompleted) {
    let done = false;
    try { done = def.isComplete(); } catch (e) {}
    if (done) {
      state.objectiveCompleted = true;
      state.objectiveCompletedAt = state.turns;
      addMessage('Objective Complete! Stairs unlocked.', 'descend');
      spawnParticles(state.player.x, state.player.y, 24, '#fbbf24', 3, 50);
      state.screenShake = Math.max(state.screenShake, 4);
    }
  }
}

// Hook called after enemy kill to also flag boss kill.
function objectivesOnEnemyKilled(enemy) {
  if (enemy && enemy.isBoss && enemy.bossKey) {
    if (!state.bossDefeated) state.bossDefeated = [];
    if (!state.bossDefeated.includes(enemy.bossKey)) {
      state.bossDefeated.push(enemy.bossKey);
    }
    state.bossArenaLocked = false;
    addMessage(`${(enemy.name || 'The Boss').toUpperCase()} HAS FALLEN!`, 'descend');
    spawnParticles(enemy.x, enemy.y, 60, '#fbbf24', 5, 80);
    state.screenShake = Math.max(state.screenShake, 12);
    // Drop legendary boss-specific item if BOSS_DROPS available.
    if (typeof spawnBossDrop === 'function') spawnBossDrop(enemy);
    // Show boss death banner via UI.
    state._bossDeathBannerUntil = (state.turns || 0) + 4;
  }
}

// Hook called when player takes damage.
function objectivesOnPlayerDamage(amount) {
  if (amount > 0) state.bonusNoDamageActive = false;
}

// ─── HUD RENDER ─────────────────────────────────
// Draws top-center objective tracker. Called from render() each frame.
function renderObjectiveHud(ctx, time) {
  if (!state.currentObjective || !state.currentObjective.id) return;
  const def = OBJECTIVE_DEFS[state.currentObjective.id];
  if (!def) return;
  const progress = state.currentObjective.progress | 0;
  const target = state.currentObjective.target | 0;
  const extra = { bossName: state.objectiveBossName };
  const mainText = def.hudText(progress, target, extra);

  const cw = window.innerWidth;
  const w = 320, h = state.bonusNoDamageActive !== undefined ? 56 : 38;
  const x = (cw - w) / 2;
  const y = 12;

  ctx.save();
  // Background panel
  ctx.fillStyle = state.objectiveCompleted ? 'rgba(40, 30, 0, 0.85)' : 'rgba(0, 0, 0, 0.65)';
  ctx.strokeStyle = state.objectiveCompleted ? 'rgba(251, 191, 36, 0.85)' : 'rgba(255, 180, 60, 0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  // Main objective text
  ctx.font = `bold 13px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (state.objectiveCompleted) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.005);
    ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
    ctx.fillText(`✓ ${mainText}`, x + w / 2, y + 8);
  } else {
    ctx.fillStyle = '#fafafa';
    ctx.fillText(mainText, x + w / 2, y + 8);
  }
  // Bonus row (faded)
  ctx.font = `italic 10px 'JetBrains Mono', monospace`;
  ctx.fillStyle = state.bonusNoDamageActive ? 'rgba(34, 211, 238, 0.55)' : 'rgba(120, 120, 120, 0.4)';
  const bonusText = state.bonusNoDamageActive ? 'Bonus: No Damage Run [active]' : 'Bonus: No Damage [failed]';
  ctx.fillText(bonusText, x + w / 2, y + 28);
  ctx.restore();

  // Boss death banner
  if (state._bossDeathBannerUntil && (state.turns || 0) <= state._bossDeathBannerUntil) {
    ctx.save();
    ctx.font = `bold 28px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 24;
    ctx.fillText('VICTORY', cw / 2, window.innerHeight * 0.35);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Render objective chests (find_key) on the canvas.
function renderObjectiveChests(ctx, time, offsetX, offsetY, T) {
  if (!state.objectiveChests) return;
  for (const c of state.objectiveChests) {
    if (c.opened) continue;
    if (!state.visible.has(`${c.x},${c.y}`)) continue;
    const sx = c.x * T + offsetX + T / 2;
    const sy = c.y * T + offsetY + T / 2;
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10 + Math.sin(time * 0.005) * 4;
    ctx.font = `${T - 6}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🟫', sx, sy + 1);
    ctx.restore();
  }
}

// Player tries to open a chest (called on G-key pickup).
function tryOpenObjectiveChest() {
  if (!state.objectiveChests || state.objectiveChests.length === 0) return false;
  const c = state.objectiveChests.find(ch => ch.x === state.player.x && ch.y === state.player.y && !ch.opened);
  if (!c) return false;
  c.opened = true;
  if (c.hasKey) {
    state.hasObjectiveKey = true;
    addMessage('You found the Key! 🗝️', 'pickup');
    spawnParticles(c.x, c.y, 18, '#fbbf24', 3, 35);
  } else {
    addMessage('The chest is empty.', 'info');
    spawnParticles(c.x, c.y, 10, '#71717a', 2, 22);
  }
  return true;
}

// Stairs gating: returns true if player can descend.
function canDescendStairs() {
  // Wins floor — completed objective OR was no objective set.
  return !state.currentObjective || !state.currentObjective.id || state.objectiveCompleted;
}
