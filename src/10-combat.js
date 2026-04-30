// ═══════════════════════════════════════════════
// 10-combat.js — Player attack, enemy attack, status effects
// ═══════════════════════════════════════════════

// v3-02 — find equipped Legendary with given unique mechanic id (or null)
function findEquippedUnique(uniqueId) {
  const eq = state.player.equipment;
  for (const k of ['weapon','armor','offhand','accessory1','accessory2']) {
    const it = eq[k];
    if (!it) continue;
    if (it.dur != null && it.dur <= 0) continue;
    if (it.unique && it.unique.id === uniqueId) return it.unique;
  }
  return null;
}

function attackEnemy(enemy) {
  // Mimic reveal on attack
  if (enemy.state === 'DISGUISED') {
    enemy.state = 'ACTIVE';
    enemy.awake = true;
    addMessage('It was a mimic!', 'combat');
  }
  // Bat dodge
  if (enemy.dodge && enemy.hp / enemy.maxHp < 0.5 && Math.random() < enemy.dodge) {
    spawnFloatingText(enemy.x, enemy.y, 'miss', '#94a3b8');
    return;
  }
  // Ghost vanished — untargetable
  if (enemy.vanished) {
    spawnFloatingText(enemy.x, enemy.y, 'phased', '#cbd5e1');
    return;
  }

  // PLAN 05: card mods
  const p = state.player;
  const flags = p.flags || {};
  // sprinter: combat resets timer
  if (flags.sprinter) p.sprinterTicks = 0;

  let isCrit = Math.random() < getPlayerCritChance();
  // Dagger Dance: charged crit
  if (flags.daggerDanceCharged) { isCrit = true; flags.daggerDanceCharged = false; }
  const baseAtk = getPlayerAtk();
  // Accuracy: reduce variance lower-bound
  const variance = (p.accuracyBonus && p.accuracyBonus > 0) ? rand(0, 1) : rand(-1, 1);
  let dmg = Math.max(1, baseAtk - (enemy.def || 0) + variance);

  // Weapon-type synergies
  const wt = getWeaponType();
  if (flags.swordMastery && (wt === 'sword' || wt === 'dagger')) dmg = Math.floor(dmg * 1.3);
  if (flags.marksman && wt === 'bow') {
    dmg = Math.floor(dmg * 1.5) + Math.floor((enemy.def || 0) * 0.5);
  }
  if (flags.berserker && wt === 'axe' && p.hp / p.maxHp < 0.5) dmg = Math.floor(dmg * 2);
  if (flags.maceCrusher && (wt === 'hammer' || wt === 'mace')) dmg += (enemy.def || 0); // ignore DEF
  if (flags.dragonsBlood && (enemy.key === 'dragon' || enemy.key === 'demon' || enemy.key === 'golem')) {
    dmg = Math.floor(dmg * 1.5);
  }

  // Tactical: first hit on enemy this turn
  if (flags.tactical && p.attackedThisTurn && !p.attackedThisTurn.has(enemy)) {
    dmg = Math.floor(dmg * 1.5);
  }
  if (p.attackedThisTurn) p.attackedThisTurn.add(enemy);

  if (isCrit) dmg = dmg * 2;
  enemy.hp -= dmg;

  // Lifesteal
  if (p.lifestealPct > 0) {
    const heal = Math.max(1, Math.floor(dmg * p.lifestealPct));
    p.hp = Math.min(p.maxHp, p.hp + heal);
    spawnFloatingText(p.x, p.y, `+${heal}`, '#dc2626');
  }

  spawnParticles(enemy.x, enemy.y, 8, isCrit ? '#fbbf24' : '#f87171', 2.5, 20);
  spawnFloatingText(enemy.x, enemy.y, isCrit ? `CRIT -${dmg}` : `-${dmg}`, isCrit ? '#fbbf24' : '#f87171');
  state.screenShake = isCrit ? 6 : 4;

  // Weapon durability tick
  damageWeaponDur(getEquippedWeapon(), isCrit);

  // Doppelganger / Dual Wield: chance for second strike
  let secondStrike = false;
  if (flags.doppelganger && Math.random() < 0.25) secondStrike = true;
  else if (flags.dualWield && Math.random() < 0.25) secondStrike = true;

  if (enemy.hp <= 0) {
    addMessage(`You slay the ${enemy.name}! (+${enemy.xp} XP)`, 'combat');
    state.kills++;
    spawnParticles(enemy.x, enemy.y, 20, enemy.color || '#ef4444', 3, 35);
    gainXP(enemy.xp);
    onEnemyKilled(enemy);
    // v3-02 — Legendary "The Reaver": on-kill heal (in addition to lifesteal)
    const reaver = findEquippedUnique('on_kill_heal');
    if (reaver) {
      const heal = reaver.value || 5;
      const before = state.player.hp;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
      const gained = state.player.hp - before;
      if (gained > 0) spawnFloatingText(state.player.x, state.player.y, `+${gained}`, '#fbbf24');
    }
  } else {
    addMessage(`You hit the ${enemy.name} for ${dmg} damage.`, 'combat');
    if (secondStrike) {
      const dmg2 = Math.max(1, Math.floor(dmg * 0.5));
      enemy.hp -= dmg2;
      spawnFloatingText(enemy.x, enemy.y, `+${dmg2}`, '#a78bfa');
      if (enemy.hp <= 0) {
        addMessage(`Second strike kills the ${enemy.name}!`, 'combat');
        state.kills++;
        gainXP(enemy.xp);
        onEnemyKilled(enemy);
      }
    }
  }
}

function enemyAttack(enemy) {
  const p = state.player;
  const flags = p.flags || {};

  // PLAN 05: Cat Reflexes / dodge chance
  if (p.dodgeChance && Math.random() < p.dodgeChance) {
    spawnFloatingText(p.x, p.y, 'DODGE', '#22d3ee');
    return;
  }

  const incoming = Math.max(1, enemy.atk + rand(-1, 1));
  const ignoreDef = enemy.ignoresDef === true;
  const totalDef = ignoreDef ? 0 : getPlayerDef();

  // Offhand block
  const oh = getEquippedOffhand();
  if (oh && oh.dur > 0 && oh.blockChance && Math.random() < oh.blockChance) {
    addMessage(`You block the ${enemy.name}'s attack!`, 'combat');
    spawnFloatingText(state.player.x, state.player.y, 'BLOCK', '#60a5fa');
    // Mythril Body P2.1: reduce wear by 50% (was full skip)
    damageArmorDur(oh, flags.mythrilBody ? Math.ceil(incoming * 0.5) : incoming);
    return;
  }

  let dmg = Math.max(1, incoming - totalDef);
  // Resilient Aura: -1 dmg
  if (flags.resilientAura) dmg = Math.max(1, dmg - 1);
  // Mythril Body (P2.1): cap at 50% reduction (was -2 flat / immunity to dur)
  if (flags.mythrilBody) dmg = Math.max(1, Math.ceil(dmg * 0.5));
  // Endurance: % reduction
  if (p.dmgReduction > 0) dmg = Math.max(1, Math.ceil(dmg * (1 - p.dmgReduction)));
  state.player.hp -= dmg;
  if (flags.sprinter) p.sprinterTicks = 0;
  spawnParticles(state.player.x, state.player.y, 6, '#ef4444', 2, 18);
  spawnFloatingText(state.player.x, state.player.y, `-${dmg}`, '#ef4444');
  state.screenShake = 3;
  addMessage(`The ${enemy.name} hits you for ${dmg} damage!`, 'combat');

  // v3-02 — Affix reflect (Aegis / Thorny): bounce a fraction of incoming melee dmg
  let reflectPct = 0;
  for (const slotKey of ['armor','offhand','accessory1','accessory2']) {
    const it = p.equipment[slotKey];
    if (!it || (it.dur != null && it.dur <= 0)) continue;
    if (it.unique && it.unique.id === 'reflect_50') reflectPct = Math.max(reflectPct, it.unique.value || 0.5);
  }
  if (flags.affixReflect) reflectPct = Math.max(reflectPct, flags.affixReflect);
  if (reflectPct > 0 && enemy.hp > 0) {
    const refl = Math.max(1, Math.floor(incoming * reflectPct));
    enemy.hp -= refl;
    spawnFloatingText(enemy.x, enemy.y, `↩-${refl}`, '#fbbf24');
    if (enemy.hp <= 0) { state.kills++; gainXP(enemy.xp); onEnemyKilled(enemy); }
  }

  // v3-02 — Legendary "Obsidian Heart": once-per-floor revive at lethal hit
  if (state.player.hp <= 0) {
    const heart = findEquippedUnique('floor_revive');
    if (heart && !state.heartUsedThisFloor) {
      state.heartUsedThisFloor = true;
      state.player.hp = Math.max(1, Math.floor(state.player.maxHp * 0.5));
      spawnParticles(state.player.x, state.player.y, 24, '#a78bfa', 3, 32);
      spawnFloatingText(state.player.x, state.player.y, 'REVIVE!', '#a78bfa');
      addMessage('Obsidian Heart pulses — you revive!', 'level');
    }
  }

  // Armor durability tick (Mythril Body now reduces wear instead of skipping it)
  const armorWear = flags.mythrilBody ? Math.ceil(incoming * 0.5) : incoming;
  damageArmorDur(getEquippedArmor(), armorWear);

  // Status effect emit
  if (enemy.poison) addStatusEffect(state.player, STATUS.POISON, enemy.poison.ticks, enemy.poison.dmg);
  if (enemy.bleed)  addStatusEffect(state.player, STATUS.BLEED,  enemy.bleed.ticks,  enemy.bleed.dmg);
  if (enemy.ai === 'xpdrainer' && enemy.drainXp) {
    const drained = Math.min(state.player.xp, enemy.drainXp);
    state.player.xp -= drained;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + drained);
    spawnFloatingText(state.player.x, state.player.y, `-${drained} XP`, '#c084fc');
  }

  if (state.player.hp <= 0) {
    state.player.hp = 0;
    gamePhase = 'dead';
    showDeathScreen();
  }
}

// ─── STATUS EFFECTS ──────────────────────────
function addStatusEffect(entity, type, ticks, magnitude) {
  if (!entity.statusEffects) entity.statusEffects = [];
  // Immunity check
  if (entity.immune && Array.isArray(entity.immune) && entity.immune.includes(type)) {
    return;
  }
  const existing = entity.statusEffects.find(e => e.type === type);
  if (existing) {
    existing.ticksLeft = Math.max(existing.ticksLeft, ticks);
    existing.magnitude = Math.max(existing.magnitude || 0, magnitude || 0);
    return;
  }
  entity.statusEffects.push({ type, ticksLeft: ticks, magnitude: magnitude || 0 });
}

function applyStatusEffects(entity) {
  if (!entity.statusEffects) return;
  for (const fx of entity.statusEffects) {
    if (fx.type === STATUS.POISON) {
      const dmg = fx.magnitude || 1;
      entity.hp -= dmg;
      spawnFloatingText(entity.x, entity.y, `-${dmg}`, '#4ade80');
    } else if (fx.type === STATUS.BLEED) {
      const dmg = fx.magnitude || 1;
      entity.hp -= dmg;
      spawnFloatingText(entity.x, entity.y, `-${dmg}`, '#dc2626');
    } else if (fx.type === STATUS.REGEN) {
      const heal = fx.magnitude || 1;
      entity.hp = Math.min(entity.maxHp || entity.hp + heal, entity.hp + heal);
    }
  }
}

function tickStatusEffects() {
  // Player
  applyStatusEffects(state.player);
  if (state.player.statusEffects) {
    for (const fx of state.player.statusEffects) fx.ticksLeft--;
    state.player.statusEffects = state.player.statusEffects.filter(fx => fx.ticksLeft > 0);
  }
  // Legacy poisoned counter (plan 01)
  if (state.player.poisoned > 0) {
    const dmg = rand(2, 4);
    state.player.hp -= dmg;
    state.player.poisoned--;
    spawnFloatingText(state.player.x, state.player.y, `-${dmg}`, '#4ade80');
  }
  if (state.player.hp <= 0 && gamePhase === 'playing') {
    state.player.hp = 0;
    gamePhase = 'dead';
    showDeathScreen();
    return;
  }
  // Enemies
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    applyStatusEffects(e);
    if (e.statusEffects) {
      for (const fx of e.statusEffects) fx.ticksLeft--;
      e.statusEffects = e.statusEffects.filter(fx => fx.ticksLeft > 0);
    }
  }
}
