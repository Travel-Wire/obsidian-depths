# v3-06 — Character Selection
Designer: Game-Designer + Narrative-Director (CCGS)
Plik: `obsidian-depths/index.html` (~1700 LOC)
Zależy od: plan 04 (equipment, ITEM_DEFS, durability), plan 05 (CARD_DEFS, recomputeStats)
Status: PLAN — bez implementacji

---

## Problem statement

Gracz to **generic adventurer** — brak imienia/klasy/backstory. Każdy run startuje identycznie: HP 25 / ATK 4 / DEF 1, Rusty Dagger 🗡️ + Tattered Robes 🥋, brak kart, brak passive. Skutki:

1. **Zero replayability hook poza kartami.** Plan 05 daje 50+ kart, ale każdy run startuje pustą kartką — pierwsze 3 levele to RNG zanim build się skrystalizuje.
2. **Brak narrative anchor.** Gracz nie wie kim jest. Death screen = generic "You died". Brak emocjonalnego inwestycji.
3. **Brak ścieżek trudności.** Nowy gracz = weteran. Brak easy/hard mode wyrażonych klasą.
4. **Brak meta-layer.** Slay the Spire / Hades / Vampire Survivors — wszystkie mają wybór postaci przed runem. Obsidian Depths nie.
5. **User explicit ask:** "daj mi też jakąś postać żebym ja miał postać i miał też jakieś do wyboru na start". Sygnał: potrzeba awatara.

---

## Design philosophy

**"Każda postać = inna gra".**

1. **6 archetypów / 6 playstyles.** Tank / Spell / Speed / Range / Sustain / Glass-cannon. Przeciwstawne osie HP↔DPS, melee↔range, sustain↔burst. Brak "strictly better".
2. **Pre-built identity, free starting card.** Każda klasa = 1 unikalna karta z plan 05. Build krystalizuje się od tury 1.
3. **Passive ability = klasowe DNA.** Niezdobywalne kartami, definiują klasę w mechanice (Resolve / Evasion / Bloodthirst…).
4. **Difficulty curve wbudowana w roster.** Knight (Easy) → Cleric → Rogue/Ranger (Med) → Mage → Berserker (Hard). Onboarding przez wybór postaci.
5. **Replayability ×6** + per-class unlocki narracyjne (5-10 each).
6. **Narrative hook per run.** Lore paragraf + opening/death/victory linie ~50 LOC dialogue → ×10 emocji.
7. **Synergia z plan 05.** Starting card otwiera konkretny build path (Mage Firebolt → Fire Aura → Hellfire; Berserker Rage → Lifesteal → blender).

---

## Roster (6)

### Knight ⚔️ — Tank / ⭐ Easy
- **Lore:** *Sir Aldric Thornveil, disgraced paladin of the Shattered Cross. Failed to defend a village from the obsidian rot. Descends seeking redemption — or a worthy death.*
- **Stats:** HP 30, ATK 4, DEF 2, Speed NORMAL.
- **Equipment:** 🔪 Iron Knife (atk+2, dur 25), 🦺 Leather Vest (def+2, dur 50). Off-hand i akcesoria puste.
- **Passive: Resolve** — gdy HP<25%, auto-trigger +50% DEF na 5 tur. Cooldown 30 tur. Visual: złota aura, 🛡️ w stat-panelu z licznikiem.
- **Starting card:** 🛡️ Resilience I (+2 DEF, plan 05).
- **Playstyle:** Tank/melee bruiser. Soak damage, trade'uj. Resolve clutch'uje na low HP. Słaby vs ranged compositions.

### Mage 🧙 — Spell / ⭐⭐⭐ Medium-Hard
- **Lore:** *Lyra Vex, last apprentice of Archmage Korvin the Vanished. Her master fell into these depths chasing a tome bound in dragon-skin. She follows with his journal and a half-learned fireball.*
- **Stats:** HP 18, ATK 3, DEF 1, Speed NORMAL.
- **Equipment:** 🪄 Apprentice Wand (atk+2, magic, scrolls ×1.25), 🥋 Tattered Robes. Inv: 2× 📜 Fire Scroll.
- **Passive: Arcane Affinity** — wszystkie scrolls +50% effect (fireball 15→22 dmg). +2 max scroll inventory (custom container `scrollPouch`, max 5).
- **Starting card:** 🔥 Firebolt (active, plan 05) — Q-key, 3+ATK + Burn 3t, CD 40.
- **Playstyle:** Range/spell DPS. Kite, exploit corridors, scroll burst. Naturalna ścieżka: Firebolt → Fire Aura → Hellfire. Squishy melee.

### Rogue 🗡️ — Speed/Dodge / ⭐⭐ Medium
- **Lore:** *Kaelen Hush, ex-thief of the Whisperguild. Banished. Hunting the legendary Obsidian Heart — black gem said to grant invisibility.*
- **Stats:** HP 22, ATK 5, DEF 1, Speed FAST (150).
- **Equipment:** 🔪 Iron Knife, 🥋 Tattered Robes. Acc1: 🗝️ Lockpick (custom flag `autoLockpick`, otwiera 🚪 chests bez kluczy, starting-only).
- **Passive: Evasion** — 25% chance dodge melee atak (animacja 💨, atak whiff'uje). Stack'uje z `cat_reflexes` cap 50%.
- **Starting card:** 👣 Cat Reflexes (perk, +20% dodge).
- **Playstyle:** Hit-and-run. Speed FAST = first-strike vs NORMAL, double-move vs SLOW (Skeleton/Zombie). Lockpick = darmowe chesty. Słaby vs high-HP bossy.

### Ranger 🏹 — Range / ⭐⭐ Medium
- **Lore:** *Tomas Brindel, hunter of the Greenwood. Tracked a shadow-beast into a cave that should not exist. Three weeks later, still following blood-trail.*
- **Stats:** HP 24, ATK 4, DEF 1, Speed NORMAL.
- **Equipment:** 🏹 Short Bow (atk+3, two-handed, range 5, miss 20%, dur 40), 🥋 Tattered Robes. Inv: 10× Arrow (1 atk = 1 arrow; bez arrows → melee 1 dmg).
- **Passive: Eagle Eye** — torch radius +1, arrows pierce 1 enemy (drugi w line-of-sight bierze 50% dmg).
- **Starting card:** 🏹 Marksman (weapon-synergy, +50% dmg + ignores 50% DEF z bow).
- **Playstyle:** Range corridor sniper. Pre-emptive shooting. Słaby gdy arrows out, vulnerable w dużych pokojach z 360° approach.

### Cleric 🌟 — Sustain / ⭐⭐ Easy-Medium
- **Lore:** *Sister Vela of the Lantern Order, sworn to exorcise the corruption seeping from these depths into surface villages. The dead recognize her. They are afraid.*
- **Stats:** HP 28, ATK 3, DEF 2, Speed NORMAL.
- **Equipment:** 🔨 War Hammer (atk+5, two-handed, stun 25%, dur 70), 🦺 Leather Vest. Acc1: 📿 Holy Symbol (custom — +1 HP regen co 3 tury, no dur, starting-only).
- **Passive: Divine Aura** — undead enemies (`tags:['undead']` na Skeleton/Zombie/Wraith/Ghost) biorą +25% dmg od Cleric'a.
- **Starting card:** 🩹 Regeneration (perk, +1 HP/5t out-of-combat /2t).
- **Playstyle:** Long-fight sustain. Niska burst, ale Holy Symbol + Regen + future Lifesteal = unkillable. Anti-undead niche.

### Berserker 🪓 — Glass cannon / ⭐⭐⭐⭐ Hard
- **Lore:** *Grimhart the Red, last of the Ironwolf Clan. His tribe was massacred when the obsidian crawled out of the earth. He seeks the biggest thing in these depths and intends to kill it.*
- **Stats:** HP 26, ATK 6 (highest), DEF 0 (no armor benefit), Speed NORMAL.
- **Equipment:** 🪓 Battle Axe (atk+6, two-handed, crit+20%, dur 50, dur−2/atk). NO armor (slot empty).
- **Passive: Bloodthirst** — przy zabiciu wroga: +1 free attack on next turn (extra `actionPoints`), +2 HP regen instant. Chain max 3 (kill chain reset po 5t bez kill).
- **Starting card:** 🪓 Berserker Rage (weapon-synergy, <50% HP: +100% dmg, +25% speed gdy axe equipped).
- **Playstyle:** All-in. Turn 1 = 12 ATK (vs Knight 6), 1-shot low-tier mobs → chain → clear room. DEF 0 = każdy hit boli. Vet-only.

---

## Character select screen design

### Flow
`Title "OBSIDIAN DEPTHS" → New Run → Character Select → Start Run → Game`. Back button: select → title.

### Desktop layout
- 6 portrait cards w 1×6 row (każdy ~140×180px).
- Każdy: emoji 64px + name + diff stars (1-4⭐) + playstyle tag (TANK/SPELL/SPEED/RANGE/HEAL/RAGE).
- Hover/click → border glow + lift `translateY(-6px)`. Detail panel pod row'em (no modal — inline expand).
- Detail panel: stats, equipment list, starting card, passive opis, lore paragraf, per-character meta-stats (Runs/Wins/Best Floor/Unlocks).
- "Start Run →" button (disabled dopóki postać nie wybrana). "← Back" top-left.

### Mobile (<768px)
- 2×3 grid (2 cols × 3 rows), kafelki ~140×160px.
- Tap portrait → bottom-sheet modal (slide-up animation) z pełnym detail + "Start Run". Swipe-down lub ✕ zamyka.
- Back button top-left.
- D-pad ukryty gdy modal open.

### Keyboard nav (desktop)
Arrow keys = nawigacja, Enter = Start Run, Escape = Back.

---

## Replayability hooks

### Per-character unlocks (5-10 each, przykłady):
- **Knight:** F1 complete → "Shattered Cross" lore; 50 kills → 🪖 cosmetic; F10 win → "Aldric's letter"; no-death win → Title "The Indomitable".
- **Mage:** 20 scroll-kills → Frost Scroll alt-spec; F10 z hellfire → 🪄→🔮 cosmetic.
- **Rogue:** 30 chest pickups → starting `lucky_charm`; 100 dodges → Title "The Untouchable".
- **Ranger:** 25 pierce-kills → Iron Arrows (+1 dmg).
- **Cleric:** 50 undead kills → Sanctified Hammer; F10 <30% HP loss → Title "The Pure".
- **Berserker:** 5-kill chain w 1t → 🪓→🪓🩸 cosmetic; F10 <500t → Title "The Storm".

### Cross-class achievements
"Six Faces of Death" (die jako każda klasa), "Master of the Depths" (F10 win każdą), "The Real Ironwolf" (Berserker no-armor F10), "Pacifist" (Cleric F10 <50 kills), "One Shot Wonder" (Mage Hellfire 1-cast F10 boss kill).

### Per-character meta-stats (localStorage)
```js
state.runStats = {
  knight: { runs: 0, wins: 0, bestFloor: 0, kills: 0, deaths: 0 },
  // 6 entries
};
state.classUnlocks = { knight: new Set(), ... };
```

---

## Balance considerations

| Class | OP-risk | UP-risk | Mitigation |
|---|---|---|---|
| Knight | None | Late-game speed deficit (mob ATK skaluje) | Resolve CD 30t = 2-3 boss-fight'y per floor |
| Mage | Scroll stacking 5×22dmg = 110 burst F10 | Pech z scroll drops | HP 18 = umrze przy adjacency misplay |
| Rogue | Evasion + Cat = ~50% dodge | HP 22 = punish za miss | Speed FAST balance |
| Ranger | Corridor pierce = AOE | Arrows finite, miss 20% | Marksman +50% offset |
| Cleric | Undead biome OP | Human/beast biome UP | Mob composition wariancja |
| Berserker | Lifesteal+Bloodthirst+Rage = 24dmg swings | Early F1-3 (no armor) | Anvil F3+ rescue |

**Onboarding curve:** Knight pierwszy (HP+5, DEF+1, gear upgrade) → Cleric (HP+3, regen) → Rogue/Ranger (med) → Mage/Berserker (hard, vet-only). Każda klasa może win F10 z right cards/items.

---

## Class × Card synergies

| Class | Dream Build | Effect |
|---|---|---|
| Knight | `tough_skin III` + `mythril_body` (legendary) + `resilient_aura` | Wall of armor: -3 dmg flat min, armor +30 dur |
| Mage | `sharp_eyes III` + `fire_aura I` + Firebolt + `hellfire` synergy | Death zone: 4-range pulses, single-target burst |
| Rogue | `cat_reflexes` + `lifesteal III` + `dagger_dance` | Perma-evasion ~50%, full HP po każdym room |
| Ranger | Marksman + `sharp_eyes III` + `lucky V` + `true_sight` | Sniper: torch+5, +25% crit, ignore 50% DEF, pierce |
| Cleric | Regen + `lifesteal III` + `vigor V` + `tactical` | Unkillable: 80 maxHP, +1HP/2t, 30% lifesteal, 1.5× first-attack |
| Berserker | `lifesteal III` + `tactical` + Berserker Rage + `whirlwind` active | Blender: <50%HP +100% dmg, AOE 36 dmg whirlwind |

**Anti-synergies:** Knight + `mace_crusher` (suboptimal), Mage + `sword_mastery` (irrelevant), Berserker + `mythril_body` (-20 speed conflict z Rage +25%).

---

## Narrative integration

```js
const OPENING_LINES = {
  knight: "The depths beckon, and Aldric Thornveil descends to find his redemption — or his end.",
  mage:   "Lyra Vex grips her master's journal. The fireball spell trembles on her lips.",
  rogue:  "Kaelen Hush slips past the threshold. Whatever waits below has not seen her yet.",
  ranger: "Tomas Brindel notches an arrow. The blood-trail leads down. So does he.",
  cleric: "Sister Vela raises her holy symbol. The dark recoils — for now.",
  berserker: "Grimhart laughs. The depths laugh back. One of them is wrong.",
};

const DEATH_LINES = {
  knight:    "The crypts claim another paladin who could not redeem himself. Aldric's hammer falls silent at last.",
  mage:      "Lyra's last spell flickers and dies. The journal burns with her. Korvin's secret remains.",
  rogue:     "Kaelen Hush dodged everything but the end. The Obsidian Heart will have other suitors.",
  ranger:    "Tomas's last arrow misses. The shadow-beast was waiting. He never saw what killed him.",
  cleric:    "Sister Vela's symbol grows cold. The dark comes flooding back. The corruption wins this round.",
  berserker: "Grimhart fell laughing. Half a dozen corpses cushion his body. The Ironwolf clan is finally extinct.",
};

const VICTORY_LINES = {
  knight:    "Aldric emerges from the depths, his oath remade in dragon's blood. The Shattered Cross is whole again.",
  mage:      "Lyra holds the dragon-skin tome. She is no longer an apprentice.",
  rogue:     "Kaelen Hush walks out with the Obsidian Heart in her palm. Nobody sees her leave.",
  ranger:    "Tomas notches one final arrow over the dragon's corpse — for the shadow-beast that started it all.",
  cleric:    "Sister Vela kneels. The corruption is contained. Above her, the lanterns of seven temples flare gold.",
  berserker: "Grimhart plants his axe in the dragon's skull. He is laughing. He is laughing.",
};
```

**Boss-specific dialogue (~12-15 linijek total):**
- Cleric vs Lich (F7): *"Return to the earth, abomination. Your master cannot help you."*
- Mage vs Dragon (F10): *"You ate my master, didn't you?"*
- Berserker any boss: 5%/turn flavor *"Grimhart laughs."*

---

## Data schema additions

```js
const CHARACTER_DEFS = [
  {
    key: 'knight', name: 'Knight', fullName: 'Sir Aldric Thornveil',
    emoji: '⚔️', portraitEmoji: '⚔️', difficulty: 1, playstyleTag: 'TANK',
    lore: "Disgraced paladin seeking redemption...",
    stats: { hp: 30, atk: 4, def: 2, speed: 100 },
    equipment: { weapon: 'iron_knife', armor: 'leather_vest', offhand: null, accessory1: null, accessory2: null },
    extraInventory: [],
    startingCard: 'resilience',
    passive: { id: 'resolve', name: 'Resolve', desc: 'HP<25% → +50% DEF for 5t (CD 30)' },
    openingLine: "...", deathLine: "...", victoryLine: "...",
    unlocks: [
      { id: 'lore_shattered_cross', trigger: 'completeFloor', value: 1 },
      { id: 'cosmetic_golden_helmet', trigger: 'totalKills', value: 50 },
      { id: 'lore_aldric_letter', trigger: 'winF10' },
      { id: 'title_indomitable', trigger: 'winNoDeaths' },
    ],
  },
  // mage, rogue, ranger, cleric, berserker — analogous
];

// Player state additions
state.player.classKey = 'knight';
state.player.passiveCooldowns = {};   // { resolve: 0 }
state.player.passiveActive = {};      // { resolve: 5 } — turny pozostałe
state.player.killChainCount = 0;      // dla Bloodthirst
state.player.scrollPouch = [];        // Mage custom container

// Persistent meta (localStorage 'obsidian-depths-meta')
state.unlockedClasses = new Set(['knight','mage','rogue','ranger','cleric','berserker']);
state.runStats = { knight: {...}, /* 6 entries */ };
state.classUnlocks = { knight: new Set(), /* 6 entries */ };

// Game phase
const PHASE = { TITLE, CHARACTER_SELECT, PLAYING, CHOOSING_CARD, DEAD, VICTORY };
```

---

## Implementation file:line

| Lokalizacja | Co dodać |
|---|---|
| L430-500 (HTML overlay) | `#character-select-screen` z `<div class="char-grid">` × 6 portrait cards + detail panel |
| L260-400 (CSS) | `.char-grid`, `.char-card`, `.char-portrait`, `.char-detail-panel`, `.diff-stars`, `.playstyle-tag`. Mobile @media 2×3 grid + bottom-sheet |
| L505-540 (CFG) | `PHASE` enum |
| ~L630 (po ITEM_DEFS, przed CARD_DEFS) | `CHARACTER_DEFS = [...]` (~150 LOC data) |
| ~L662 (`newState()`) | Dodać `classKey`, `passiveCooldowns`, `passiveActive`, `killChainCount`, `scrollPouch` |
| NEW `applyCharacter(classKey)` | Po `newState()`, override hp/maxHp/atk/def/speed/equipment/cards. ~30 LOC |
| NEW `loadMeta()` / `saveMeta()` | localStorage persistence z try/catch |
| NEW `showCharacterSelect()` / `hideCharacterSelect()` | Toggle visibility, render grid via template |
| L530 (title screen New Run) | Refactor: → `showCharacterSelect()` zamiast `initGame()` |
| `initGame()` (~L919) | Wstawić `applyCharacter(state.player.classKey)` po `newState()`, `addMessage(OPENING_LINES[classKey])` |
| `attackEnemy()` (~L979) | Hook `processPassive('attackEnemy', ctx)` (Divine Aura) |
| `enemyAttack()` (~L996) | Hook `processPassive('takeDamage', ctx)` (Resolve trigger, Evasion roll) |
| `processWorld()` / `endTurn()` | `processPassive('worldTick', ctx)` — CDs--, durations--, Holy Symbol regen |
| `useScroll()` | Mage check: `if (classKey==='mage') effect *= 1.5` |
| `death()` / `gameOver()` | `DEATH_LINES[classKey]`, update `runStats[classKey]`, save meta |
| `victory()` | `VICTORY_LINES[classKey]`, update wins/bestFloor, check unlocks, save meta |
| `updateUI()` (~L1474) | Sekcja "PASSIVE" — emoji + name + cooldown progress |
| NEW `hookKillEnemy(enemy)` | `runStats[classKey].kills++`, `processPassive('kill', enemy)` |
| L1593+ (keydown) | `if (gamePhase===CHARACTER_SELECT) handleCharSelectInput(e)` — arrows/enter/escape |

### Passive ability hooks — szkielet

```js
function processPassive(hook, ctx) {
  const def = CHARACTER_DEFS.find(d => d.key === state.player.classKey);
  PASSIVE_HANDLERS[def.passive.id]?.[hook]?.(ctx);
}

const PASSIVE_HANDLERS = {
  resolve: {
    takeDamage: (ctx) => {
      const p = state.player;
      if (p.hp/p.maxHp < 0.25 && (p.passiveCooldowns.resolve||0) <= 0 && p.hp > 0) {
        p.passiveActive.resolve = 5; p.passiveCooldowns.resolve = 30;
        addMessage("RESOLVE! +50% DEF for 5 turns.", 'level');
        spawnFloatingText(p.x, p.y, '🛡️', '#fbbf24');
      }
    },
    worldTick: () => {
      const p = state.player;
      if (p.passiveActive.resolve > 0) p.passiveActive.resolve--;
      if (p.passiveCooldowns.resolve > 0) p.passiveCooldowns.resolve--;
    },
  },
  evasion: {
    takeDamage: (ctx) => {
      if (ctx.melee && Math.random() < 0.25) {
        ctx.dodged = true;
        spawnFloatingText(state.player.x, state.player.y, '💨', '#10b981');
      }
    },
  },
  eagle_eye: {
    onInit: () => { state.player.torchRadiusBonus = (state.player.torchRadiusBonus||0) + 1; },
    arrowFired: (ctx) => {
      if (ctx.targets[1]) applyDamage(ctx.targets[1], Math.floor(ctx.dmg * 0.5));
    },
  },
  divine_aura: {
    attackEnemy: (ctx) => {
      if (ctx.enemy.tags?.includes('undead')) ctx.dmg = Math.floor(ctx.dmg * 1.25);
    },
    worldTick: () => {
      if (state.turns % 3 === 0 && state.player.hp < state.player.maxHp) state.player.hp++;
    },
  },
  bloodthirst: {
    kill: () => {
      const p = state.player;
      p.killChainCount = Math.min(3, (p.killChainCount||0) + 1);
      p.hp = Math.min(p.maxHp, p.hp + 2);
      state.actionPoints = (state.actionPoints||0) + 1;
      addMessage(`Bloodthirst! +1 attack, +2 HP.`, 'level');
    },
    worldTick: () => {
      if (state.player.killChainCount > 0 && state.turnsSinceLastKill > 5) state.player.killChainCount = 0;
    },
  },
  // arcane_affinity: inline w scroll handler
};

// Modyfikacja getPlayerDef() z plan 04 — jeśli Resolve aktywny: d = floor(d * 1.5)
```

---

## UI mockup (ASCII) — Character Select

```
╔═══════════════════════════════════════════════════════════╗
║  ← BACK         CHOOSE YOUR HERO                           ║
║  ╔════╗ ╔════╗ ╔════╗ ╔════╗ ╔════╗ ╔════╗                ║
║  ║ ⚔️  ║ ║ 🧙 ║ ║ 🗡️ ║ ║ 🏹 ║ ║ 🌟 ║ ║ 🪓 ║                ║
║  ║KNGT║ ║MAGE║ ║ROG ║ ║RNGR║ ║CLRC║ ║BRSK║                ║
║  ║ ★  ║ ║★★★ ║ ║★★  ║ ║★★  ║ ║★★  ║ ║★★★★║                ║
║  ║TANK║ ║SPLL║ ║SPED║ ║RNGE║ ║HEAL║ ║RAGE║                ║
║  ╚════╝ ╚════╝ ╚════╝ ╚════╝ ╚════╝ ╚════╝                ║
║   ▲ selected (golden glow)                                  ║
║  ┌─────────────────────────────────────────────────────┐  ║
║  │ ⚔️  KNIGHT — Sir Aldric Thornveil      ⭐ Easy       │  ║
║  │ HP 30  ATK 4  DEF 2  SPD NORMAL                      │  ║
║  │ Equip: 🔪 + 🦺 · Card: 🛡️ Resilience I               │  ║
║  │ Passive: RESOLVE (HP<25% → +50% DEF 5t, CD 30)       │  ║
║  │ "Disgraced paladin seeking redemption..."            │  ║
║  │ Runs 5 · Wins 1 · F8 · Unlocks 3/8                   │  ║
║  │                              [ START RUN → ]         │  ║
║  └─────────────────────────────────────────────────────┘  ║
║  ↔ Arrows · Enter start · Esc back                         ║
╚═══════════════════════════════════════════════════════════╝
```

### Mobile
2×3 grid kafelków → tap otwiera bottom-sheet modal slide-up z pełnym detail + "Start Run" + ✕ close. Swipe-down dismiss. Back button top-left.

---

## Acceptance criteria

- [ ] 6 postaci playable z różnymi stats/equipment/passive/starting card.
- [ ] Character select screen: desktop 1×6, mobile 2×3 grid + bottom-sheet modal.
- [ ] Hover/tap portrait updatuje detail panel (desktop) lub modal (mobile).
- [ ] "Start Run" disabled dopóki postać nie wybrana; click → `applyCharacter()` + `initGame()`.
- [ ] "Back" zwraca do title.
- [ ] `applyCharacter(classKey)` override'uje hp/atk/def/speed/equipment/cards z `CHARACTER_DEFS`.
- [ ] Knight Resolve: HP<25% → +50% DEF na 5t, CD 30t. Toast + ikonka + aura.
- [ ] Mage Arcane Affinity: scrolls ×1.5 effect, scroll inv cap 5.
- [ ] Rogue Evasion: 25% dodge melee, stack z `cat_reflexes` cap 50%.
- [ ] Ranger Eagle Eye: torch +1, arrows pierce 1 enemy.
- [ ] Cleric Divine Aura: undead biorą +25% dmg, Holy Symbol +1HP/3t.
- [ ] Berserker Bloodthirst: kill → +1 free attack, +2 HP, chain max 3.
- [ ] Stats per character tracked (`runStats[classKey]`), persisted localStorage.
- [ ] Unlocks tracked (`classUnlocks[classKey]`), progress w detail panel.
- [ ] Opening line w log na turn 1.
- [ ] Death line na death screen (klasowy zamiast generic).
- [ ] Victory line na F10 win screen.
- [ ] Boss-specific dialogue (Cleric vs Lich, Mage vs Dragon).
- [ ] Balance: każda klasa może win F10 (manual playtest 6 runów).
- [ ] Mobile UX 320-768px działa, swipe-down zamyka modal.
- [ ] Keyboard nav: arrows/Enter/Escape.
- [ ] localStorage persistence po restart, try/catch fallback.
- [ ] Backward compat: stary save → default `classKey: 'knight'`.

---

## Estimated effort

**Total ~25-30h** single dev / 12-15h pair-program. 7 vertical slices:

| Slice | Effort | Description |
|---|---|---|
| 1. Schema + applyCharacter | 3-4h | `CHARACTER_DEFS` (6×~25 LOC), override logic, `classKey` field |
| 2. Character select UI desktop | 4-5h | HTML/CSS grid, detail panel, button handlers, render template |
| 3. Character select UI mobile | 2-3h | @media 2×3, bottom-sheet slide-up, swipe handlers |
| 4. 6 passive abilities | 6-8h | PASSIVE_HANDLERS dispatch, hooks w combat/world tick, UI feedback |
| 5. Narrative integration | 2h | OPENING/DEATH/VICTORY dictionaries, hooks, boss dialogue |
| 6. Meta persistence | 2-3h | loadMeta/saveMeta, runStats updates, achievement detection |
| 7. Polish + balance + playtest | 4-6h | 6 runów F1-F10, tune CDs/multipliers, edge cases, animations |

Niskie ryzyko techniczne — wszystko opiera się o istniejące hooks z plan 04/05 + dispatch system.

---

## Edge cases

| Case | Solution |
|---|---|
| classKey undefined (stary save) | Default `'knight'`, addMessage warning |
| Mage scrolls past inv cap | Custom `scrollPouch` (max 5), separate od inv |
| Berserker chain w fireball multi-kill | Cap max 3, ostatnie skipnięte |
| Resolve trigger przy hp=0 (death frame) | Check `hp > 0` przed buff |
| Rogue dodge ranged atak | Evasion melee-only; ranged osobno |
| Ranger arrows = 0 | Bow → melee 1 dmg fallback (plan 04) |
| Multiple F10 wins same class | Best floor stays 10, wins++ |
| localStorage disabled | try/catch, in-memory fallback per-session |
| Switch character mid-run | Out of scope — stairs/death only |

---

## Notes for /audit
Manual playtest 1 run/class F1→F10. Performance: 6 portraits + animations < 0.5ms (GPU). aria-labels per portrait. Future: unlock-gated klasy, Druid/Necromancer.
