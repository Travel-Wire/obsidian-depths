// ═══════════════════════════════════════════════
// OBSIDIAN DEPTHS — A Roguelike Dungeon Crawler
// 01-config.js — Canvas refs, constants, colors
// ═══════════════════════════════════════════════

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

// ─── CONFIG ─────────────────────────────────────
const CFG = {
  MAP_W: 64,
  MAP_H: 44,
  TILE: 28,
  MAX_FLOOR: 10,
  FOV_RADIUS: 9, // legacy fallback (unused)
  // ─── 4-layer visibility (v3-01) ─────────────
  // BRIGHT: full color, max immersion. Doesn't grow with Sharp Eyes.
  // DIM:    desaturated mid-zone (the "main" reveal radius).
  // EDGE:   silhouette zone (sylwetki, no color).
  // TORCH_MAX: hard cap on EDGE after all bonuses (Sharp Eyes + Candle).
  TORCH_BRIGHT: 2,
  TORCH_DIM: 5,
  TORCH_EDGE: 8,
  TORCH_MAX: 12,
  // Legacy alias — kept so pre-v3 code paths (UI, etc.) still resolve.
  TORCH_RADIUS: 5,
  TORCH_RADIUS_MAX: 9,
  LIT_ROOM_CHANCE: 0.20,
  LIT_ROOM_MIN_PER_FLOOR: 1,
  LIT_ROOM_AREA_THRESHOLD: 35,
  TRAP_CHANCE_PER_ROOM: 0.35,
  TRAP_CHANCE_CORRIDOR: 0.12,
  ROOM_MIN: 5,
  ROOM_MAX: 12,
  ROOM_MIN_H: 4,
  ROOM_MAX_H: 9,
  INV_SIZE: 10,
  MSG_MAX: 5,
  // v4-01 — Drop economy
  ROOM_ITEM_CHANCE: 0.5,        // chance an item spawns in a non-start room (was implicitly 1.0)
  CRYSTAL_DROP_CHANCE: 0.85,    // % of enemy kills that drop crystals
  CRYSTAL_PILE_CHANCE: 0.05,    // 5% rooms get a crystal pile on floor
  SHOP_FLOOR_INTERVAL: 3,       // shop spawns every N floors (guaranteed)
  ANVIL_COOLDOWN_FLOORS: 3,     // anvil rate-limit
};

// ─── TURN ENGINE CONSTANTS ───────────────────────
const SPEED = { CRAWL: 25, SLOW: 50, NORMAL: 100, FAST: 150, BLINK: 200 };
const ACTION_COST = { MOVE: 100, ATTACK: 100, WAIT: 100, PICKUP: 0, STAIRS: 0, CHARGE: 200 };
const MOVE_PATTERN = {
  ORTHOGONAL: 'ORTHOGONAL', DIAGONAL: 'DIAGONAL', OMNIDIRECTIONAL: 'OMNIDIRECTIONAL',
  KNIGHT: 'KNIGHT', LEAP: 'LEAP', ZIGZAG: 'ZIGZAG',
};
const STATUS = {
  POISON: 'POISON', REGEN: 'REGEN', SLOW: 'SLOW', HASTE: 'HASTE', FREEZE: 'FREEZE',
  WEB: 'WEB', BLEED: 'BLEED', DRAIN_XP: 'DRAIN_XP',
};

const TILE = { WALL: 0, FLOOR: 1, STAIRS: 2, CORRIDOR: 3, ANVIL: 4, DOOR_CLOSED: 5, DOOR_OPEN: 6, SHOP: 7 };

const EMOJI_FONT = `'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;

const COLORS = {
  bg: '#05050a',
  wallBase: [30, 30, 48],
  floorBase: [18, 18, 28],
  corridorBase: [15, 15, 24],
  litRoomFloor: [55, 42, 22],
  stairsGlow: '#fbbf24',
  playerColor: '#22d3ee',
  playerGlow: 'rgba(34, 211, 238, 0.35)',
  torchColor: [255, 160, 50],
  fogUnexplored: 'rgba(5, 5, 10, 1)',
  fogExplored: 'rgba(5, 5, 10, 0.7)',
};
