// ═══════════════════════════════════════════════
// 03-data-items.js — ITEM_DEFS + Equipment Tier System (v3-02)
// ═══════════════════════════════════════════════

// ─── EQUIPMENT TIER SYSTEM ──────────────────────
const TIER = { COMMON:0, UNCOMMON:1, RARE:2, EPIC:3, LEGENDARY:4 };
const TIER_NAMES = ['Common','Uncommon','Rare','Epic','Legendary'];
const TIER_STATS = [1.00, 1.25, 1.50, 1.80, 2.20];
const TIER_AFFIX_COUNT = [0, 1, 1, 2, 3];
const TIER_BORDER = ['#94a3b8','#84cc16','#60a5fa','#a78bfa','#fbbf24'];

// Floor distribution table: [Common, Uncommon, Rare, Epic, Legendary], sums to 100
const TIER_TABLE = {
  1:[60,30,10,0,0],   2:[50,32,15,3,0],   3:[40,32,20,7,1],   4:[35,30,23,10,2],
  5:[25,30,30,10,5],  6:[20,25,30,18,7],  7:[15,22,30,23,10],
  8:[10,20,30,28,12], 9:[8,18,30,30,14],  10:[5,15,30,30,20],
};

// ─── AFFIX CATALOG (8 affixes — MVP) ────────────
// apply() runs at recomputeStats time on the player; slots restrict eligibility.
const AFFIX_DEFS = [
  { id:'crit5',         displayPrefix:'Sharp',     tierMin:TIER.UNCOMMON,
    slots:['weapon'],
    desc:'+5% crit chance',
    apply:(p)=>{ p.critChance += 0.05; } },
  { id:'crit15',        displayPrefix:'Brutal',    tierMin:TIER.RARE,
    slots:['weapon'],
    desc:'+15% crit chance',
    apply:(p)=>{ p.critChance += 0.15; } },
  { id:'lifesteal10',   displayPrefix:'Vampiric',  tierMin:TIER.UNCOMMON,
    slots:['weapon'],
    desc:'10% melee dmg → heal',
    apply:(p)=>{ p.lifestealPct += 0.10; } },
  { id:'lifesteal25',   displayPrefix:'Bloodthirsty', tierMin:TIER.RARE,
    slots:['weapon'],
    desc:'25% melee dmg → heal',
    apply:(p)=>{ p.lifestealPct += 0.25; } },
  { id:'regen1',        displayPrefix:'Regenerating', tierMin:TIER.RARE,
    slots:['armor','accessory','offhand'],
    desc:'+1 HP every 3 turns',
    apply:(p)=>{ p.flags = p.flags || {}; p.flags.affixRegen = (p.flags.affixRegen||0) + 1; } },
  { id:'hp15',          displayPrefix:'Vital',     tierMin:TIER.UNCOMMON,
    slots:['armor','accessory','offhand'],
    desc:'+15 max HP',
    apply:(p)=>{ p.maxHp += 15; } },
  { id:'dodge15',       displayPrefix:'Light',     tierMin:TIER.RARE,
    slots:['armor','accessory','offhand'],
    desc:'+15% dodge chance',
    apply:(p)=>{ p.dodgeChance += 0.15; } },
  { id:'reflect20',     displayPrefix:'Thorny',    tierMin:TIER.RARE,
    slots:['armor','offhand','accessory'],
    desc:'Reflect 20% melee damage',
    apply:(p)=>{ p.flags = p.flags || {}; p.flags.affixReflect = Math.max(p.flags.affixReflect||0, 0.20); } },
];

function findAffix(id) { return AFFIX_DEFS.find(a => a.id === id); }

// ─── v4-02 FUSION OUTCOMES ──────────────────────
// MVP cut: 5% brick, 50% stat, 30% affix, 15% slot upgrade. Tier-upgrade SKIPPED.
const FUSION_OUTCOMES = [
  { id:'stat',   weight:50, label:'Stat Boost',     emoji:'⚔️', desc:'+1 atk/def' },
  { id:'affix',  weight:30, label:'Affix Add',      emoji:'✨', desc:'+1 affix or upgrade' },
  { id:'slot',   weight:15, label:'Slot Upgrade',   emoji:'💥', desc:'+5% crit/block/dodge' },
  { id:'brick',  weight:5,  label:'Shatter!',       emoji:'💔', desc:'Both items destroyed' },
];

function rollFusionOutcome() {
  const total = FUSION_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of FUSION_OUTCOMES) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return FUSION_OUTCOMES[0];
}

// Returns [3 outcomes] with one .highlighted=true (the rolled one).
// Display layer shows all 3, only the highlighted one is applied on Confirm.
function previewFusionOutcomes() {
  const chosen = rollFusionOutcome();
  // Pick 2 distinct other outcomes for visual variety
  const others = FUSION_OUTCOMES.filter(o => o.id !== chosen.id);
  // Shuffle others, take 2
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const cards = [
    { ...chosen, highlighted: true },
    { ...others[0], highlighted: false },
    { ...others[1], highlighted: false },
  ];
  // Shuffle final card order so highlight isn't always first
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

// Apply fusion outcome to primary item. Mutates primary in place.
// Returns { ok, brick } — brick=true means primary should be destroyed too.
function applyFusionOutcome(primary, outcome) {
  if (outcome.id === 'brick') {
    return { ok: true, brick: true };
  }
  // Common: every fusion bumps upgradeLevel and grants base stat tick.
  primary.upgradeLevel = (primary.upgradeLevel || 0) + 1;
  if (primary.atk != null) primary.atk = Math.max(1, primary.atk + Math.max(1, Math.round(primary.atk * 0.10)));
  if (primary.def != null) primary.def = Math.max(1, primary.def + Math.max(1, Math.round(primary.def * 0.10)));
  if (primary.maxDur != null) {
    primary.maxDur += 20;
    primary.dur = primary.maxDur; // free repair on fusion
  }
  if (outcome.id === 'stat') {
    // Extra +1 atk OR +1 def (whichever exists; if both — random)
    const hasAtk = primary.atk != null;
    const hasDef = primary.def != null;
    if (hasAtk && hasDef) {
      if (Math.random() < 0.5) primary.atk += 1; else primary.def += 1;
    } else if (hasAtk) {
      primary.atk += 1;
    } else if (hasDef) {
      primary.def += 1;
    } else if (primary.maxHp != null) {
      primary.maxHp += 5;
    }
  } else if (outcome.id === 'affix') {
    primary.affixes = primary.affixes || [];
    const tier = (typeof primary.tier === 'number') ? primary.tier : TIER.UNCOMMON;
    const slot = primary.slot;
    if (primary.affixes.length < 3) {
      // Add new eligible affix not already present
      const have = new Set(primary.affixes.map(a => a.id));
      const eligible = AFFIX_DEFS.filter(a =>
        a.tierMin <= Math.max(tier, TIER.UNCOMMON) && (!a.slots || a.slots.includes(slot)) && !have.has(a.id)
      );
      if (eligible.length > 0) {
        const pick = eligible[Math.floor(Math.random() * eligible.length)];
        primary.affixes.push(pick);
        // Update display name with first affix prefix if not already
        const baseName = primary.name.replace(/^.+? /, '');
        if (primary.affixes.length === 1) primary.name = `${pick.displayPrefix} ${baseName}`;
      } else {
        // No room to add — fall back to stat boost
        if (primary.atk != null) primary.atk += 1;
        else if (primary.def != null) primary.def += 1;
      }
    } else {
      // 3 affixes — upgrade first one to a stronger eligible variant if possible.
      const first = primary.affixes[0];
      // Try to find a tier-stronger version (e.g., crit5 → crit15)
      const upgradeMap = { crit5:'crit15', lifesteal10:'lifesteal25' };
      const upId = upgradeMap[first.id];
      if (upId) {
        const up = findAffix(upId);
        if (up) primary.affixes[0] = up;
      } else {
        // No upgrade path — minor stat bump
        if (primary.atk != null) primary.atk += 1;
        else if (primary.def != null) primary.def += 1;
      }
    }
  } else if (outcome.id === 'slot') {
    // +5% crit / block / dodge by slot type. Cap @ +25%.
    const slot = primary.slot;
    if (slot === 'weapon') {
      primary.critChance = Math.min(0.95, (primary.critChance || 0) + 0.05);
    } else if (slot === 'offhand') {
      primary.blockChance = Math.min(0.95, (primary.blockChance || 0) + 0.05);
    } else if (slot === 'armor' || slot === 'accessory') {
      primary.dodgeChanceBonus = Math.min(0.25, (primary.dodgeChanceBonus || 0) + 0.05);
      // Note: dodgeChance is computed at recompute time — we stash a per-item bonus.
    }
  }
  return { ok: true, brick: false };
}

// ─── ITEM_DEFS — base catalog with bazowy tier mapping ───
// tierBase = the tier this item naturally maps to at ×1.00 multiplier
// Mapping (per planner MVP cut): Rusty Dagger=Common, Iron Knife/Sword=Uncommon,
// Long Sword=Rare, Battle Axe=Epic, War Hammer=Epic.
const ITEM_DEFS = [
  // ─── WEAPONS ───
  { id:'rusty_dagger',    name:'Rusty Dagger',     emoji:'🗡️', color:'#94a3b8', type:'weapon',    slot:'weapon',    atk:1, maxDur:50, minFloor:1, weight:6, tierBase:TIER.COMMON },
  { id:'kitchen_knife',   name:'Kitchen Knife',    emoji:'🔪', color:'#cbd5e1', type:'weapon',    slot:'weapon',    atk:2, maxDur:25, minFloor:1, weight:5, tierBase:TIER.COMMON },
  { id:'iron_sword',      name:'Iron Sword',       emoji:'⚔️', color:'#f5f5f5', type:'weapon',    slot:'weapon',    atk:4, maxDur:60, minFloor:2, weight:5, tierBase:TIER.UNCOMMON },
  { id:'battle_axe',      name:'Battle Axe',       emoji:'🪓', color:'#a16207', type:'weapon',    slot:'weapon',    atk:6, maxDur:50, minFloor:4, weight:3, twoHanded:true, critChance:0.20, tierBase:TIER.EPIC },
  { id:'war_hammer',      name:'War Hammer',       emoji:'🔨', color:'#94a3b8', type:'weapon',    slot:'weapon',    atk:5, maxDur:70, minFloor:4, weight:3, twoHanded:true, stunChance:0.25, tierBase:TIER.EPIC },
  { id:'short_bow',       name:'Short Bow',        emoji:'🏹', color:'#a16207', type:'weapon',    slot:'weapon',    atk:3, maxDur:40, minFloor:3, weight:3, twoHanded:true, ranged:true, tierBase:TIER.UNCOMMON },
  { id:'apprentice_wand', name:'Apprentice Wand',  emoji:'🪄', color:'#a78bfa', type:'weapon',    slot:'weapon',    atk:2, maxDur:35, minFloor:3, weight:3, magic:true, tierBase:TIER.UNCOMMON },
  // ─── ARMOR ───
  { id:'tattered_robes',  name:'Tattered Robes',   emoji:'🥋', color:'#a16207', type:'armor',     slot:'armor',     def:1, maxDur:30, minFloor:1, weight:5, tierBase:TIER.COMMON },
  { id:'leather_vest',    name:'Leather Vest',     emoji:'🦺', color:'#84cc16', type:'armor',     slot:'armor',     def:2, maxDur:50, minFloor:2, weight:5, tierBase:TIER.UNCOMMON },
  { id:'chain_mail',      name:'Chain Mail',       emoji:'⚙️', color:'#94a3b8', type:'armor',     slot:'armor',     def:4, maxDur:80, minFloor:4, weight:3, tierBase:TIER.RARE },
  // ─── OFFHAND ───
  { id:'kite_shield',     name:'Kite Shield',      emoji:'🛡️', color:'#60a5fa', type:'offhand',   slot:'offhand',   def:2, maxDur:60, minFloor:3, weight:3, blockChance:0.15, tierBase:TIER.RARE },
  { id:'lantern',         name:'Lantern',          emoji:'🪙', color:'#fbbf24', type:'offhand',   slot:'offhand',   def:0, maxDur:40, minFloor:2, weight:2, lanternBonus:1, tierBase:TIER.UNCOMMON },
  // ─── ACCESSORIES ───
  { id:'silver_ring',     name:'Silver Ring',      emoji:'💍', color:'#e5e7eb', type:'accessory', slot:'accessory', atk:1, def:1, minFloor:2, weight:3, tierBase:TIER.UNCOMMON },
  { id:'crystal_amulet',  name:'Crystal Amulet',   emoji:'💎', color:'#22d3ee', type:'accessory', slot:'accessory', maxHp:5, minFloor:4, weight:2, tierBase:TIER.RARE },
  { id:'evil_eye',        name:'Evil Eye',         emoji:'🧿', color:'#3b82f6', type:'accessory', slot:'accessory', critBonus:0.10, minFloor:5, weight:2, tierBase:TIER.RARE },
  { id:'lucky_charm',     name:'Lucky Charm',      emoji:'🪬', color:'#fbbf24', type:'accessory', slot:'accessory', dropBonus:0.25, minFloor:6, weight:2, tierBase:TIER.EPIC },
  // ─── CONSUMABLES (tier-EXEMPT — stay flat) ───
  { id:'health_potion',   name:'Health Potion',    emoji:'🧪', color:'#f87171', type:'potion',    slot:null,        effect:'heal',     value:12, minFloor:1, weight:8 },
  { id:'herb',            name:'Healing Herb',     emoji:'🌿', color:'#4ade80', type:'potion',    slot:null,        effect:'heal',     value:5,  minFloor:1, weight:9 },
  { id:'bread',           name:'Bread',            emoji:'🍞', color:'#d97706', type:'potion',    slot:null,        effect:'heal',     value:8,  minFloor:1, weight:7 },
  { id:'fire_scroll',     name:'Fire Scroll',      emoji:'📜', color:'#f97316', type:'scroll',    slot:null,        effect:'fireball', value:15, minFloor:2, weight:4 },
  { id:'blink_scroll',    name:'Blink Scroll',     emoji:'📜', color:'#38bdf8', type:'scroll',    slot:null,        effect:'blink',    value:0,  minFloor:2, weight:3 },
  { id:'key',             name:'Skeleton Key',     emoji:'🗝️', color:'#fbbf24', type:'key',       slot:null,        effect:'unlock',   value:0,  minFloor:3, weight:2 },
  // v4-05 — HP rework
  { id:'greater_heal',    name:'Greater Heal',     emoji:'🧫', color:'#fb7185', type:'potion',    slot:null,        effect:'heal',     value:50, minFloor:4, weight:2 },
  { id:'regen_potion',    name:'Regen Potion',     emoji:'🟢', color:'#4ade80', type:'potion',    slot:null,        effect:'regen',    value:2,  ticks:6, minFloor:3, weight:3 },
  // v4-04 — Trap skills
  { id:'disarm_scroll',   name:'Disarm Scroll',    emoji:'📜', color:'#a78bfa', type:'scroll',    slot:null,        effect:'disarm',   value:0,  minFloor:3, weight:3 },
];

// ─── LEGENDARY UNIQUES (3 per MVP cut) ───────────
const LEGENDARY_DEFS = [
  { id:'leg_reaver', name:'The Reaver', emoji:'⚔️', color:'#fbbf24',
    type:'weapon', slot:'weapon', atk:13, maxDur:90, minFloor:5,
    critChance:0.20,
    affixes:['lifesteal25','crit15'],
    unique:{ id:'on_kill_heal', value:5, desc:'On kill: heal 5 HP' } },
  { id:'leg_obsidian_heart', name:'Obsidian Heart', emoji:'💎', color:'#a78bfa',
    type:'accessory', slot:'accessory', maxHp:20, minFloor:6,
    affixes:['regen1','hp15'],
    unique:{ id:'floor_revive', desc:'First lethal hit/floor: revive 50% HP' } },
  { id:'leg_aegis', name:'Aegis of Mountains', emoji:'🛡️', color:'#fbbf24',
    type:'offhand', slot:'offhand', def:4, maxDur:130, blockChance:0.30, minFloor:7,
    affixes:['reflect20','regen1'],
    unique:{ id:'reflect_50', value:0.50, desc:'Reflect 50% melee damage' } },
];

function findLegendaryDef(id) { return LEGENDARY_DEFS.find(d => d.id === id); }

// ─── TIER ROLLER ────────────────────────────────
function pickItemTier(floor, opts) {
  opts = opts || {};
  const f = Math.min(10, Math.max(1, floor|0));
  const weights = TIER_TABLE[f];
  let r = Math.random() * 100, cum = 0;
  for (let i = 0; i < 5; i++) {
    cum += weights[i];
    if (r < cum) {
      // Boss-room minimum-Rare upgrade (F4/F6) or min-Epic (F8/F10)
      if (opts.bossDrop) {
        const minTier = (f >= 8) ? TIER.EPIC : TIER.RARE;
        if (i < minTier) return minTier;
      }
      return i;
    }
  }
  return TIER.COMMON;
}

// Sample N affixes eligible for given tier+slot (no repeats)
function sampleAffixes(n, tier, slot) {
  if (n <= 0) return [];
  const eligible = AFFIX_DEFS.filter(a =>
    a.tierMin <= tier && (!a.slots || a.slots.includes(slot))
  );
  const pool = eligible.slice();
  const out = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}
