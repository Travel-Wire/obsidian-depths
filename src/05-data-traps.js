// ═══════════════════════════════════════════════
// 05-data-traps.js — TRAP_DEFS array
// ═══════════════════════════════════════════════

const TRAP_DEFS = [
  { type: 'spike',     name: 'Spike Trap',     ch: '^', color: '#c2410c', dmg: [4, 8],  minFloor: 1, msg: 'Spikes shoot up! {dmg} damage.', aoeRadius: 0 },
  { type: 'pit',       name: 'Pit Trap',       ch: 'o', color: '#1e1b18', dmg: [0, 0],  minFloor: 2, msg: 'The floor gives way!',           aoeRadius: 0, effect: 'fall' },
  { type: 'explosion', name: 'Explosive Rune', ch: '*', color: '#f97316', dmg: [6, 12], minFloor: 3, msg: 'A rune detonates!',              aoeRadius: 2, effect: 'aoe' },
  { type: 'poison',    name: 'Poison Vent',    ch: '%', color: '#4ade80', dmg: [2, 4],  minFloor: 4, msg: 'Poison gas erupts!',             aoeRadius: 0, effect: 'poison', poisonTurns: 5 },
  { type: 'alarm',     name: 'Alarm Bell',     ch: '!', color: '#fbbf24', dmg: [0, 0],  minFloor: 2, msg: 'Alarm rings!',                   aoeRadius: 12, effect: 'alarm' },
];
