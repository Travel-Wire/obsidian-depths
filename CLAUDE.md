# Obsidian Depths

Roguelike dungeon crawler — single-file HTML5 Canvas game.

## Quick Start

```bash
# Open directly in browser
open index.html

# Or serve locally
python3 -m http.server 8080
# → http://localhost:8080
```

## Architecture

Single file `index.html` (~1700 lines) containing:

| Section | What it does |
|---------|-------------|
| CSS (lines 1-430) | UI styling, touch controls, mobile responsive (@media <768px, <400px) |
| HTML (lines 430-500) | Canvas, UI overlay, title/death/win screens, touch D-pad |
| CONFIG (lines 505-540) | Game constants, tile types, colors |
| ENEMY_DEFS / ITEM_DEFS | 10 enemy types, 7 item types with stats |
| Dungeon Generation | Random rooms + L-corridors, torches, population |
| FOV | Recursive shadowcasting (8 octants) |
| Particles & Animations | Hit sparks, death effects, floating damage numbers |
| Rendering | Terrain → items → enemies → player → particles → fog → vignette |
| UI | HP/XP bars, stats panel, minimap, inventory, message log |
| Input | Keyboard (WASD/Arrows) + mobile touch D-pad + action buttons |
| Game Logic | Combat, XP/leveling, items, stairs, enemy AI |

## Controls

**Desktop:** WASD/Arrows = move, G = pickup, > = stairs, 1-5 = use item, Space = wait
**Mobile:** D-pad = move, Pick/Stairs/Wait buttons, tap inventory slot = use

## Game Design

- 10 floors, procedural dungeons (8-14 rooms each)
- Turn-based: player moves → enemies move
- Enemies scale with floor (Rat → Dragon)
- Items: potions, weapons, armor, scrolls (fireball AoE, blink teleport)
- XP & leveling: +6 HP, +1 ATK, +1 DEF per level
- Permadeath — floor 10 = victory

## Repo

GitHub: https://github.com/Travel-Wire/obsidian-depths
