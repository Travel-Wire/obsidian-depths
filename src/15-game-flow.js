// ═══════════════════════════════════════════════
// 15-game-flow.js — initGame, tryMove, gainXP, item flow,
//                    descendStairs, processWorld, endTurn, INIT
// ═══════════════════════════════════════════════

// ─── GAME LOGIC ─────────────────────────────────
function initGame() {
  state = newState();
  // v3-06 — load persisted meta (per-class run stats, unlocks)
  if (typeof loadMeta === 'function') state.meta = loadMeta();
  // v3-06 — apply selected character (overrides stats/equipment/cards). Falls back to 'knight'.
  const charKey = (typeof selectedCharacterKey !== 'undefined' && selectedCharacterKey) ? selectedCharacterKey : 'knight';
  if (typeof applyCharacter === 'function') {
    applyCharacter(state.player, charKey);
  } else {
    equipStartingGear();
  }
  recomputeStats(); // PLAN 05 — initial baseline
  enterFloor(1);
  // v3-06 — character opening line + class banner
  const charDef = (typeof findCharacterDef === 'function') ? findCharacterDef(state.player.classKey) : null;
  if (charDef) {
    addMessage(`${charDef.emoji} ${charDef.fullName} descends into the Obsidian Depths...`, 'descend');
    if (charDef.openingLine) addMessage(charDef.openingLine, 'info');
  } else {
    addMessage('You descend into the Obsidian Depths...', 'descend');
  }
}

function tryMove(dx, dy) {
  if (gamePhase !== 'playing') return;
  if (state.choosingCard) return; // PLAN 05 — modal blocks input
  if (dx === 0 && dy === 0) return;

  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (nx < 0 || nx >= CFG.MAP_W || ny < 0 || ny >= CFG.MAP_H) return;
  if (state.map[ny][nx] === TILE.WALL) return;

  // Pattern check — player is ORTHOGONAL by default (cards may add OMNI later)
  const candidates = getCandidateMoves(state.player.movementPattern, 0);
  const allowed = candidates.some(c => c.dx === dx && c.dy === dy);
  if (!allowed) return;

  // Closed door — open it (1 turn), do not move yet. Player can step through next turn.
  if (state.map[ny][nx] === TILE.DOOR_CLOSED) {
    state.map[ny][nx] = TILE.DOOR_OPEN;
    addMessage('You open the door.', 'info');
    spawnParticles(nx, ny, 6, '#fbbf24', 1.2, 14);
    state.player.energy -= ACTION_COST.WAIT;
    processWorld();
    return;
  }

  const enemy = state.enemies.find(e => e.x === nx && e.y === ny && e.hp > 0);
  if (enemy) {
    attackEnemy(enemy);
    state.player.energy -= ACTION_COST.ATTACK;
    processWorld();
    return;
  }

  // P1.2: warn one step early on a *revealed* pit trap so player isn't surprised.
  const aheadTrap = state.traps.find(t => t.x === nx && t.y === ny && !t.triggered && t.revealed && t.type === 'pit');
  if (aheadTrap && !aheadTrap.warned) {
    aheadTrap.warned = true;
    addMessage('WARNING: pit trap ahead!', 'combat');
    state.player.energy -= ACTION_COST.WAIT;
    processWorld();
    return;
  }

  const oldX = state.player.x, oldY = state.player.y;
  state.player.x = nx;
  state.player.y = ny;
  addMoveAnim(state.player, oldX, oldY);

  // PLAN 05 — Tempest: drop tornado at old tile
  if (state.player.flags && state.player.flags.tempest) {
    state.tornadoes.push({ x: oldX, y: oldY, ttl: 5 });
  }

  // Trap check after move
  const trap = state.traps.find(t => t.x === nx && t.y === ny && !t.triggered);
  if (trap) triggerTrap(trap);

  // PLAN 05 — Magnetic: auto-pickup in r3
  if (state.player.flags && state.player.flags.magnetic) {
    for (let i = state.groundItems.length - 1; i >= 0; i--) {
      const it = state.groundItems[i];
      if (dist(it.x, it.y, state.player.x, state.player.y) <= 3) {
        if (state.inventory.length < CFG.INV_SIZE) {
          state.inventory.push(it);
          state.groundItems.splice(i, 1);
          addMessage(`Picked up ${it.emoji || ''} ${it.name}.`, 'pickup');
          spawnParticles(state.player.x, state.player.y, 6, '#fbbf24', 1.5, 14);
        }
      }
    }
  }

  if (isMobile) autoPickup();
  state.player.energy -= ACTION_COST.MOVE;
  processWorld();
}

function gainXP(amount) {
  // Bone collector bonus (perk) — handled at call sites where enemy is known is hard;
  // simplest: caller pre-multiplies. We can't detect bone enemies here so we leave callers as-is.
  state.player.xp += amount;
  while (state.player.xp >= state.player.xpNext) {
    state.player.xp -= state.player.xpNext;
    state.player.level++;
    state.player.xpNext = Math.floor(state.player.xpNext * 1.5);
    addMessage(`Level up! You are now level ${state.player.level}!`, 'level');
    spawnParticles(state.player.x, state.player.y, 25, '#c084fc', 3, 30);
    // PLAN 05 — refactor: replace hardcoded +6/+1/+1 with card draft.
    // Level scaling for maxHp is preserved via recomputeStats (baseMaxHp + (level-1)*6).
    queueLevelupChoice();
  }
  recomputeStats();
}

function tryAutoEquip(item) {
  // Returns true if item was directly equipped (slot was empty)
  if (item.type === 'weapon' && !state.player.equipment.weapon) {
    state.player.equipment.weapon = item; return true;
  }
  if (item.type === 'armor' && !state.player.equipment.armor) {
    state.player.equipment.armor = item; return true;
  }
  if (item.type === 'offhand' && !state.player.equipment.offhand) {
    const w = state.player.equipment.weapon;
    if (w && w.twoHanded) return false;
    state.player.equipment.offhand = item; return true;
  }
  if (item.type === 'accessory') {
    if (!state.player.equipment.accessory1) { state.player.equipment.accessory1 = item; recomputePlayerMaxHp(); return true; }
    if (!state.player.equipment.accessory2) { state.player.equipment.accessory2 = item; recomputePlayerMaxHp(); return true; }
  }
  return false;
}

function autoPickup() {
  const idx = state.groundItems.findIndex(i => i.x === state.player.x && i.y === state.player.y);
  if (idx === -1) return;
  const item = state.groundItems[idx];
  if (tryAutoEquip(item)) {
    state.groundItems.splice(idx, 1);
    addMessage(`Equipped ${item.emoji || ''} ${item.name}.`, 'pickup');
    spawnParticles(state.player.x, state.player.y, 10, item.color || '#fbbf24', 2, 20);
    return;
  }
  if (state.inventory.length >= CFG.INV_SIZE) return;
  state.groundItems.splice(idx, 1);
  state.inventory.push(item);
  addMessage(`Picked up ${item.emoji || ''} ${item.name}.`, 'pickup');
  spawnParticles(state.player.x, state.player.y, 10, item.color || '#fbbf24', 2, 20);
}

function pickupItem() {
  // v3-04: try opening objective chest first (find_key).
  if (typeof tryOpenObjectiveChest === 'function' && tryOpenObjectiveChest()) {
    state.player.energy -= ACTION_COST.WAIT;
    processWorld();
    return;
  }
  const idx = state.groundItems.findIndex(i => i.x === state.player.x && i.y === state.player.y);
  if (idx === -1) { addMessage('Nothing to pick up here.', 'info'); return; }
  const item = state.groundItems[idx];
  if (tryAutoEquip(item)) {
    state.groundItems.splice(idx, 1);
    addMessage(`Equipped ${item.emoji || ''} ${item.name}.`, 'pickup');
    spawnParticles(state.player.x, state.player.y, 10, item.color || '#fbbf24', 2, 20);
    return;
  }
  if (state.inventory.length >= CFG.INV_SIZE) { addMessage('Inventory full!', 'info'); return; }

  state.groundItems.splice(idx, 1);
  state.inventory.push(item);
  addMessage(`Picked up ${item.emoji || ''} ${item.name}.`, 'pickup');
  spawnParticles(state.player.x, state.player.y, 10, item.color || '#fbbf24', 2, 20);
}

function useItem(slot) {
  if (slot >= state.inventory.length) return;
  const item = state.inventory[slot];
  if (!item) return;

  // Equippable items → equip
  if (item.type === 'weapon' || item.type === 'armor' || item.type === 'offhand' || item.type === 'accessory') {
    equipItem(slot);
    state.player.energy -= ACTION_COST.WAIT;
    processWorld();
    return;
  }

  let consumed = true;
  if (item.effect === 'heal') {
    const healed = Math.min(item.value, state.player.maxHp - state.player.hp);
    state.player.hp += healed;
    addMessage(`Used ${item.name}. Healed ${healed} HP.`, 'pickup');
    spawnParticles(state.player.x, state.player.y, 12, '#34d399', 2, 25);
  } else if (item.effect === 'fireball') {
    addMessage(`The scroll erupts in flames!`, 'combat');
    // v3-06 — Mage Arcane Affinity: scrolls deal +50% effect.
    const scrollMult = (typeof getScrollMultiplier === 'function') ? getScrollMultiplier() : 1;
    state.enemies.forEach(e => {
      if (e.hp > 0 && state.visible.has(key(e.x, e.y))) {
        const d = dist(state.player.x, state.player.y, e.x, e.y);
        if (d <= 5) {
          if (e.vanished) return;
          const baseDmg = Math.max(1, item.value - Math.floor(d));
          const dmg = Math.max(1, Math.floor(baseDmg * scrollMult));
          e.hp -= dmg;
          spawnParticles(e.x, e.y, 12, '#f97316', 3, 25);
          spawnFloatingText(e.x, e.y, `-${dmg}`, '#f97316');
          if (e.hp <= 0) {
            state.kills++;
            gainXP(e.xp);
            onEnemyKilled(e);
            addMessage(`The ${e.name} burns to ash!`, 'combat');
          }
        }
      }
    });
    state.screenShake = 6;
  } else if (item.effect === 'blink') {
    const room = state.rooms[rand(0, state.rooms.length - 1)];
    const ox = state.player.x, oy = state.player.y;
    state.player.x = rand(room.x + 1, room.x + room.w - 2);
    state.player.y = rand(room.y + 1, room.y + room.h - 2);
    spawnParticles(ox, oy, 15, '#38bdf8', 3, 20);
    spawnParticles(state.player.x, state.player.y, 15, '#38bdf8', 3, 20);
    addMessage('You blink to a new location!', 'info');
  } else if (item.effect === 'unlock') {
    addMessage(`${item.name}: nothing to unlock here.`, 'info');
    consumed = false;
  } else {
    consumed = false;
  }

  if (consumed) state.inventory.splice(slot, 1);
  state.player.energy -= ACTION_COST.WAIT;
  processWorld();
}

function descendStairs() {
  // PLAN 05: block while choosing card / pending levelups
  if (state.choosingCard || (state.pendingLevelups && state.pendingLevelups > 0)) {
    addMessage('Choose your card first!', 'info');
    return;
  }
  if (state.player.x !== state.stairsPos.x || state.player.y !== state.stairsPos.y) {
    addMessage('No stairs here.', 'info');
    return;
  }

  // v3-04: stairs locked until floor objective completed.
  if (typeof canDescendStairs === 'function' && !canDescendStairs()) {
    addMessage('The stairs do not open. Complete the floor objective first.', 'info');
    return;
  }

  // P1.1 CRITICAL FIX: gamePhase='won' on floor>=MAX_FLOOR descent.
  // Previously the won state was reachable but win-screen reliability depended on this guard firing
  // BEFORE state.floor++ tries to call enterFloor(11) which would crash (no FLOOR_OBJECTIVES[11]).
  if (state.floor >= CFG.MAX_FLOOR) {
    gamePhase = 'won';
    if (typeof recordBestFloor === 'function') recordBestFloor();
    showWinScreen();
    return;
  }

  state.floor++;
  enterFloor(state.floor);
  if (typeof recordBestFloor === 'function') recordBestFloor();
  addMessage(`You descend to floor ${state.floor}...`, 'descend');
}

function processWorld() {
  if (gamePhase !== 'playing') return;
  state.worldTick++;
  state.turns++;

  // PLAN 05 — card per-turn ticks BEFORE enemy actions (fire aura, ice aura, regen, tornado, allies, sprinter)
  processCardTicks();
  tickActiveCooldowns();
  // v3-06 — class passive world-tick (Resolve cooldown/duration, Bloodthirst chain timeout)
  if (typeof processPassive === 'function') processPassive('worldTick');

  // Energy charge
  let pSpeed = getEffectiveSpeed(state.player);
  // Sprinter: speed +50% if 5+ combat-free turns
  if (state.player.flags && state.player.flags.sprinter && state.player.sprinterTicks >= 5) {
    pSpeed = Math.floor(pSpeed * 1.5);
  }
  state.player.energy += pSpeed;
  for (const e of state.enemies) {
    if (e.hp > 0) e.energy += getEffectiveSpeed(e);
  }

  // Enemy actions until exhausted
  let safety = 64;
  let anyActed = true;
  while (anyActed && safety-- > 0) {
    anyActed = false;
    const queue = state.enemies
      .filter(e => e.hp > 0 && e.energy >= ACTION_COST.MOVE)
      .sort((a, b) => b.energy - a.energy);
    for (const e of queue) {
      if (e.hp <= 0) continue;
      if (e.energy < ACTION_COST.MOVE) continue;
      enemyAct(e);
      anyActed = true;
      if (gamePhase !== 'playing') break;
    }
    if (gamePhase !== 'playing') break;
  }

  // ─── RESURRECT PASS (skeleton reviver) ───
  for (const e of state.enemies) {
    if (e.hp > 0) continue;
    if (e.ai !== 'reviver' || e.revived) continue;
    const ally = nearestAlly(e, a => a.ai === 'reviver' && a.hp > 0 && !a.revived, e.reviveRange || 3);
    if (ally) {
      e.hp = Math.max(1, Math.floor(e.maxHp * 0.5));
      e.revived = true;
      addMessage(`A ${e.name} rises from the dead!`, 'combat');
      spawnParticles(e.x, e.y, 18, '#a78bfa', 2.5, 30);
    }
  }

  // ─── SPLIT PASS (slime splitter) ───
  for (const e of state.enemies.slice()) {
    if (e.hp > 0) continue;
    if (e.ai !== 'splitter') continue;
    if (e.splitProcessed) continue;
    e.splitProcessed = true;
    if ((e.splitGen || 0) <= 0) continue;
    if (e.maxHp < (e.splitMinHp || 8)) continue;
    const def = ENEMY_DEFS.find(d => d.key === e.key);
    if (!def) continue;
    let placed = 0;
    for (let k = 0; k < 2; k++) {
      if (placeChild(e, def)) placed++;
    }
    if (placed > 0) addMessage(`The ${e.name} splits!`, 'combat');
  }

  // ─── WEB EMIT PASS (spider death) ───
  for (const e of state.enemies) {
    if (e.hp > 0) continue;
    if (e.webOnDeath && !e.webEmitted) {
      e.webEmitted = true;
      state.webTiles.push({ x: e.x, y: e.y, ttl: 30 });
    }
  }

  // ─── WEB TICK ───
  if (state.webTiles && state.webTiles.length > 0) {
    for (const w of state.webTiles) w.ttl--;
    state.webTiles = state.webTiles.filter(w => w.ttl > 0);
  }

  // Player web check
  if (state.webTiles.find(w => w.x === state.player.x && w.y === state.player.y)) {
    addStatusEffect(state.player, STATUS.SLOW, 2, 0);
  }

  tickStatusEffects();
  if (gamePhase !== 'playing') return;

  // v3-04: tick floor objectives (race curse drain, completion checks, etc.)
  if (typeof tickObjectives === 'function') tickObjectives();

  state.visible = computePlayerFOV();
  markExplored();
  state.enemies = state.enemies.filter(e => e.hp > 0);

  // Perf P1.3 + v3-03: invalidate render & minimap after every world tick.
  state.dirty = true;
  state.minimapDirty = true;
}

// Wait-action alias (kept for keybinding compatibility)
function endTurn() {
  if (gamePhase !== 'playing') return;
  if (state.choosingCard) return;
  state.player.energy -= ACTION_COST.WAIT;
  processWorld();
}

// ─── INIT ───────────────────────────────────────
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(render);
