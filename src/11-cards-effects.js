// ═══════════════════════════════════════════════
// 11-cards-effects.js — Card helpers, modal, applyCard, recomputeStats,
//                        active skills, per-turn card hooks
// ═══════════════════════════════════════════════

// ─── CARD HELPERS ─────────────────────────────
function findCardDef(id) { return CARD_DEFS.find(c => c.id === id); }

function playerCardStack(id) {
  if (!state || !state.cards) return 0;
  const c = state.cards.find(c => c.id === id);
  return c ? c.stacks : 0;
}

function playerHasCard(id, minStack = 1) { return playerCardStack(id) >= minStack; }

function getWeaponType() {
  const w = getEquippedWeapon();
  if (!w) return null;
  const id = (w.id || '').toLowerCase();
  if (id.includes('dagger') || id.includes('knife')) return 'dagger';
  if (id.includes('sword'))   return 'sword';
  if (id.includes('axe'))     return 'axe';
  if (id.includes('hammer'))  return 'hammer';
  if (id.includes('mace') || id.includes('club'))    return 'mace';
  if (id.includes('bow'))     return 'bow';
  if (id.includes('wand') || w.magic) return 'wand';
  return null;
}

function isCardAvailable(card) {
  const p = state.player;
  // Maxed?
  const stack = playerCardStack(card.id);
  if (stack >= (card.maxStacks || 1)) return false;
  // Prereqs
  if (card.prereqs) {
    if (card.prereqs.cards) {
      for (const req of card.prereqs.cards) {
        if (!playerHasCard(req.id, req.minStack || 1)) return false;
      }
    }
    if (card.prereqs.minPlayerLevel && p.level < card.prereqs.minPlayerLevel) return false;
    if (card.prereqs.weaponType) {
      const wt = getWeaponType();
      if (!wt || !card.prereqs.weaponType.includes(wt)) return false;
    }
  }
  // F13: synergy cards always require lvl >= 6
  if (card.category === 'synergy' && p.level < 6) return false;
  // Active skill: max 2 active in build (replace not implemented — block third)
  if (card.category === 'active') {
    const activeCount = state.activeSkills.length;
    if (activeCount >= 2 && !state.activeSkills.find(a => a.id === card.id)) return false;
  }
  return true;
}

function rollTier(forceLegendary) {
  if (forceLegendary) return 'legendary';
  const r = Math.random();
  if (r < 0.10) return 'legendary';
  if (r < 0.40) return 'rare';
  return 'common';
}

function weightedPick(arr, weightFn) {
  const total = arr.reduce((s, x) => s + (weightFn ? weightFn(x) : 1), 0);
  let r = Math.random() * total;
  for (const x of arr) {
    r -= (weightFn ? weightFn(x) : 1);
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}

function drawCardChoices(count = 3) {
  const pool = CARD_DEFS.filter(c => isCardAvailable(c));
  if (pool.length === 0) return [];
  const choices = [];
  // P2.2 — pity threshold tuned 7 → 10 (less hojny: 3-4/run → ~2/run)
  const pityHit = state.pityCounter >= (CFG_CARDS && CFG_CARDS.PITY_THRESHOLD || 10);
  for (let i = 0; i < count; i++) {
    const tierForce = (pityHit && i === 0) ? 'legendary' : null;
    const tier = tierForce || rollTier();
    let tierPool = pool.filter(c => c.tier === tier && !choices.includes(c));
    if (tierPool.length === 0) tierPool = pool.filter(c => !choices.includes(c));
    if (tierPool.length === 0) break;
    const card = weightedPick(tierPool, c => c.weight || 1.0);
    choices.push(card);
  }
  return choices;
}

function applyCard(card) {
  const existing = state.cards.find(c => c.id === card.id);
  if (existing) existing.stacks++;
  else state.cards.push({ id: card.id, stacks: 1 });

  // pity counter
  if (card.tier === 'legendary') state.pityCounter = 0;
  else state.pityCounter++;

  // Reroll bonus from "insight" — currently +1 reroll only on legendary as small QoL
  // (Plan does not include explicit insight card; keep hook: legendary adds +1 reroll if not present)

  // Active skill: bind to first free slot
  if (card.category === 'active') {
    const exists = state.activeSkills.find(a => a.id === card.id);
    if (!exists) {
      const slot = state.activeSkills.length; // 0 → Q, 1 → E
      if (slot < 2) {
        state.activeSkills.push({ id: card.id, cdRemaining: 0, slot });
      }
    }
  }

  recomputeStats();

  if (card.onPick) card.onPick(state.player, state);

  addMessage(`Acquired ${card.emoji} ${card.name}!`, 'level');
  spawnParticles(state.player.x, state.player.y, 16, '#fbbf24', 2.5, 30);
}

function recomputeStats() {
  if (!state || !state.player) return;
  const p = state.player;
  const oldMaxHp = p.maxHp || 1;
  const hpRatio = p.hp / oldMaxHp;

  // Reset to base
  p.atk = p.baseAtk;
  p.def = p.baseDef;
  p.maxHp = p.baseMaxHp + (state.player.level - 1) * 6; // level scaling preserved (no card-less hardcoded boost in gainXP)
  p.speed = p.baseSpeed;
  p.torchBonus = 0;
  p.critChance = 0.05; // base 5%
  p.dodgeChance = 0;
  p.lifestealPct = 0;
  p.accuracyBonus = 0;
  p.dmgReduction = 0;
  p.flags = {};

  // Apply card recompute hooks
  for (const c of (state.cards || [])) {
    const def = findCardDef(c.id);
    if (def && def.recompute) def.recompute(p, state, c.stacks);
  }

  // v3-02 — Apply affixes from currently-equipped tiered items
  const eqSlots = ['weapon','armor','offhand','accessory1','accessory2'];
  for (const slot of eqSlots) {
    const it = p.equipment[slot];
    if (!it || !it.affixes) continue;
    // broken weapon/armor: skip affix bonuses
    if (it.dur != null && it.dur <= 0) continue;
    for (const aff of it.affixes) {
      if (aff && typeof aff.apply === 'function') aff.apply(p, state, it);
    }
  }

  // Accessory maxHp bonus stacks on top
  p.maxHp += getAccessoryMaxHpBonus();

  // Preserve HP ratio
  p.hp = Math.max(1, Math.min(Math.round(p.maxHp * hpRatio), p.maxHp));
}

// ─── CARD MODAL UI ──────────────────────────────
function showCardDraft() {
  if (state.pendingLevelups <= 0) return;
  const choices = drawCardChoices(3);
  if (choices.length === 0) {
    // No cards: full heal as consolation
    state.player.hp = state.player.maxHp;
    addMessage('All cards mastered! Full heal.', 'level');
    state.pendingLevelups--;
    if (state.pendingLevelups > 0) showCardDraft();
    return;
  }
  state.pendingCardChoices = { choices, rerollUsed: false };
  state.choosingCard = true;
  renderCardModal();
  const modal = document.getElementById('card-modal');
  if (modal) modal.classList.remove('hidden');
}

function renderCardModal() {
  const row = document.getElementById('card-row');
  const counter = document.getElementById('card-counter');
  const rerollBtn = document.getElementById('card-reroll');
  if (!row || !state.pendingCardChoices) return;
  const { choices } = state.pendingCardChoices;
  // count remaining levelups for counter
  const total = state.pendingLevelups;
  if (counter) counter.textContent = total > 1 ? `Choice (${total} levelups queued)` : 'Choose 1 of 3';

  let html = '';
  choices.forEach((card, idx) => {
    const stack = playerCardStack(card.id);
    const stackStr = (card.maxStacks || 1) > 1
      ? (stack === 0 ? 'NEW · I' : `${toRoman(stack)} → ${toRoman(stack+1)}`)
      : 'NEW';
    const desc = card.descriptionFn ? card.descriptionFn(stack + 1) : card.description;
    html += `<div class="card-choice tier-${card.tier}" data-idx="${idx}">
      <div class="card-tier-label">${card.tier}</div>
      <div class="card-emoji">${card.emoji}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-stack-rank">${stackStr}</div>
      <div class="card-desc">${desc}</div>
      <div class="card-key-hint">[${idx + 1}]</div>
    </div>`;
  });
  row.innerHTML = html;

  // Update reroll button label / state
  if (rerollBtn) {
    rerollBtn.textContent = `🎲 Reroll (${state.cardRerolls})`;
    rerollBtn.disabled = state.cardRerolls <= 0 || state.pendingCardChoices.rerollUsed;
  }

  // Attach card click handlers
  row.querySelectorAll('.card-choice').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      pickCard(idx);
    });
  });
}

function toRoman(n) {
  const map = ['','I','II','III','IV','V','VI','VII','VIII','IX','X'];
  return map[n] || String(n);
}

function pickCard(idx) {
  if (!state.pendingCardChoices) return;
  const card = state.pendingCardChoices.choices[idx];
  if (!card) return;
  // Animation
  const el = document.querySelector(`#card-row .card-choice[data-idx="${idx}"]`);
  if (el) el.classList.add('picked');
  setTimeout(() => {
    applyCard(card);
    state.pendingCardChoices = null;
    state.pendingLevelups--;
    state.choosingCard = false;
    closeCardModal();
    if (state.pendingLevelups > 0) showCardDraft();
  }, 200);
}

function rerollCards() {
  if (!state.pendingCardChoices || state.pendingCardChoices.rerollUsed) return;
  if (state.cardRerolls <= 0) return;
  state.cardRerolls--;
  state.pendingCardChoices.rerollUsed = true;
  state.pendingCardChoices.choices = drawCardChoices(3);
  renderCardModal();
}

function skipCard() {
  if (!state.pendingCardChoices) return;
  const heal = Math.floor(state.player.maxHp * 0.10);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  addMessage(`Skipped — restored ${heal} HP.`, 'info');
  state.pendingCardChoices = null;
  state.pendingLevelups--;
  state.choosingCard = false;
  closeCardModal();
  if (state.pendingLevelups > 0) showCardDraft();
}

function closeCardModal() {
  const modal = document.getElementById('card-modal');
  if (modal) modal.classList.add('hidden');
}

function queueLevelupChoice() {
  state.pendingLevelups = (state.pendingLevelups || 0) + 1;
  if (gamePhase === 'playing' && !state.choosingCard) showCardDraft();
}

// ─── ACTIVE SKILLS ─────────────────────────────
function useActiveSkill(slot) {
  if (gamePhase !== 'playing') return;
  if (state.choosingCard) return;
  const skill = state.activeSkills.find(s => s.slot === slot);
  if (!skill) return;
  if (skill.cdRemaining > 0) {
    addMessage(`Skill on cooldown (${skill.cdRemaining}).`, 'info');
    return;
  }
  const card = findCardDef(skill.id);
  if (!card) return;
  const ok = executeActiveSkill(skill.id);
  if (!ok) return;
  let cd = (card.active && card.active.cooldown) ? card.active.cooldown : 10;
  if (state.player.flags && state.player.flags.stardust) cd = Math.max(1, Math.floor(cd * 0.5));
  skill.cdRemaining = cd;
  state.player.energy -= ACTION_COST.WAIT;
  processWorld();
}

function executeActiveSkill(id) {
  const p = state.player;
  if (id === 'whirlwind') {
    let hit = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = p.x + dx, ty = p.y + dy;
        const e = state.enemies.find(en => en.x === tx && en.y === ty && en.hp > 0);
        if (e) {
          const dmg = Math.max(1, Math.floor(getPlayerAtk() * 1.5) - (e.def || 0));
          e.hp -= dmg;
          spawnFloatingText(e.x, e.y, `-${dmg}`, '#fbbf24');
          spawnParticles(e.x, e.y, 8, '#fbbf24', 2.5, 18);
          if (e.hp <= 0) { state.kills++; gainXP(e.xp); onEnemyKilled(e); }
          hit++;
        }
      }
    }
    addMessage(`Whirlwind hits ${hit}!`, 'combat');
    state.screenShake = 6;
    return true;
  }
  if (id === 'blink') {
    const candidates = [];
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const tx = p.x + dx, ty = p.y + dy;
        if (tx < 0 || tx >= CFG.MAP_W || ty < 0 || ty >= CFG.MAP_H) continue;
        const blinkT = state.map[ty][tx];
        if (blinkT === TILE.WALL || blinkT === TILE.DOOR_CLOSED) continue;
        if (!state.visible.has(key(tx, ty))) continue;
        if (state.enemies.find(e => e.x === tx && e.y === ty && e.hp > 0)) continue;
        const d = dist(p.x, p.y, tx, ty);
        if (d > 5 || d < 1) continue;
        candidates.push({ x: tx, y: ty });
      }
    }
    if (candidates.length === 0) {
      addMessage('Nowhere to blink!', 'info');
      return false;
    }
    const t = candidates[rand(0, candidates.length - 1)];
    const ox = p.x, oy = p.y;
    p.x = t.x; p.y = t.y;
    spawnParticles(ox, oy, 14, '#38bdf8', 3, 22);
    spawnParticles(p.x, p.y, 14, '#38bdf8', 3, 22);
    addMessage('Blink!', 'info');
    return true;
  }
  if (id === 'shield_bash') {
    let nearest = null, nd = 999;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = chebyshev(e, p);
      if (d <= 1 && d < nd) { nd = d; nearest = e; }
    }
    if (!nearest) { addMessage('No adjacent target.', 'info'); return false; }
    const dmg = Math.max(1, Math.floor(getPlayerAtk() * 0.5) - (nearest.def || 0));
    nearest.hp -= dmg;
    addStatusEffect(nearest, STATUS.FREEZE, 2, 0);
    spawnFloatingText(nearest.x, nearest.y, 'STUN', '#60a5fa');
    if (nearest.hp <= 0) { state.kills++; gainXP(nearest.xp); onEnemyKilled(nearest); }
    return true;
  }
  if (id === 'firebolt') {
    let target = null, nd = 999;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (!state.visible.has(key(e.x, e.y))) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < nd) { nd = d; target = e; }
    }
    if (!target) { addMessage('No visible target.', 'info'); return false; }
    const dmg = 3 + getPlayerAtk();
    target.hp -= dmg;
    addStatusEffect(target, STATUS.BLEED, 3, 2); // burn proxy
    spawnFloatingText(target.x, target.y, `-${dmg}🔥`, '#f97316');
    spawnParticles(target.x, target.y, 18, '#f97316', 3, 28);
    if (target.hp <= 0) { state.kills++; gainXP(target.xp); onEnemyKilled(target); }
    return true;
  }
  if (id === 'frost_nova') {
    let hit = 0;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (dist(p.x, p.y, e.x, e.y) <= 3) {
        addStatusEffect(e, STATUS.FREEZE, 5, 0);
        spawnFloatingText(e.x, e.y, 'FREEZE', '#38bdf8');
        hit++;
      }
    }
    spawnParticles(p.x, p.y, 30, '#38bdf8', 3.5, 30);
    addMessage(`Frost Nova froze ${hit}!`, 'info');
    return true;
  }
  if (id === 'death_touch') {
    let target = null, nd = 999;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < nd && d <= 6) { nd = d; target = e; }
    }
    if (!target) { addMessage('No target.', 'info'); return false; }
    const threshold = state.player.flags.hellfire ? 0.50 : 0.30;
    if (target.hp / target.maxHp < threshold) {
      target.hp = 0;
      addMessage(`${target.name} crumbles to dust!`, 'combat');
      spawnParticles(target.x, target.y, 24, '#a855f7', 3, 30);
      state.kills++; gainXP(target.xp); onEnemyKilled(target);
    } else {
      const dmg = getPlayerAtk() * 3;
      target.hp -= dmg;
      spawnFloatingText(target.x, target.y, `-${dmg}💀`, '#a855f7');
      if (target.hp <= 0) { state.kills++; gainXP(target.xp); onEnemyKilled(target); }
    }
    return true;
  }
  return false;
}

function tickActiveCooldowns() {
  for (const s of state.activeSkills || []) {
    if (s.cdRemaining > 0) s.cdRemaining--;
  }
}

// ─── PER-TURN CARD HOOKS ────────────────────────
function processCardTicks() {
  const p = state.player;
  if (!p.flags) return;

  // Fire Aura (and Hellfire upgrade)
  if (p.flags.fireAura) {
    const r = p.flags.hellfire ? 2 : 1;
    const dmg = p.flags.hellfire ? 3 : 1;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (dist(p.x, p.y, e.x, e.y) <= r) {
        e.hp -= dmg;
        spawnFloatingText(e.x, e.y, `-${dmg}`, '#f97316');
        if (e.hp <= 0) { state.kills++; gainXP(e.xp); onEnemyKilled(e); }
      }
    }
  }

  // Ice Aura
  if (p.flags.iceAura) {
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (chebyshev(p, e) <= 1) {
        addStatusEffect(e, STATUS.SLOW, 1, 0);
      }
    }
  }

  // Regeneration: every 5 ticks +1 HP
  if (p.flags.regeneration && state.worldTick % 5 === 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + 1);
    spawnFloatingText(p.x, p.y, '+1', '#4ade80');
  }
  // v3-02 — Affix-driven regen (Regenerating prefix / Obsidian Heart / Aegis): +N HP / 3 ticks
  if (p.flags.affixRegen && state.worldTick % 3 === 0 && p.hp < p.maxHp) {
    const heal = p.flags.affixRegen | 0;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    spawnFloatingText(p.x, p.y, `+${heal}`, '#84cc16');
  }

  // Tornadoes (tempest): tick TTL & damage enemies on tile
  if (state.tornadoes && state.tornadoes.length > 0) {
    for (const t of state.tornadoes) {
      t.ttl--;
      const e = state.enemies.find(en => en.x === t.x && en.y === t.y && en.hp > 0);
      if (e) {
        e.hp -= 1;
        spawnFloatingText(e.x, e.y, '-1🌪️', '#94a3b8');
        if (e.hp <= 0) { state.kills++; gainXP(e.xp); onEnemyKilled(e); }
      }
    }
    state.tornadoes = state.tornadoes.filter(t => t.ttl > 0);
  }

  // Ally tick (necromancer): decrement ttl
  if (state.allies && state.allies.length > 0) {
    for (const a of state.allies) {
      a.alliedTicksLeft--;
      if (a.alliedTicksLeft <= 0) a.hp = 0;
    }
    state.allies = state.allies.filter(a => a.alliedTicksLeft > 0 && a.hp > 0);
  }

  // Reset attackedThisTurn (tactical perk)
  if (p.attackedThisTurn) p.attackedThisTurn.clear();

  // Sprinter — count combat-free turns
  if (p.flags.sprinter) p.sprinterTicks = (p.sprinterTicks || 0) + 1;
}

// On enemy killed hook (called from various damage-dealers)
function onEnemyKilled(e) {
  // Necromancer F14: child enemies don't trigger ally summon
  if (state.player.flags && state.player.flags.necromancer && !e.isChild && !e.child) {
    if (state.allies.length === 0 && Math.random() < 0.30) {
      e.allied = true;
      e.alliedTicksLeft = 10;
      e.hp = Math.max(1, Math.floor((e.maxHp || 8) * 0.5));
      state.allies.push(e);
      addMessage(`${e.name} rises as your ally!`, 'info');
      spawnParticles(e.x, e.y, 18, '#a855f7', 2.5, 28);
    }
  }
  // Dagger Dance: next attack guaranteed crit
  if (state.player.flags && state.player.flags.daggerDance) {
    state.player.flags.daggerDanceCharged = true;
  }
  // v3-06 — class passive on-kill hook (Berserker Bloodthirst).
  if (typeof processPassive === 'function' && !e.isChild && !e.child && !e.allied) {
    processPassive('kill', { enemy: e });
  }
  // P2.2 — Soul Reaver: refund 25% enemy maxHp on kill
  if (state.player.flags && state.player.flags.soulReaver) {
    const heal = Math.max(1, Math.floor((e.maxHp || 0) * 0.25));
    const before = state.player.hp;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    const gained = state.player.hp - before;
    if (gained > 0) spawnFloatingText(state.player.x, state.player.y, `+${gained}`, '#a855f7');
  }
  // v3-04 / v3-05: objective + boss-kill hook
  if (typeof objectivesOnEnemyKilled === 'function') objectivesOnEnemyKilled(e);

  // v4-01 — Crystal drop economy
  if (!e.isChild && !e.child && !e.allied && Math.random() < (CFG.CRYSTAL_DROP_CHANCE || 0.85)) {
    const baseCrystals = rand(1, 3) + Math.floor((state.floor || 1) / 2);
    const bossBonus = e.isBoss ? (60 + 8 * (state.floor || 1)) : 0;
    const total = baseCrystals + bossBonus;
    state.crystals = (state.crystals || 0) + total;
    spawnFloatingText(e.x, e.y, `+${total}💎`, '#67e8f9');
  }
}
