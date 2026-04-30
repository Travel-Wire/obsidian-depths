// ═══════════════════════════════════════════════
// 06-state.js — Platform detect, utils, game state, item & equipment helpers
// ═══════════════════════════════════════════════

// ─── PLATFORM DETECT ────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 900);

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
    // tileLightLevel — Float32Array(W*H), recomputed each turn from FOV layers (BRIGHT/DIM/EDGE).
    // Source-of-truth for renderer; state.visible kept as a Set for AI/LOS compat.
    tileLightLevel: null,
    exploredCorridors: null, // Uint8Array(W*H), persistent per floor
    exploredRooms: new Set(),
    // Perf P2.4: roomGrid[y*MAP_W+x] = (roomIndex+1) so 0 = "no room". O(1) lookup.
    roomGrid: null,
    // Perf P1.3: render-on-dirty.
    dirty: true,
    // Minimap dual-mode (v3-03): compact + tap-expand modal.
    minimapDirty: true,
    minimapExpanded: false,
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

function addMessage(text, type = 'info') {
  state.messages.unshift({ text, type, age: 0 });
  if (state.messages.length > CFG.MSG_MAX) state.messages.pop();
  // Render-on-dirty: any new message should refresh UI (cheap path because most
  // hot UI work is sig-cached anyway).
  state.dirty = true;
}
