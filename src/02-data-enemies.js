// ═══════════════════════════════════════════════
// 02-data-enemies.js — ENEMY_DEFS array
// ═══════════════════════════════════════════════

const ENEMY_DEFS = [
  { key:'rat',      emoji:'🐀',  name:'Rat',         ch:'r', color:'#a1a1aa', hp:6,  atk:2, def:0, xp:5,   minFloor:1, floor:[1,4],  weight:14, speed:SPEED.FAST,   movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'coward'    },
  { key:'snake',    emoji:'🐍',  name:'Snake',       ch:'s', color:'#4ade80', hp:8,  atk:3, def:0, xp:8,   minFloor:1, floor:[1,5],  weight:11, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ZIGZAG,          ai:'zigzagger', poison:{ticks:3, dmg:2} },
  { key:'bat',      emoji:'🦇',  name:'Bat',         ch:'b', color:'#818cf8', hp:5,  atk:3, def:0, xp:7,   minFloor:1, floor:[1,6],  weight:10, speed:SPEED.FAST,   movementPattern:MOVE_PATTERN.DIAGONAL,        ai:'flyer',     dodge:0.5 },
  { key:'spider',   emoji:'🕷️', name:'Spider',      ch:'S', color:'#a78bfa', hp:9,  atk:4, def:0, xp:12,  minFloor:2, floor:[2,7],  weight:9,  speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'ambusher',  webOnDeath:true, ambushRange:2 },
  { key:'skeleton', emoji:'💀',  name:'Skeleton',    ch:'k', color:'#e5e5e5', hp:12, atk:4, def:1, xp:12,  minFloor:1, floor:[1,8],  weight:12, speed:SPEED.SLOW,   movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'reviver',   reviveRange:3, reviveLimit:1 },
  { key:'ghost',    emoji:'👻',  name:'Ghost',       ch:'G', color:'#cbd5e1', hp:10, atk:5, def:0, xp:18,  minFloor:3, floor:[3,10], weight:7,  speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'phaser',    phaseWalls:true, ignoresDef:true, vanishBelow:0.5, vanishTicks:3 },
  { key:'goblin',   emoji:'👹',  name:'Goblin',      ch:'g', color:'#4ade80', hp:14, atk:4, def:1, xp:14,  minFloor:2, floor:[2,6],  weight:11, speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'thrower',   throwRange:3, throwChance:0.35, throwDmg:3 },
  { key:'orc',      emoji:'⚔️', name:'Orc Warrior', ch:'o', color:'#a3e635', hp:22, atk:6, def:2, xp:24,  minFloor:3, floor:[3,8],  weight:8,  speed:SPEED.SLOW,   movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'charger',   chargeRange:3, bleed:{ticks:2, dmg:1} },
  { key:'slime',    emoji:'🟢',  name:'Slime',       ch:'l', color:'#34d399', hp:16, atk:3, def:0, xp:10,  minFloor:2, floor:[2,6],  weight:8,  speed:SPEED.CRAWL,  movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'splitter',  splitMinHp:8, splitGen:2 },
  { key:'wraith',   emoji:'🌀',  name:'Wraith',      ch:'W', color:'#c084fc', hp:18, atk:5, def:1, xp:30,  minFloor:5, floor:[5,10], weight:6,  speed:SPEED.FAST,   movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'xpdrainer', drainXp:5 },
  { key:'golem',    emoji:'🗿',  name:'Golem',       ch:'O', color:'#94a3b8', hp:50, atk:7, def:5, xp:45,  minFloor:4, floor:[4,10], weight:4,  speed:SPEED.CRAWL,  movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'juggernaut',immune:['POISON','BLEED'] },
  { key:'mimic',    emoji:'📦',  name:'Mimic',       ch:'m', color:'#d97706', hp:20, atk:8, def:2, xp:35,  minFloor:3, floor:[3,10], weight:4,  speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.ORTHOGONAL,      ai:'mimic',     disguise:'📦', disguiseRange:1 },
  { key:'wizard',   emoji:'🧙',  name:'Wizard',      ch:'z', color:'#a78bfa', hp:16, atk:3, def:1, xp:40,  minFloor:5, floor:[5,10], weight:5,  speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'caster',    spellRange:5, fleeRange:2, fireDmg:4, freezeTicks:2 },
  { key:'demon',    emoji:'😈',  name:'Demon',       ch:'D', color:'#f87171', hp:35, atk:8, def:3, xp:60,  minFloor:7, floor:[7,10], weight:3,  speed:SPEED.NORMAL, movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'teleporter',teleportEvery:5, aoeRadius:2, aoeDmg:6 },
  { key:'dragon',   emoji:'🐉',  name:'Dragon',      ch:'Ω', color:'#ef4444', hp:80, atk:12,def:6, xp:200, minFloor:10,floor:[10,10],weight:1,  speed:SPEED.BLINK,  movementPattern:MOVE_PATTERN.OMNIDIRECTIONAL, ai:'dragon',    breathRange:5, breathDmg:8, breathCooldown:3, forceSpawn:true },
];
