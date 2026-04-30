# v3-02 — Equipment Tier System
Designer: Economy-Designer + Game-Designer (CCGS)
Date: 2026-04-30
Status: PLAN — pre-implementation
Source files referenced: `index.html` (ITEM_DEFS @ L1019–1047), `production/qa/balance-report.md`

---

## Problem statement

Aktualne 22 itemy w `ITEM_DEFS` są **flat** — każda instancja Rusty Dagger ma identyczne `atk:1, maxDur:50`. Pickup loop jest deterministyczny: gracz widzi emoji, wie dokładnie, co dostanie. Nie ma rzutu kostką, nie ma "wow, fioletowy!", nie ma reasonu wracać do gry żeby polować na lepszą wersję tej samej broni.

QA-Lead w balance-report (sekcja 5 Item Economy) potwierdza: 16–42 itemów per floor, ale **żadna z tych instancji nie różni się od poprzedniej**. Po F4 gracz widzi Battle Axe i wie, że kolejna Battle Axe niczego mu nie zmieni. Loot pickup w current state to chore (tempo turn) bez emocji.

Wtórnym problemem jest **pseudo-pionowa progresja przez minFloor**: progresja itemów odbywa się tylko przez odblokowanie nowych def-ów (Iron Sword F2, Battle Axe F4). Po F4 nic się więcej nie dzieje na warstwie equipmentu — gracz polega wyłącznie na cards/levelups. Equipment staje się solved problem do połowy gry.

## Design philosophy

**"Borderlands-on-a-budget loot"** — każdy floor to kolejny rzut na wyższy tier. Common→Legendary daje **5-stopniową drabinę powerów ×1.0–×2.2 + affixy**, więc każde podniesienie itemu z ziemi to mini-gacha moment. Crucial design constraint: **nie chcemy robić Diablo 4 z 200 affixami** — to single-file roguelike. Wszystkie tiery muszą być rozróżnialne na pierwszy rzut oka (color border + glow), bez open-ekranu inspectu.

Trzy zasady:
1. **Floor-driven scarcity**: Common na F1 = bread-and-butter, Legendary na F1 = nigdy. Floor 10 odwraca to: Common przestaje spawnować (5%), Legendary obowiązkowo widoczny.
2. **Backwards compat**: 22 istniejące itemy NIE są usuwane. Każdy mapuje się na bazowy tier; tier system nakłada multiplier ×rarity i affixy na top.
3. **No content treadmill**: gracz nie musi nauczyć się 100 nowych itemów. Uczy się 22 baz + 5 tier reguł + ~17 affixów + 6 unique Legendary. Mental load < 50 rzeczy.

---

## Tier system spec

| Tier | Border | Glow | Stat ×mult | Affix count | Naming convention | Spawn weight scale |
|------|--------|------|-----------|-------------|-------------------|-------------------|
| Common | grey `#94a3b8` | none | ×1.00 | 0 | "Rusty Dagger" (bare name) | baseline |
| Uncommon | green `#84cc16` | none | ×1.25 | 1 minor | "Sturdy Rusty Dagger" / "Sharp Iron Sword" (1 prefix) | baseline |
| Rare | blue `#60a5fa` | subtle pulse | ×1.50 | 1 major OR 2 minor | "Masterwork ___" / "Enchanted ___" | baseline |
| Epic | purple `#a78bfa` | static aura | ×1.80 | 2 major OR (1 major + unique passive) | named items: "Soulrender", "Ironbark Vest" | baseline |
| Legendary | gold `#fbbf24` | particle glow | ×2.20 | 3 affixes + unique mechanic | unique only: "The Reaver", "Obsidian Heart" | very rare, hard floor |

Note: stat mult applies to atk/def/maxDur/maxHp/critBonus. Effect-on-use values (heal value, fireball dmg) inherit ×mult only on equipment, not on consumables (consumables stay flat for economy reasons — see Balance notes).

### Visual differentiation (must be screen-readable)

- **Border**: 2px frame around emoji on ground tile + 2px frame on inventory slot
- **Tooltip header**: "[TIER] Item Name" with tier color in text
- **Legendary glow**: 1 yellow particle every 6–8 frames spawned at item position, pulsing alpha
- **Pickup SFX** (if/when audio added): common = thunk, uncommon = soft chime, rare = double chime, epic = chord, legendary = bell hit

---

## Floor distribution table (TIER_TABLE)

Order in array: `[Common, Uncommon, Rare, Epic, Legendary]`. Sums to 100.

| Floor | C | U | R | E | L | Notes |
|-------|---|---|---|---|---|-------|
| F1 | 60 | 30 | 10 | 0 | 0 | Tutorial: trash + occasional shiny |
| F2 | 50 | 32 | 15 | 3 | 0 | Epic introduced as 3% trickle |
| F3 | 40 | 32 | 20 | 7 | 1 | Legendary first appearance (1%) |
| F4 | 35 | 30 | 23 | 10 | 2 | Boss floor (see boss rule) |
| F5 | 25 | 30 | 30 | 10 | 5 | "Inflection point" — Rare becomes modal |
| F6 | 20 | 25 | 30 | 18 | 7 | Boss floor |
| F7 | 15 | 22 | 30 | 23 | 10 | Epic > Common |
| F8 | 10 | 20 | 30 | 28 | 12 | Boss floor |
| F9 | 8 | 18 | 30 | 30 | 14 | Pre-boss endgame |
| F10 | 5 | 15 | 30 | 30 | 20 | Dragon floor — gear must keep pace |

### Boss room guarantee

Floors with bosses (F4, F6, F8, F10) — when player enters boss room, **next item dropped on that floor is min Rare**. Implementation: flag `state.bossRoomDropPending = true` when entering boss room, intercepted by spawn logic; if generated tier < RARE, upgrade to RARE.

Additionally, **F10 Dragon kill = guaranteed Legendary drop** (regardless of normal table).

---

## Affix catalog (17 affixes)

Two pools: minor (lighter effect, available from Uncommon up) and major (Rare+).

### Minor affixes (10)

| ID | Name (prefix) | Effect | Slot restriction | tierMin |
|----|---|---|---|---|
| `crit5` | Sharp | +5% crit chance | weapon | UNCOMMON |
| `lifesteal10` | Vampiric | 10% melee dmg → heal | weapon | UNCOMMON |
| `hp1` | Vital | +1 maxHp | armor/accessory | UNCOMMON |
| `dur_armor2` | Sturdy | +2 armor durability per round (slow regen of dur) | armor | UNCOMMON |
| `accuracy5` | Keen | +5% accuracy | weapon | UNCOMMON |
| `def1` | Reinforced | +1 def | armor/offhand | UNCOMMON |
| `atk1` | Honed | +1 flat atk | weapon | UNCOMMON |
| `dodge5` | Light | +5% dodge | armor | UNCOMMON |
| `torch1` | Glowing | +1 torch radius | offhand/accessory | UNCOMMON |
| `xpbonus10` | Wise | +10% xp gain | accessory | UNCOMMON |

### Major affixes (7)

| ID | Name (prefix) | Effect | Slot restriction | tierMin |
|----|---|---|---|---|
| `crit15` | Brutal | +15% crit chance | weapon | RARE |
| `dmg25` | Savage | +25% damage | weapon | RARE |
| `regen1` | Regenerating | +1 hp/turn | armor/accessory | RARE |
| `poison_immune` | Wardrobe | Immune to poison | armor | RARE |
| `def3` | Bulwark | +3 def | armor/offhand | RARE |
| `lifesteal25` | Bloodthirsty | 25% melee dmg → heal | weapon | RARE |
| `stunchance10` | Concussive | +10% stun on hit | weapon | RARE |

### Affix selection rules
- Affixes are **slot-aware**: weapon-only affix won't roll on armor.
- Same affix can't roll twice on the same item.
- Naming: prefix the first affix name (e.g. "Sharp Rusty Dagger"); remaining affixes appear only in tooltip.
- Legendary-tier 3 affixes = 1 minor + 2 major (or 3 major if unique mechanic counts as 1 affix slot).

---

## Existing 22 items mapped to tiers

Mapping = each existing item gets a **bazowy tier** (the tier it represents at ×1.0 mult). When tier rolls higher than the base, multiplier is applied; when lower, the item still shows but with downscaled stats (rare in practice — minFloor + tier weight tend to align).

### Weapons (7)
| Item | minFloor | Base tier | Reasoning |
|------|----------|-----------|-----------|
| Rusty Dagger | 1 | COMMON | Designed-baseline starter |
| Kitchen Knife | 1 | COMMON | Trash tier, atk 2 dur 25 |
| Iron Sword | 2 | UNCOMMON | atk 4 — clear step up |
| Short Bow | 3 | UNCOMMON | ranged but atk 3 — useful niche |
| Apprentice Wand | 3 | UNCOMMON | currently dead content per balance-report; reskin into "magic" affix carrier |
| Battle Axe | 4 | RARE | atk 6 + critChance 0.20 = already Rare-feel |
| War Hammer | 4 | RARE | atk 5 + stunChance 0.25 = Rare-feel |

### Armor (3)
| Item | minFloor | Base tier |
|------|----------|-----------|
| Tattered Robes | 1 | COMMON |
| Leather Vest | 2 | UNCOMMON |
| Chain Mail | 4 | RARE |

### Offhand (2)
| Item | Base tier |
|------|-----------|
| Lantern | UNCOMMON (unique utility, not power) |
| Kite Shield | RARE (blockChance 0.15) |

### Accessories (4)
| Item | Base tier |
|------|-----------|
| Silver Ring | UNCOMMON |
| Crystal Amulet | RARE |
| Evil Eye | RARE |
| Lucky Charm | EPIC (dropBonus is a strong meta effect) |

### Consumables (6)
**Decision: consumables are tier-EXEMPT.** They stay flat. Tiering potions and scrolls would explode complexity ("Sharp Health Potion?") with no design benefit. Health Potion / Herb / Bread / Fire Scroll / Blink Scroll / Skeleton Key — all Common-equivalent and untiered.

Resulting equippable count for tier system: **16 base items**.

---

## New Legendary catalog (6 unique items)

Legendaries are **not generated procedurally** — they're hand-designed unique drops with predetermined affixes + a unique mechanic. Each has its own ID and replaces the "tier roll Legendary" outcome by being picked from this pool.

### 1. The Reaver ⚔️ (sword slot)
- Type: sword (sword_mastery synergy compatible)
- Stats (Epic baseline ×2.2 = atk ~13, dur 90)
- Affix 1: `lifesteal30` (custom, stronger than Bloodthirsty)
- Affix 2: `crit15` Brutal
- Unique mechanic: **"On kill: heal 5 HP"** (independent from lifesteal — fires on enemy death)
- Spawnable: F5+

### 2. Obsidian Heart 💎 (accessory)
- Type: amulet
- Stats: maxHp +20
- Affix 1: `regen1`
- Affix 2: `poison_immune`
- Unique mechanic: **"First lethal damage per floor: revive at 50% HP"** (uses `state.heartUsedThisFloor` flag, resets on stairs)
- Spawnable: F6+

### 3. Whisperwind 🏹 (bow weapon)
- Type: bow + ranged + twoHanded
- Stats (Epic-bow baseline ×2.2): atk ~7, dur 80
- Affix 1: `crit15`
- Affix 2: `dmg25`
- Unique mechanic: **"Arrows pass through enemies in a line"** — fires through up to 3 enemies along ray
- Spawnable: F4+ (boss-room exclusive)

### 4. Aegis of Mountains 🛡️ (offhand shield)
- Stats: def ×2.2 = ~4, dur 130, blockChance 0.30
- Affix 1: `def3` Bulwark
- Affix 2: `regen1`
- Unique mechanic: **"Reflect 50% melee damage to attacker"**
- Spawnable: F7+

### 5. Crown of Thieves 👑 (helm — NEW SLOT or accessory)
- Note: current code has `armor` (chest) + 2 `accessory` slots. Crown can occupy `accessory2` for now (no new slot to add, keeps backwards compat).
- Stats: +1 inventory cap
- Affix 1: `xpbonus10`
- Affix 2: `dropBonus15` (custom)
- Unique mechanic: **"+2 cards offered on level-up"** (modifies CARD_DRAFT_SIZE via flag)
- Spawnable: F8+

### 6. Phoenix Down Cloak 🔥 (accessory cape)
- Slot: accessory
- Stats: maxHp +10
- Affix 1: `regen1`
- Affix 2: `poison_immune`
- Unique mechanic: **"Auto-revive at 100% HP — once per run"** (flag `state.phoenixUsed`)
- Spawnable: F8+

### 7. Stormcaller Wand 🪄 (BONUS — fixes dead Apprentice Wand)
- Type: wand magic
- Stats: atk 4 + magic
- Affix 1: `crit15`
- Affix 2: `dmg25`
- Unique mechanic: **"Hits chain to nearest enemy in r2 for 50% damage"**
- Spawnable: F5+

Legendary spawn pool is **floor-gated**: each Legendary has minFloor; rolling Legendary picks weighted from eligible pool. F1–F2 → no Legendary even on roll (table shows 0/0% anyway).

---

## Identify mechanic (decision: **OUT — recommend skipping for v3-02**)

### Reasoning to KEEP IT OUT
1. **Mobile/touch UX**: tooltip is harder on touch. Adding `?` items + identify scroll + dedicated UI = 2x complexity, 1x reward.
2. **Tempo cost**: roguelikes that ship identify (Nethack, DCSS) tie it to deep meta — you learn that "potion of green = healing" via runs. In a 10-floor permadeath without persistence between runs, players don't learn anything; identify is just friction.
3. **Loop reward conflicts**: tier system itself is the suspense ("ooh purple!"). Adding identify _hides_ the tier reveal, dampening the very reward we're building. Two suspense systems compete.
4. **Implementation cost**: ~3–4h for identify scroll, unknown-item rendering, "identify on equip" rule, levelup card "Sage Insight" — significant for marginal gain.

### When to revisit
If after v3-02 ships, playtest shows tier rewards are **still too predictable** (gracz wie z 80% pewności co podniesie z ziemi), iterate toward partial identify — e.g. show tier color on ground but obscure affixes until pickup. That's a v3-03 candidate.

**Decision: tier color is visible on ground (border + glow), but full affix list and unique mechanic only revealed on pickup/inspect.** This gives "I see purple, I want it" hook without full identify complexity.

---

## Spawn algorithm pseudocode

```js
// Tier weights per floor — index 0..4 = COMMON..LEGENDARY
const TIER_TABLE = {
  1:[60,30,10,0,0], 2:[50,32,15,3,0], 3:[40,32,20,7,1], 4:[35,30,23,10,2],
  5:[25,30,30,10,5], 6:[20,25,30,18,7], 7:[15,22,30,23,10],
  8:[10,20,30,28,12], 9:[8,18,30,30,14], 10:[5,15,30,30,20]
};

const TIER = { COMMON:0, UNCOMMON:1, RARE:2, EPIC:3, LEGENDARY:4 };
const TIER_NAMES = ['Common','Uncommon','Rare','Epic','Legendary'];
const TIER_STATS = [1.00, 1.25, 1.50, 1.80, 2.20];
const TIER_AFFIX_COUNT = [0, 1, 1, 2, 3];           // affix count per tier
const TIER_BORDER = ['#94a3b8','#84cc16','#60a5fa','#a78bfa','#fbbf24'];

function rollTier(floor, opts = {}) {
  const weights = TIER_TABLE[Math.min(10, Math.max(1, floor))];
  let r = Math.random() * 100, cum = 0;
  for (let i = 0; i < 5; i++) {
    cum += weights[i];
    if (r < cum) {
      // Boss-room minimum-Rare upgrade
      if (opts.bossDrop && i < TIER.RARE) return TIER.RARE;
      return i;
    }
  }
  return TIER.COMMON;
}

function rollItem(floor, opts) {
  const tier = rollTier(floor, opts);

  // Legendary tier: hand-picked from unique pool
  if (tier === TIER.LEGENDARY) {
    const pool = LEGENDARY_DEFS.filter(d => (d.minFloor || 1) <= floor);
    if (pool.length === 0) return rollItem(floor, { ...opts, _downgraded: true });
    const def = pool[Math.floor(Math.random() * pool.length)];
    return makeTieredInstance(def, TIER.LEGENDARY, floor);
  }

  // Other tiers: pick from existing ITEM_DEFS by minFloor + slot eligibility
  const baseDef = pickWeightedItem(floor, d => d.slot && !d.consumable);
  if (!baseDef) return null;
  return makeTieredInstance(baseDef, tier, floor);
}

function makeTieredInstance(def, tier, floor) {
  const inst = makeItemInstance(def);
  inst.tier = tier;
  inst.tierName = TIER_NAMES[tier];

  // Apply stat multiplier
  const mult = TIER_STATS[tier];
  for (const stat of ['atk','def','maxDur','maxHp','critChance']) {
    if (inst[stat] != null) inst[stat] = Math.round(inst[stat] * mult * 100) / 100;
  }
  inst.dur = inst.maxDur;  // refresh dur to scaled max

  // Sample affixes
  const affixCount = TIER_AFFIX_COUNT[tier];
  inst.affixes = sampleAffixes(affixCount, tier, def.slot);

  // Display name with first affix as prefix
  if (inst.affixes.length > 0) {
    inst.name = `${inst.affixes[0].displayPrefix} ${def.name}`;
  }
  return inst;
}

function sampleAffixes(n, tier, slot) {
  const eligible = AFFIX_DEFS.filter(a =>
    a.tierMin <= tier &&
    (!a.slots || a.slots.includes(slot))
  );
  // For Rare: 1 major OR 2 minor (rule)
  // For Epic: 2 major
  // For Legendary: 1 minor + 2 major
  // Shuffle and pick respecting rule
  return weightedSampleNoRepeat(eligible, n, tier);
}
```

---

## Data schema additions

```js
// Append to top of file near CONFIG
const TIER = { COMMON:0, UNCOMMON:1, RARE:2, EPIC:3, LEGENDARY:4 };
const TIER_STATS  = [1.00, 1.25, 1.50, 1.80, 2.20];
const TIER_BORDER = ['#94a3b8','#84cc16','#60a5fa','#a78bfa','#fbbf24'];
const TIER_NAMES  = ['Common','Uncommon','Rare','Epic','Legendary'];
const TIER_AFFIX_COUNT = [0,1,1,2,3];
const TIER_TABLE = { 1:[60,30,10,0,0], /* ... */ 10:[5,15,30,30,20] };

// New affix table
const AFFIX_DEFS = [
  { id:'crit5',     displayPrefix:'Sharp',    tierMin:TIER.UNCOMMON,
    slots:['weapon'], apply:(it)=>{ it.critChance = (it.critChance||0)+0.05; } },
  { id:'lifesteal10', displayPrefix:'Vampiric', tierMin:TIER.UNCOMMON,
    slots:['weapon'], apply:(it)=>{ it.lifestealPct = (it.lifestealPct||0)+0.10; } },
  /* ... 15 more ... */
];

// New legendary pool
const LEGENDARY_DEFS = [
  { id:'reaver', name:'The Reaver', emoji:'⚔️', type:'weapon', slot:'weapon',
    atk:13, maxDur:90, minFloor:5, weaponType:'sword',
    affixes:['lifesteal30','crit15'],
    unique:{ id:'on_kill_heal', value:5,
             onKill:(p)=>{ p.hp = Math.min(p.maxHp, p.hp+5); } } },
  /* ... 5–6 more ... */
];

// On item instance:
inst.tier      // int 0..4
inst.tierName  // 'Common'..'Legendary'
inst.affixes   // [{ id, displayPrefix, apply }]
inst.unique    // optional unique mechanic (Legendary only)
```

---

## Implementation file:line

| Change | Location in `index.html` |
|--------|---------------------------|
| Add TIER consts + TIER_TABLE | After CONFIG block, ~L540 |
| Add AFFIX_DEFS array | Before ITEM_DEFS, ~L1015 |
| Add LEGENDARY_DEFS array | After ITEM_DEFS, ~L1048 |
| Modify `makeItemInstance` | L1812 — add tier field + scaling |
| Modify `pickWeightedItem` → wrap with `rollItem` | L1823 — call sites need to pass floor for tier roll |
| Spawn-site call sites | search `pickWeightedItem(` — likely 3–5 places (room population, mimic, drop) |
| Render border on ground tile | rendering pass for items — wherever item emoji is drawn on canvas |
| Render border on inventory slot | inventory UI render section |
| Tooltip with tier color | tooltip render |
| Legendary glow particle | particles spawn loop — emit on every visible-Legendary tile |
| Boss-room flag | room-entry handler — set `state.bossRoomDropPending=true` |
| Apply affixes to player stats | `recomputeStats` / equip handler — iterate `inst.affixes[].apply` |
| Apply unique mechanic hooks | combat / death / on-kill hooks — check `inst.unique.id` |

Search anchors:
- `ITEM_DEFS` → L1019
- `findItemDef` → L1808
- `makeItemInstance` → L1812
- `pickWeightedItem` → L1823

---

## UI/Visual changes

1. **Ground tile border**: 2px stroked rectangle in `TIER_BORDER[tier]` around item emoji on canvas. Common = no border (or grey, very faint).
2. **Inventory slot border**: same 2px border on each slot rendered in inventory grid.
3. **Tooltip**:
   ```
   [TIER COLOR HEADER] Sharp Iron Sword (Uncommon)
   ATK 5 (×1.25)  DUR 75/75
   • Sharp: +5% crit chance
   ```
4. **Legendary glow**: in `particles.update()`, every Legendary item on visible tile emits 1 particle/8 frames at random offset, golden, alpha 0.6→0.0 over 30 frames.
5. **Pickup feedback**: floating text on pickup `"+ TIER ITEMNAME"` colored by tier; existing `floatingTexts` array (L1800) handles this.
6. **Sound**: deferred — no audio system yet. Spec: common=thunk, uncommon=soft chime, rare=double chime, epic=chord, legendary=bell.

---

## Balance notes

### Power inflation check

Worst-case Legendary on F10: Battle Axe (atk 6) ×2.20 = atk 13 base + `dmg25` (+25%) + `crit15` (extra crits ×2). Effective avg per hit ≈ 13 × 1.25 × 1.075 (crit value) ≈ **17.5 dmg pre-DEF**. vs. Dragon DEF 14 = max(1, 17.5-14) = 3.5 → **dragon TTK ~54 hits**. Even with Berserker (×2 in execute) = 27 hits.

QA balance-report's existing recommendation #1–#2 (Dragon scaling 0.10, BLINK→FAST) MUST land before or alongside this plan, otherwise tier-Legendary still doesn't fix F10 unwinnable problem; it merely makes the build less narrow.

**Compounding risk with cards**: Berserker (+100% dmg axe) × Legendary axe ×2.2 stats × Sharp crit affix. If unchecked: ATK 6→13→26 in execute → 26 × 1.25 (dmg25) × 1.5 (avg crit) ≈ 49 dmg/swing. Single-shot small enemies → boring. **Mitigation**: cap stat mult on weapon atk at +10 absolute, OR reduce Legendary mult to ×2.0 (open variable). Recommend **shipping at ×2.2 and revising after playtest** — easier to nerf than buff.

### Consumable exemption protects economy

Healing potions stay flat 12HP. If they tiered, a "Legendary Health Potion" healing 26 HP would gut the F10 attrition design. Same for Fire Scroll (15→33 dmg = one-shots most enemies). Decision: **only equippables tier**.

### Affix stacking with existing cards

`lifesteal10` affix + `lifesteal` card (×3 stacks = 30%) = up to 40% lifesteal. Card vampire stack already noted as strong; +10% from affix is small enough to feel additive rather than build-defining. **OK.**

`crit5` affix + Lucky card (×5 = 25%) + Evil Eye (10%) + tier-rolled crit5 = 45% crit. Approaches "every other hit crits" territory. Watch in playtest.

### Boss-drop guarantee balance

F4 boss + auto-Rare = player has decent gear by F5 inflection. F8 boss + auto-Rare = mostly redundant (Rare is modal anyway by F8); could upgrade to "guaranteed Epic" on F8/F10 boss. **Recommend**: F4/F6 = min Rare, F8/F10 = min Epic.

### "Wow effect" fade

QA report flagged Legendary fatigue at 4 unique cards. With 6 unique Legendary equipment + 13 Legendary cards = 19 distinct "rare wow" items per run. Pity counter sits on cards already; tier system uses pure RNG (no pity on equipment). **Risk**: unlucky player 0 Legendary equipment in 10 floors. **Mitigation**: optional "soft pity" — if player passes F8 with 0 Legendary equipment, F9 forces 1 Legendary in the floor. Simple flag check.

---

## Acceptance criteria

- [ ] Item ma tier widoczny przed pickupem (color border na ground tile w canvas)
- [ ] F1 spawn distribution: Common ≥55%, Legendary 0% (1000-roll empirical test)
- [ ] F10 spawn distribution: Common ≤10%, Legendary ≥15% (1000-roll empirical test)
- [ ] Boss room F4 / F6 first item drop = guaranteed tier ≥ RARE
- [ ] Boss room F8 / F10 first item drop = guaranteed tier ≥ EPIC
- [ ] F10 Dragon kill drops a Legendary unique (deterministic)
- [ ] Tier color matches spec (grey/green/blue/purple/gold) in canvas + tooltip
- [ ] Legendary items have visible particle glow on ground
- [ ] Affix prefix appears in item name (e.g. "Sharp Iron Sword")
- [ ] Affix effect applies on equip (crit chance, lifesteal, defs etc.) and unapplies on unequip
- [ ] Unique Legendary mechanics fire correctly: Reaver on-kill heal, Obsidian Heart revive once/floor, Phoenix Down once/run, Aegis reflect 50%, Whisperwind line attack, Crown +2 cards on next levelup
- [ ] Existing 22 itemy nadal spawnują (smoke test: walk F1–F10, confirm Rusty Dagger / Iron Sword / Battle Axe etc. all appear at expected tiers)
- [ ] Consumables (potions, scrolls, key) NIE są tiered — pozostają flat
- [ ] Stat mult applies cleanly: Battle Axe Common atk 6, Rare atk 9 (×1.5), Epic atk 11 (×1.8 rounded)
- [ ] Tooltip pokazuje tier name + stats + affix list
- [ ] Pickup floating text colored by tier
- [ ] No existing card synergy (Sword Mastery, Berserker, etc.) breaks due to tier mult — affixy stackują additively z cardami w `recomputeStats`

---

## Estimated effort

**Total: 14–18 hours** (~2 working days for solo dev)

Breakdown:
- TIER + AFFIX + LEGENDARY data tables: 2h
- `rollItem` + `makeTieredInstance` + spawn integration: 2h
- Affix application in `recomputeStats` / equip / unequip: 2h
- Unique Legendary mechanics (6 hooks: on-kill, revive, reflect, line-pierce, +cards, phoenix): 3h
- Boss-drop guarantee + F10 dragon-Legendary: 1h
- Canvas border render (ground + inventory): 1.5h
- Tooltip tier display: 1h
- Legendary particle glow: 1h
- Acceptance test pass + balance distribution test (statistical): 2h
- Buffer for affix stacking edge cases + cards interaction: 1–3h

**Recommended split into vertical slices** (for `/plan` skill):
- Slice 1: data tables + tier roll + scaling math (no affixes)
- Slice 2: affix system + slot rules
- Slice 3: Legendary unique pool + 6 mechanics
- Slice 4: UI (border, glow, tooltip)
- Slice 5: boss-drop + F10 guarantee + acceptance tests

Each slice is independently testable and shippable.
