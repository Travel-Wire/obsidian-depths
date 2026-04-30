// ═══════════════════════════════════════════════
// 03-data-items.js — ITEM_DEFS array
// ═══════════════════════════════════════════════

const ITEM_DEFS = [
  // ─── WEAPONS ───
  { id:'rusty_dagger',    name:'Rusty Dagger',     emoji:'🗡️', color:'#94a3b8', type:'weapon',    slot:'weapon',    atk:1, maxDur:50, minFloor:1, weight:6 },
  { id:'kitchen_knife',   name:'Kitchen Knife',    emoji:'🔪', color:'#cbd5e1', type:'weapon',    slot:'weapon',    atk:2, maxDur:25, minFloor:1, weight:5 },
  { id:'iron_sword',      name:'Iron Sword',       emoji:'⚔️', color:'#f5f5f5', type:'weapon',    slot:'weapon',    atk:4, maxDur:60, minFloor:2, weight:5 },
  { id:'battle_axe',      name:'Battle Axe',       emoji:'🪓', color:'#a16207', type:'weapon',    slot:'weapon',    atk:6, maxDur:50, minFloor:4, weight:3, twoHanded:true, critChance:0.20 },
  { id:'war_hammer',      name:'War Hammer',       emoji:'🔨', color:'#94a3b8', type:'weapon',    slot:'weapon',    atk:5, maxDur:70, minFloor:4, weight:3, twoHanded:true, stunChance:0.25 },
  { id:'short_bow',       name:'Short Bow',        emoji:'🏹', color:'#a16207', type:'weapon',    slot:'weapon',    atk:3, maxDur:40, minFloor:3, weight:3, twoHanded:true, ranged:true },
  { id:'apprentice_wand', name:'Apprentice Wand',  emoji:'🪄', color:'#a78bfa', type:'weapon',    slot:'weapon',    atk:2, maxDur:35, minFloor:3, weight:3, magic:true },
  // ─── ARMOR ───
  { id:'tattered_robes',  name:'Tattered Robes',   emoji:'🥋', color:'#a16207', type:'armor',     slot:'armor',     def:1, maxDur:30, minFloor:1, weight:5 },
  { id:'leather_vest',    name:'Leather Vest',     emoji:'🦺', color:'#84cc16', type:'armor',     slot:'armor',     def:2, maxDur:50, minFloor:2, weight:5 },
  { id:'chain_mail',      name:'Chain Mail',       emoji:'⚙️', color:'#94a3b8', type:'armor',     slot:'armor',     def:4, maxDur:80, minFloor:4, weight:3 },
  // ─── OFFHAND ───
  { id:'kite_shield',     name:'Kite Shield',      emoji:'🛡️', color:'#60a5fa', type:'offhand',   slot:'offhand',   def:2, maxDur:60, minFloor:3, weight:3, blockChance:0.15 },
  { id:'lantern',         name:'Lantern',          emoji:'🪙', color:'#fbbf24', type:'offhand',   slot:'offhand',   def:0, maxDur:40, minFloor:2, weight:2, lanternBonus:1 },
  // ─── ACCESSORIES ───
  { id:'silver_ring',     name:'Silver Ring',      emoji:'💍', color:'#e5e7eb', type:'accessory', slot:'accessory', atk:1, def:1, minFloor:2, weight:3 },
  { id:'crystal_amulet',  name:'Crystal Amulet',   emoji:'💎', color:'#22d3ee', type:'accessory', slot:'accessory', maxHp:5, minFloor:4, weight:2 },
  { id:'evil_eye',        name:'Evil Eye',         emoji:'🧿', color:'#3b82f6', type:'accessory', slot:'accessory', critBonus:0.10, minFloor:5, weight:2 },
  { id:'lucky_charm',     name:'Lucky Charm',      emoji:'🪬', color:'#fbbf24', type:'accessory', slot:'accessory', dropBonus:0.25, minFloor:6, weight:2 },
  // ─── CONSUMABLES ───
  { id:'health_potion',   name:'Health Potion',    emoji:'🧪', color:'#f87171', type:'potion',    slot:null,        effect:'heal',     value:12, minFloor:1, weight:8 },
  { id:'herb',            name:'Healing Herb',     emoji:'🌿', color:'#4ade80', type:'potion',    slot:null,        effect:'heal',     value:5,  minFloor:1, weight:9 },
  { id:'bread',           name:'Bread',            emoji:'🍞', color:'#d97706', type:'potion',    slot:null,        effect:'heal',     value:8,  minFloor:1, weight:7 },
  { id:'fire_scroll',     name:'Fire Scroll',      emoji:'📜', color:'#f97316', type:'scroll',    slot:null,        effect:'fireball', value:15, minFloor:2, weight:4 },
  { id:'blink_scroll',    name:'Blink Scroll',     emoji:'📜', color:'#38bdf8', type:'scroll',    slot:null,        effect:'blink',    value:0,  minFloor:2, weight:3 },
  { id:'key',             name:'Skeleton Key',     emoji:'🗝️', color:'#fbbf24', type:'key',       slot:null,        effect:'unlock',   value:0,  minFloor:3, weight:2 },
];
