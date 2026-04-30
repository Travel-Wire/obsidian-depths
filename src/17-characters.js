// ═══════════════════════════════════════════════
// 17-characters.js — Character classes (v3-06)
// MVP CUTS: Knight / Mage / Berserker fully implemented;
//           Rogue / Ranger / Cleric placeholders (TODO).
// ═══════════════════════════════════════════════

// ─── CHARACTER DEFINITIONS ─────────────────────
// Stats override base; equipment is array of ITEM_DEFS ids per slot.
// startingCards = array of card ids granted on run start (each = 1 stack).
// Passive logic lives in PASSIVE_HANDLERS (below).
const CHARACTER_DEFS = [
  // ─── KNIGHT (Easy / Tank) — full impl ───────
  {
    key: 'knight',
    name: 'Knight',
    fullName: 'Sir Aldric Thornveil',
    emoji: '⚔️',
    portraitEmoji: '⚔️',
    difficulty: 1,
    playstyleTag: 'TANK',
    lore: 'Disgraced paladin of the Shattered Cross, descending in search of redemption.',
    stats: { hp: 30, atk: 4, def: 2, speed: SPEED.NORMAL },
    equipment: { weapon: 'kitchen_knife', armor: 'leather_vest', offhand: null, accessory1: null, accessory2: null },
    extraInventory: [],
    startingCards: ['resilience'],
    passive: { id: 'resolve', name: 'Resolve', desc: 'HP<25% → +50% DEF for 5t (CD 30)' },
    openingLine: 'The depths beckon, and Aldric Thornveil descends to find his redemption — or his end.',
    implemented: true,
  },

  // ─── MAGE (Medium-Hard / Spell) — full impl ─
  {
    key: 'mage',
    name: 'Mage',
    fullName: 'Lyra Vex',
    emoji: '🧙',
    portraitEmoji: '🧙',
    difficulty: 3,
    playstyleTag: 'SPELL',
    lore: "Last apprentice of Archmage Korvin the Vanished. Carries his journal and a half-learned fireball.",
    stats: { hp: 18, atk: 3, def: 1, speed: SPEED.NORMAL },
    equipment: { weapon: 'apprentice_wand', armor: 'tattered_robes', offhand: null, accessory1: null, accessory2: null },
    extraInventory: ['fire_scroll', 'fire_scroll'],
    startingCards: ['firebolt'],
    passive: { id: 'arcane_affinity', name: 'Arcane Affinity', desc: 'Scrolls deal +50% damage' },
    openingLine: "Lyra Vex grips her master's journal. The fireball spell trembles on her lips.",
    implemented: true,
  },

  // ─── ROGUE (Medium / Speed) — PLACEHOLDER ───
  // TODO v3-06 phase 2: Evasion passive (25% melee dodge), Lockpick accessory, Cat Reflexes start card,
  //                     Speed FAST, autoLockpick flag for chests.
  {
    key: 'rogue',
    name: 'Rogue',
    fullName: 'Kaelen Hush',
    emoji: '🗡️',
    portraitEmoji: '🗡️',
    difficulty: 2,
    playstyleTag: 'SPEED',
    lore: 'Ex-thief of the Whisperguild, hunting the legendary Obsidian Heart.',
    stats: { hp: 22, atk: 5, def: 1, speed: SPEED.NORMAL }, // TODO: SPEED.FAST
    equipment: { weapon: 'kitchen_knife', armor: 'tattered_robes', offhand: null, accessory1: null, accessory2: null },
    extraInventory: [],
    startingCards: [], // TODO: 'cat_reflexes'
    passive: { id: 'placeholder', name: 'Evasion (TODO)', desc: '25% chance dodge melee — not yet implemented' },
    openingLine: 'Kaelen Hush slips past the threshold. Whatever waits below has not seen her yet.',
    implemented: false,
  },

  // ─── RANGER (Medium / Range) — PLACEHOLDER ──
  // TODO v3-06 phase 2: Eagle Eye passive (+1 torch, arrow pierce), Short Bow + arrows starting,
  //                     Marksman starting card.
  {
    key: 'ranger',
    name: 'Ranger',
    fullName: 'Tomas Brindel',
    emoji: '🏹',
    portraitEmoji: '🏹',
    difficulty: 2,
    playstyleTag: 'RANGE',
    lore: 'Hunter of the Greenwood, three weeks deep on a shadow-beast blood-trail.',
    stats: { hp: 24, atk: 4, def: 1, speed: SPEED.NORMAL },
    equipment: { weapon: 'kitchen_knife', armor: 'tattered_robes', offhand: null, accessory1: null, accessory2: null }, // TODO: short_bow + arrows
    extraInventory: [],
    startingCards: [], // TODO: 'marksman' (requires bow)
    passive: { id: 'placeholder', name: 'Eagle Eye (TODO)', desc: '+1 torch, arrow pierce — not yet implemented' },
    openingLine: 'Tomas Brindel notches an arrow. The blood-trail leads down. So does he.',
    implemented: false,
  },

  // ─── CLERIC (Easy-Medium / Sustain) — PLACEHOLDER ───
  // TODO v3-06 phase 2: Divine Aura passive (+25% dmg vs undead, +1 HP/3t),
  //                     War Hammer + Holy Symbol, Regeneration starting card.
  {
    key: 'cleric',
    name: 'Cleric',
    fullName: 'Sister Vela',
    emoji: '🌟',
    portraitEmoji: '🌟',
    difficulty: 2,
    playstyleTag: 'HEAL',
    lore: 'Sworn of the Lantern Order, exorcist of the obsidian rot.',
    stats: { hp: 28, atk: 3, def: 2, speed: SPEED.NORMAL },
    equipment: { weapon: 'kitchen_knife', armor: 'leather_vest', offhand: null, accessory1: null, accessory2: null }, // TODO: war_hammer
    extraInventory: [],
    startingCards: [], // TODO: 'regeneration'
    passive: { id: 'placeholder', name: 'Divine Aura (TODO)', desc: '+25% vs undead, regen — not yet implemented' },
    openingLine: 'Sister Vela raises her holy symbol. The dark recoils — for now.',
    implemented: false,
  },

  // ─── BERSERKER (Hard / Glass cannon) — full impl ───
  {
    key: 'berserker',
    name: 'Berserker',
    fullName: 'Grimhart the Red',
    emoji: '🪓',
    portraitEmoji: '🪓',
    difficulty: 4,
    playstyleTag: 'RAGE',
    lore: 'Last of the Ironwolf Clan, hunting the biggest thing in the depths.',
    stats: { hp: 26, atk: 6, def: 0, speed: SPEED.NORMAL },
    equipment: { weapon: 'battle_axe', armor: null, offhand: null, accessory1: null, accessory2: null },
    extraInventory: [],
    startingCards: ['berserker'],
    passive: { id: 'bloodthirst', name: 'Bloodthirst', desc: 'On kill: +1 free attack, +2 HP, chain max 3' },
    openingLine: 'Grimhart laughs. The depths laugh back. One of them is wrong.',
    implemented: true,
  },
];

function findCharacterDef(key) {
  return CHARACTER_DEFS.find(c => c.key === key);
}

// ─── APPLY CHARACTER ──────────────────────────────
// Called after newState() and before enterFloor(). Overrides player stats + equipment + cards.
function applyCharacter(player, charKey) {
  const def = findCharacterDef(charKey || 'knight');
  if (!def) {
    if (typeof addMessage === 'function') addMessage('Unknown class — defaulting to Knight.', 'info');
    return applyCharacter(player, 'knight');
  }

  player.classKey = def.key;

  // Override base stats — recomputeStats() will use these as `base*`.
  player.hp = def.stats.hp;
  player.maxHp = def.stats.hp;
  player.baseMaxHp = def.stats.hp;
  player.atk = def.stats.atk;
  player.baseAtk = def.stats.atk;
  player.def = def.stats.def;
  player.baseDef = def.stats.def;
  player.speed = def.stats.speed;
  player.baseSpeed = def.stats.speed;

  // Reset passive bookkeeping
  player.passiveCooldowns = {};
  player.passiveActive = {};
  player.killChainCount = 0;
  player.turnsSinceLastKill = 0;

  // Equipment override (ITEM_DEFS lookup -> fresh instance per slot).
  for (const slot of ['weapon','armor','offhand','accessory1','accessory2']) {
    const itemId = def.equipment[slot];
    if (itemId) {
      const itemDef = (typeof findItemDef === 'function') ? findItemDef(itemId) : null;
      if (itemDef) {
        player.equipment[slot] = makeItemInstance(itemDef);
      } else {
        player.equipment[slot] = null;
      }
    } else {
      player.equipment[slot] = null;
    }
  }

  // Extra inventory items (e.g. Mage scrolls)
  if (def.extraInventory && def.extraInventory.length > 0 && typeof state !== 'undefined' && state) {
    for (const itemId of def.extraInventory) {
      const itemDef = findItemDef(itemId);
      if (itemDef && state.inventory.length < CFG.INV_SIZE) {
        state.inventory.push(makeItemInstance(itemDef));
      }
    }
  }

  // Starting cards (each = 1 stack).
  if (def.startingCards && def.startingCards.length > 0 && typeof state !== 'undefined' && state) {
    for (const cardId of def.startingCards) {
      const cardDef = (typeof findCardDef === 'function') ? findCardDef(cardId) : null;
      if (!cardDef) continue;
      // Weapon-synergy prereq check is bypassed for class starting cards (Berserker -> battle_axe granted).
      const existing = state.cards.find(c => c.id === cardId);
      if (existing) {
        existing.stacks = Math.min(cardDef.maxStacks || 1, existing.stacks + 1);
      } else {
        state.cards.push({ id: cardId, stacks: 1 });
      }
      // Active skill auto-bind (Mage Firebolt → Q-slot).
      if (cardDef.category === 'active') {
        const exists = state.activeSkills.find(a => a.id === cardId);
        if (!exists && state.activeSkills.length < 2) {
          state.activeSkills.push({ id: cardId, cdRemaining: 0, slot: state.activeSkills.length });
        }
      }
    }
  }

  // Passive onInit hook
  if (typeof PASSIVE_HANDLERS !== 'undefined' && PASSIVE_HANDLERS[def.passive.id] && PASSIVE_HANDLERS[def.passive.id].onInit) {
    PASSIVE_HANDLERS[def.passive.id].onInit({ player });
  }
}

// ─── PASSIVE HANDLERS ─────────────────────────
// Hook events: onInit, takeDamage, attackEnemy, kill, worldTick, useScroll
const PASSIVE_HANDLERS = {
  resolve: {
    takeDamage: (ctx) => {
      const p = state.player;
      if (p.hp <= 0) return;
      const cd = p.passiveCooldowns.resolve || 0;
      const active = p.passiveActive.resolve || 0;
      if (cd > 0 || active > 0) return;
      if (p.hp / Math.max(1, p.maxHp) < 0.25) {
        p.passiveActive.resolve = 5;
        p.passiveCooldowns.resolve = 30;
        if (typeof addMessage === 'function') addMessage('RESOLVE! +50% DEF for 5 turns.', 'level');
        if (typeof spawnFloatingText === 'function') spawnFloatingText(p.x, p.y, '🛡️', '#fbbf24');
      }
    },
    worldTick: () => {
      const p = state.player;
      if ((p.passiveActive.resolve || 0) > 0) p.passiveActive.resolve--;
      if ((p.passiveCooldowns.resolve || 0) > 0) p.passiveCooldowns.resolve--;
    },
  },

  arcane_affinity: {
    // Effect applied inline in scroll handler via getScrollMultiplier()
  },

  bloodthirst: {
    kill: () => {
      const p = state.player;
      p.killChainCount = Math.min(3, (p.killChainCount || 0) + 1);
      p.turnsSinceLastKill = 0;
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      // Free action: refund energy so the player can act again this turn.
      // ACTION_COST.MOVE / ATTACK = 100 → grant a free 100 energy.
      p.energy = (p.energy || 0) + (typeof ACTION_COST !== 'undefined' ? ACTION_COST.ATTACK : 100);
      if (typeof addMessage === 'function') addMessage(`Bloodthirst x${p.killChainCount}! +1 attack, +${p.hp - before} HP.`, 'level');
      if (typeof spawnFloatingText === 'function') spawnFloatingText(p.x, p.y, '🩸', '#dc2626');
    },
    worldTick: () => {
      const p = state.player;
      if ((p.killChainCount || 0) > 0) {
        p.turnsSinceLastKill = (p.turnsSinceLastKill || 0) + 1;
        if (p.turnsSinceLastKill > 5) p.killChainCount = 0;
      }
    },
  },

  // ─── Placeholders (TODO phase 2) ──────────
  placeholder: {
    // no-ops; class still playable but with no class-unique passive.
  },
};

// ─── PASSIVE DISPATCH ─────────────────────────
function processPassive(hook, ctx) {
  if (!state || !state.player || !state.player.classKey) return;
  const def = findCharacterDef(state.player.classKey);
  if (!def) return;
  const handler = PASSIVE_HANDLERS[def.passive.id];
  if (handler && typeof handler[hook] === 'function') {
    handler[hook](ctx || {});
  }
}

// ─── HELPERS USED BY OTHER FILES ──────────────
function getResolveDefMultiplier() {
  if (!state || !state.player) return 1;
  if ((state.player.passiveActive && state.player.passiveActive.resolve || 0) > 0) return 1.5;
  return 1;
}

function getScrollMultiplier() {
  if (!state || !state.player) return 1;
  if (state.player.classKey === 'mage') return 1.5;
  return 1;
}

// ─── META PERSISTENCE (per-class run stats) ──
// MVP CUT: only bestFloorReached tracked. Wins/runs counters out of scope.
const META_KEY = 'obsidian-depths-meta';

function loadMeta() {
  const out = { unlockedClasses: ['knight','mage','rogue','ranger','cleric','berserker'], runStats: {} };
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(META_KEY) : null;
    if (!raw) return out;
    const data = JSON.parse(raw);
    if (data && data.runStats) out.runStats = data.runStats;
    if (data && Array.isArray(data.unlockedClasses)) out.unlockedClasses = data.unlockedClasses;
  } catch (err) {
    // localStorage disabled / corrupt → in-memory fallback (defaults).
  }
  // Ensure each class has an entry.
  for (const def of CHARACTER_DEFS) {
    if (!out.runStats[def.key]) out.runStats[def.key] = { bestFloor: 0 };
  }
  return out;
}

function saveMeta() {
  if (!state || !state.meta) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      unlockedClasses: state.meta.unlockedClasses || [],
      runStats: state.meta.runStats || {},
    };
    localStorage.setItem(META_KEY, JSON.stringify(payload));
  } catch (err) {
    // ignore
  }
}

function recordBestFloor() {
  if (!state || !state.player || !state.player.classKey) return;
  if (!state.meta || !state.meta.runStats) return;
  const k = state.player.classKey;
  if (!state.meta.runStats[k]) state.meta.runStats[k] = { bestFloor: 0 };
  if (state.floor > state.meta.runStats[k].bestFloor) {
    state.meta.runStats[k].bestFloor = state.floor;
    saveMeta();
  }
}
