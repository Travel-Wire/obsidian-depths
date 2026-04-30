// ═══════════════════════════════════════════════
// 06-state.js — Platform detect, utils, game state, item & equipment helpers
// ═══════════════════════════════════════════════

// ─── PLATFORM DETECT ────────────────────────────
// Robust mobile detection — handles obfuscated UAs, tunneled origins, and tablets.
// True if ANY of: legacy mobile UA, Mobi token, iPadOS-as-Mac, touch-capable device with <1100px viewport, or coarse pointer.
const isMobile = (function() {
  try {
    const ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    // iPadOS 13+ identifies as Mac with touch
    if (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) return true;
    const touchable = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    if (touchable && window.innerWidth < 1100) return true;
    // CSS-level coarse pointer (final fallback)
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (e) { /* fall through */ }
  return false;
})();

// ─── UTILS ──────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }
function key(x, y) { return `${x},${y}`; }

function tileHash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1013904223) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  return ((h >> 16) ^ h) & 0x7fffffff;
}

function colorVariant(base, x, y, seed, range) {
  const h = tileHash(x, y, seed);
  const v = (h % (range * 2 + 1)) - range;
  return [clamp(base[0] + v, 0, 255), clamp(base[1] + v, 0, 255), clamp(base[2] + v, 0, 255)];
}

// ─── GAME STATE ─────────────────────────────────
let state = null;
let gamePhase = 'title'; // title, character_select, playing, dead, won
let selectedCharacterKey = 'knight'; // chosen on character select screen

function newState() {
  return {
    map: [],
    explored: [],
    visible: new Set(),
    rooms: [],
    player: {
      x: 0, y: 0, hp: 25, maxHp: 25, atk: 4, def: 1, level: 1, xp: 0, xpNext: 15,
      baseAtk: 4, baseDef: 1, baseMaxHp: 25, baseSpeed: SPEED.NORMAL,
      energy: 0, speed: SPEED.NORMAL, movementPattern: MOVE_PATTERN.ORTHOGONAL,
      statusEffects: [], torchBonus: 0, poisoned: 0,
      tempHp: 0, // v4-05 — Aegis card temp HP shield (absorbs damage before HP)
      // PLAN 05 — card-applied stats
      critChance: 0, dodgeChance: 0, lifestealPct: 0, accuracyBonus: 0, dmgReduction: 0,
      flags: {}, // arbitrary perk flags (fireAura, iceAura, regen, sprinter, dualWield, tactical, etc.)
      attackedThisTurn: new Set(), // for tactical perk
      sprinterTicks: 0,            // tracks turns without combat
      lastStepX: 0, lastStepY: 0,  // for tempest tornado spawn
      equipment: { weapon: null, armor: null, offhand: null, accessory1: null, accessory2: null },
      // v3-06 — character class & passive bookkeeping
      classKey: 'knight',
      passiveCooldowns: {},  // { resolve: turnsLeft }
      passiveActive: {},     // { resolve: turnsLeft }
      killChainCount: 0,     // Berserker Bloodthirst chain
      turnsSinceLastKill: 0, // Bloodthirst chain reset
    },
    cards: [],            // [{ id, stacks }]
    activeSkills: [],     // [{ id, cdRemaining, slot }] — slot 0 = Q, 1 = E
    pendingCardChoices: null, // { choices: [cardDef, ...], remaining: N }
    pendingLevelups: 0,
    choosingCard: false,
    pityCounter: 0,
    cardRerolls: 0,
    allies: [],           // necromancer summons (ttl-based)
    tornadoes: [],        // tempest tiles { x, y, ttl }
    enemies: [],
    items: [],       // items on ground
    inventory: [],    // player inventory
    groundItems: [],  // items on the floor of current level
    traps: [],
    litRooms: new Set(),
    anvils: [],
    webTiles: [],
    worldTick: 0,
    floor: 1,
    turns: 0,
    kills: 0,
    gold: 0,
    // v4-01 — Drop economy
    crystals: 0,           // currency for shops/services
    crystalPiles: [],      // ground piles { x, y, amount }
    shops: [],             // [{ x, y, used: bool, stock: [items], buybackStack: [items] }]
    lastAnvilFloor: -10,   // floor index when last anvil spawned (cooldown)
    nextItemId: 0,
    nextEnemyId: 0,
    stairsPos: { x: 0, y: 0 },
    torches: [],
    messages: [],
    animations: [],
    particles: [],
    floatingTexts: [],
    camera: { x: 0, y: 0 },
    screenShake: 0,
    seed: Math.floor(Math.random() * 999999),

    // ─── v3-01 visibility / v3-03 minimap / perf flags ───
    tileLightLevel: null,
    exploredCorridors: null,
    exploredRooms: new Set(),
    // Perf P2.4: roomGrid[y*MAP_W+x] = (roomIndex+1) so 0 = "no room". O(1) lookup.
    roomGrid: null,
    // v4-03 — wider corridors: synced doors. Map<groupId, Array<{x,y}>>; rebuilt per floor.
    doorGroups: new Map(),
    // Perf P1.3: render-on-dirty.
    dirty: true,
    // Minimap dual-mode (v3-03).
    minimapDirty: true,
    minimapExpanded: false,

    // ─── v3-04 / v3-05 — objectives + bosses ───
    currentObjective: { id: null, progress: 0, target: 1, complete: false, bossKey: null },
    objectiveCompleted: false,
    bonusNoDamageActive: true,
    objectiveChests: [],
    hasObjectiveKey: false,
    bossDefeated: [],
    bossArenaLocked: false,
    currentBossId: null,
    floorEnteredHp: 0,
    floorEnteredTurn: 0,
    curseActive: false,

    // ─── v4-02 — Fusion ───
    fusionPending: null,        // { primaryIdx, secondaryIdx, outcomes:[3], highlightId, anvilXY }
    // ─── v4-06 — UI redesign (MVP) ───
    uiDrawerOpen: null,         // null | 'inventory'
    seenTutorial: false,        // mirror of localStorage.seenTutorial
    onboardingStep: 0,          // 0..3 active step index when overlay visible
  };
}

// ─── ITEM HELPERS ──────────────────────────────
function findItemDef(id) {
  return ITEM_DEFS.find(d => d.id === id);
}

function makeItemInstance(def, extra) {
  const inst = { ...def };
  if (def.maxDur != null) {
    inst.dur = def.maxDur;
    inst.maxDur = def.maxDur;
  }
  inst.instanceId = ++state.nextItemId;
  // v4-02 — every equippable instance starts at upgradeLevel 0.
  if (def.slot) inst.upgradeLevel = 0;
  if (extra) Object.assign(inst, extra);
  return inst;
}

// v3-02 — Build a tiered instance from a base def; applies stat ×mult + affixes.
// For consumables (slot==null), tier is ignored — they stay flat.
function makeTieredItem(def, tier, extra) {
  const inst = makeItemInstance(def, extra);
  // Consumables / non-equippables — return as-is, untiered.
  if (!def.slot) return inst;
  // Tier defaults to base if not provided
  if (typeof tier !== 'number') tier = (def.tierBase != null ? def.tierBase : TIER.COMMON);
  inst.tier = tier;
  inst.tierName = TIER_NAMES[tier];
  inst.tierColor = TIER_BORDER[tier];
  // Stat multiplier vs bazowy tier (so a Common rolled at Rare = ×1.5/×1.0)
  const baseTier = (def.tierBase != null ? def.tierBase : TIER.COMMON);
  const mult = TIER_STATS[tier] / TIER_STATS[baseTier];
  for (const stat of ['atk','def','maxDur','maxHp']) {
    if (inst[stat] != null) inst[stat] = Math.max(1, Math.round(inst[stat] * mult));
  }
  if (inst.maxDur != null) inst.dur = inst.maxDur;
  if (inst.critChance != null) inst.critChance = Math.min(0.95, inst.critChance * mult);
  // Roll affixes
  const affixCount = TIER_AFFIX_COUNT[tier];
  inst.affixes = sampleAffixes(affixCount, tier, def.slot);
  // Display name with first affix as prefix
  if (inst.affixes.length > 0) {
    inst.name = `${inst.affixes[0].displayPrefix} ${def.name}`;
  }
  return inst;
}

// Build a Legendary unique instance (already-defined affixes + unique mechanic)
function makeLegendaryItem(legDef, extra) {
  const inst = makeItemInstance(legDef, extra);
  inst.tier = TIER.LEGENDARY;
  inst.tierName = TIER_NAMES[TIER.LEGENDARY];
  inst.tierColor = TIER_BORDER[TIER.LEGENDARY];
  inst.affixes = (legDef.affixes || []).map(id => findAffix(id)).filter(Boolean);
  inst.unique = legDef.unique || null;
  inst.legendaryId = legDef.id;
  return inst;
}

// Pick a Legendary unique eligible for floor; returns null if none available
function pickLegendaryDef(floor) {
  const pool = LEGENDARY_DEFS.filter(d => (d.minFloor || 1) <= floor);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickWeightedItem(floor, predicate) {
  const eligible = ITEM_DEFS.filter(d => (d.minFloor || 1) <= floor && (!predicate || predicate(d)));
  if (eligible.length === 0) return null;
  const totalW = eligible.reduce((s, d) => s + (d.weight || 1), 0);
  let r = Math.random() * totalW;
  for (const d of eligible) {
    r -= (d.weight || 1);
    if (r <= 0) return d;
  }
  return eligible[eligible.length - 1];
}

function getEquippedWeapon() { return state.player.equipment.weapon; }
function getEquippedArmor()  { return state.player.equipment.armor; }
function getEquippedOffhand(){ return state.player.equipment.offhand; }

function getAccessoryAtk() {
  let a = 0;
  for (const k of ['accessory1','accessory2']) {
    const it = state.player.equipment[k];
    if (it) a += it.atk || 0;
  }
  return a;
}

function getAccessoryDef() {
  let d = 0;
  for (const k of ['accessory1','accessory2']) {
    const it = state.player.equipment[k];
    if (it) d += it.def || 0;
  }
  return d;
}

function getAccessoryMaxHpBonus() {
  let h = 0;
  for (const k of ['accessory1','accessory2']) {
    const it = state.player.equipment[k];
    if (it) h += it.maxHp || 0;
  }
  return h;
}

function getStatusAtkBonus() {
  return 0; // hook for future buffs
}

function getStatusDefBonus() {
  return 0; // hook for future buffs
}

function getPlayerAtk() {
  let a = state.player.atk; // base
  const w = getEquippedWeapon();
  if (w && (w.dur === undefined || w.dur > 0)) a += w.atk || 0;
  a += getAccessoryAtk();
  a += getStatusAtkBonus();
  // PLAN 05: a += getCardBonus('atk');
  return a;
}

function getPlayerDef() {
  let d = state.player.def; // base
  const a = getEquippedArmor();
  if (a && (a.dur === undefined || a.dur > 0)) d += a.def || 0;
  const o = getEquippedOffhand();
  if (o && (o.dur === undefined || o.dur > 0)) d += o.def || 0;
  d += getAccessoryDef();
  d += getStatusDefBonus();
  // PLAN 05: d += getCardBonus('def');
  // v3-06 — Knight Resolve passive: +50% DEF while active
  if (typeof getResolveDefMultiplier === 'function') {
    const m = getResolveDefMultiplier();
    if (m !== 1) d = Math.floor(d * m);
  }
  return d;
}

function getPlayerCritChance() {
  let c = 0.05;
  const w = getEquippedWeapon();
  if (w && w.critChance) c = w.critChance;
  for (const k of ['accessory1','accessory2']) {
    const it = state.player.equipment[k];
    if (it && it.critBonus) c += it.critBonus;
  }
  return c;
}

function damageWeaponDur(w, isCrit) {
  if (!w || w.dur == null || w.dur <= 0) return;
  const wear = w.twoHanded ? 2 : 1;
  w.dur = Math.max(0, w.dur - (isCrit ? wear * 3 : wear));
  if (w.dur === 0) {
    addMessage(`Your ${w.name} breaks!`, 'combat');
    spawnFloatingText(state.player.x, state.player.y, '💔', '#ef4444');
  } else if (w.dur <= w.maxDur * 0.2 && state.turns % 5 === 0) {
    addMessage(`${w.emoji} is nearly broken!`, 'info');
  }
}

function damageArmorDur(a, incoming) {
  if (!a || a.dur == null || a.dur <= 0) return;
  const wear = Math.max(1, Math.ceil(incoming / 3));
  a.dur = Math.max(0, a.dur - wear);
  if (a.dur === 0) {
    addMessage(`Your ${a.name} crumbles!`, 'combat');
  }
}

function equipItem(invSlot) {
  const item = state.inventory[invSlot];
  if (!item) return;
  const slot = item.slot;
  if (!slot || slot === null) return;

  let targetSlot = slot;
  if (slot === 'accessory') {
    if (!state.player.equipment.accessory1) targetSlot = 'accessory1';
    else if (!state.player.equipment.accessory2) targetSlot = 'accessory2';
    else targetSlot = 'accessory1'; // swap with first
  }

  // Handle two-handed weapons — clear offhand
  if (slot === 'weapon' && item.twoHanded) {
    const oh = state.player.equipment.offhand;
    if (oh) {
      // Need a free slot for offhand
      if (state.inventory.length >= CFG.INV_SIZE) {
        addMessage('Free a slot first (two-handed needs offhand cleared).', 'info');
        return;
      }
      state.inventory.push(oh);
      state.player.equipment.offhand = null;
    }
  }
  // Handle offhand when wielding two-handed
  if (slot === 'offhand') {
    const w = state.player.equipment.weapon;
    if (w && w.twoHanded) {
      addMessage(`Cannot equip ${item.name} — two-handed weapon in use.`, 'info');
      return;
    }
  }

  const old = state.player.equipment[targetSlot];
  state.player.equipment[targetSlot] = item;
  state.inventory[invSlot] = old || null;
  if (!old) state.inventory.splice(invSlot, 1);
  addMessage(`Equipped ${item.emoji} ${item.name}.`, 'pickup');
  recomputePlayerMaxHp();
}

function unequipItem(slotName) {
  const item = state.player.equipment[slotName];
  if (!item) return;
  if (state.inventory.length >= CFG.INV_SIZE) {
    addMessage('Inventory full!', 'info');
    return;
  }
  state.inventory.push(item);
  state.player.equipment[slotName] = null;
  addMessage(`Unequipped ${item.name}.`, 'info');
  recomputePlayerMaxHp();
}

function recomputePlayerMaxHp() {
  // PLAN 05: delegate to full recompute (cards + accessories + level scaling).
  recomputeStats();
}

function repairAt(x, y) {
  const a = state.anvils.find(an => an.x === x && an.y === y && !an.used);
  if (!a) return;
  let any = false;
  for (const k of ['weapon','armor','offhand']) {
    const it = state.player.equipment[k];
    if (it && it.maxDur && it.dur < it.maxDur) {
      it.dur = it.maxDur;
      any = true;
    }
  }
  if (!any) {
    addMessage('Nothing to repair.', 'info');
    return;
  }
  a.used = true;
  state.map[y][x] = TILE.FLOOR;
  addMessage('The anvil restores your gear!', 'pickup');
  spawnParticles(x, y, 30, '#fbbf24', 3, 40);
}

function equipStartingGear() {
  const dagger = findItemDef('rusty_dagger');
  const robes = findItemDef('tattered_robes');
  if (dagger) state.player.equipment.weapon = makeItemInstance(dagger);
  if (robes)  state.player.equipment.armor  = makeItemInstance(robes);
}

// ─── v4-02 FUSION HELPERS ───────────────────────
// Returns { ok, reason } — checks if 2 inventory items can be fused.
function canFuse(a, b) {
  if (!a || !b) return { ok: false, reason: 'Missing item.' };
  if (a === b) return { ok: false, reason: 'Pick two different items.' };
  if (!a.slot || !b.slot) return { ok: false, reason: 'Only equipment can be fused.' };
  if (a.id !== b.id) return { ok: false, reason: 'Items must be the same type.' };
  if ((a.upgradeLevel || 0) !== (b.upgradeLevel || 0)) {
    return { ok: false, reason: 'Both items must have the same upgrade level.' };
  }
  if ((a.upgradeLevel || 0) >= 5) return { ok: false, reason: 'Already maxed (+5).' };
  if (typeof TIER !== 'undefined' && a.tier === TIER.LEGENDARY) {
    return { ok: false, reason: 'Legendary items cannot be fused.' };
  }
  if (a.dur === 0) return { ok: false, reason: 'Repair primary before fusion.' };
  return { ok: true };
}

// Find pair candidates in inventory: returns array of [idxA, idxB] for
// every fusible pair (same id, same upgradeLevel, neither broken-as-primary).
function findFusionPairs() {
  const pairs = [];
  const inv = state.inventory;
  for (let i = 0; i < inv.length; i++) {
    for (let j = i + 1; j < inv.length; j++) {
      const r = canFuse(inv[i], inv[j]);
      if (r.ok) pairs.push([i, j]);
    }
  }
  return pairs;
}

// Open the fusion preview — rolls outcomes and stashes in state.fusionPending.
// Caller (UI) should re-render modal afterwards.
function prepareFusion(primaryIdx, secondaryIdx) {
  const inv = state.inventory;
  const a = inv[primaryIdx], b = inv[secondaryIdx];
  const r = canFuse(a, b);
  if (!r.ok) {
    addMessage(r.reason, 'info');
    return null;
  }
  const outcomes = previewFusionOutcomes();
  const highlight = outcomes.find(o => o.highlighted);
  state.fusionPending = {
    primaryIdx, secondaryIdx,
    outcomes,
    highlightId: highlight ? highlight.id : null,
  };
  return state.fusionPending;
}

function cancelFusion() {
  state.fusionPending = null;
}

// Confirm and apply the prepared fusion. Consumes 1 anvil use.
function confirmFusion(anvilX, anvilY) {
  const fp = state.fusionPending;
  if (!fp) return;
  const inv = state.inventory;
  const primary = inv[fp.primaryIdx];
  const secondary = inv[fp.secondaryIdx];
  if (!primary || !secondary) {
    state.fusionPending = null;
    return;
  }
  const outcome = fp.outcomes.find(o => o.id === fp.highlightId) || fp.outcomes[0];
  const res = applyFusionOutcome(primary, outcome);

  // Remove secondary from inventory (and primary too if brick)
  // Splice higher index first so indices stay stable.
  const sortIdx = [fp.primaryIdx, fp.secondaryIdx].sort((x, y) => y - x);
  if (res.brick) {
    // Both destroyed
    for (const idx of sortIdx) inv.splice(idx, 1);
    addMessage('💔 The metal shatters! Both items destroyed.', 'combat');
    spawnParticles(state.player.x, state.player.y, 20, '#94a3b8', 2, 30);
    spawnFloatingText(state.player.x, state.player.y, '💔 SHATTERED', '#ef4444');
    state.screenShake = Math.max(state.screenShake || 0, 6);
  } else {
    // Remove only secondary
    inv.splice(fp.secondaryIdx, 1);
    addMessage(`Fusion success! ${primary.name} +${primary.upgradeLevel} (${outcome.label})`, 'pickup');
    spawnParticles(state.player.x, state.player.y, 30, '#fbbf24', 3, 40);
    spawnFloatingText(state.player.x, state.player.y, `+${primary.upgradeLevel}`, '#fbbf24');
  }

  // Consume anvil use (mark used like repair).
  if (typeof anvilX === 'number' && typeof anvilY === 'number') {
    const anv = state.anvils.find(an => an.x === anvilX && an.y === anvilY && !an.used);
    if (anv) {
      anv.used = true;
      state.map[anvilY][anvilX] = TILE.FLOOR;
    }
  }

  state.fusionPending = null;
  if (typeof recomputeStats === 'function') recomputeStats();
  state.dirty = true;
}

function addMessage(text, type = 'info') {
  state.messages.unshift({ text, type, age: 0 });
  if (state.messages.length > CFG.MSG_MAX) state.messages.pop();
  // Render-on-dirty: any new message should refresh UI (cheap path because most
  // hot UI work is sig-cached anyway).
  state.dirty = true;
}
