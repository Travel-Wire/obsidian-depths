# Balance Audit Report — Obsidian Depths
Date: 2026-04-30
Auditor: QA-Lead (CCGS)
Source: `index.html` (4706 lines), `plans/00-MASTER-PLAN.md`, plans 01–05.

## Executive Summary
Game is **playable but skewed**: floors 1–4 are well-tuned, floors 5–7 develop a power-curve gap as Brawn-stacking outpaces enemy DEF, and floor 10 (Dragon) is **mathematically borderline-unwinnable** without a specific build. Three critical issues dominate: (1) Dragon scaling produces a 188/28/14 statblock against a player whose mid-game DEF tops out around 9–11, with BLINK speed giving 2 hits per player turn — TTK > 50 hits while player dies in 2 turns; (2) `Mythril Body` legendary trivializes the entire armor/durability subsystem and **stacks additively** with `Resilient Aura` (-1) and `Endurance` (-30%) producing near-immunity; (3) Pity counter at 7 floors with three cards drawn per legendary draft yields a legendary roughly **every other level-up** late game — "wow effect" is gone by floor 6.

Top 3 priority fixes: nerf Dragon scaling, cap or rework Mythril Body, raise pity threshold and reduce legendary base rate.

## Severity Scale
- CRITICAL: psuje rozgrywkę / unfun / wymaga natychmiastowego fixu
- HIGH: wpływa na balance, ale gra grywalna
- MEDIUM: drobny issue, można żyć
- LOW: nice-to-have / polish

## Findings (per area)

### 1. Combat Math — HIGH
Base player: ATK 4 / DEF 1 / HP 25 / xpNext 15 (×1.5/lvl). MaxHP per level = +6.
Damage formula: `max(1, ATK - enemy.DEF + rand(-1,1))`, crits ×2 (5% base).
Enemy scaling: `1 + (floor-1) * 0.15` to HP/ATK/DEF.

| Floor | Enemy (key) | scaled HP / ATK / DEF | Player kit (typical) | TTK player→enemy | TTK enemy→player |
|------|------|------|------|------|------|
| 1 | Rat | 6/2/0 | Dagger ATK 5, DEF 1, 25 HP | 1–2 hits | 25 hits |
| 1 | Bat | 5/3/0 (50% dodge <50% HP) | Dagger ATK 5 | 1–2 (dodge tax) | 12 hits |
| 3 | Orc | 25/6/2 | Iron Sword ATK 8, DEF 3, ~37 HP | 4–6 hits | 9 hits |
| 5 | Ghost | 16/8/0 ignoresDef | Iron Sword ATK 8, ~49 HP | 3 hits | 6 hits |
| 7 | Demon | 56/12/4 (AoE 6 r2) | War Hammer ATK 9, DEF 5, ~67 HP | 8–10 hits | 5 hits |
| 10 | Dragon | **188/28/14** BLINK 200, breath 8 r5 | Battle Axe + 5×Brawn → ATK ~20, DEF ~10, ~79 HP | **40–60 hits** | **2 turns** |

**Verdict:** F1–F4 fine. F5 power dip (Iron Sword still atk 4 — no upgrade until F4 axe/hammer). F7 Demon AoE 6 ignoring half DEF is a spike. F10 Dragon is broken — even with optimal gear, player needs ~50 actions while Dragon kills in 2. Only `Berserker (axe, +100% dmg <50% HP)`, `Dragon's Blood (+50% vs boss)` and `Doppelganger` chain saves it; without the right cards, F10 is a **scripted death**.

### 2. Card Synergies & Combos — CRITICAL
- **Mythril Body + Resilient Aura + Endurance (3 stacks)**: -2 flat + -1 flat + -30% multiplicative on every hit, *and* armor never breaks. F10 dragon dmg drops from 19 → `ceil((19-3) * 0.7) = 12`. Combined with `Doppelganger` (25% double hit) you get effective DPS ×0.6. **The "tank" build trivializes survival.**
- **Hellfire**: requires Fire Aura + Death Touch, both rare (40% non-common roll). Synergy unlock fires Aura r2/3 dmg = 24 dmg/turn passive on a 3×3 around player. With Fire Aura already 1/turn r1, scaled enemies on F8+ (rat 14 HP, snake 18) **die just by walking near you**.
- **True Sight**: requires Sharp Eyes ×3 + Lucky ×3 + lvl 6. Realistic only on a long run; harmless.
- **Dual Wield + Doppelganger** stack additively in code (`if dop ... else if dual`) — fine, but `Doppelganger` (legendary, 25%) strictly dominates `Dual Wield` (rare, 25% but ½ dmg). Dual Wield is **dead content** once Doppelganger is acquired.
- **Necromancer + Slime splitter**: kill a slime → 30% raised as ally; slimes split on death (gen 2). The split children also "die" → another 30% roll each. Tested theoretical: 1 slime → up to 3 allies on a single kill chain. Snowball confirmed but contained (10-tick TTL).

### 3. Dominant Strategies — HIGH
1. **5×Brawn → Battle Axe → Berserker** — `+10 ATK` flat + axe ×2 below 50% HP. ATK 14 → 28 below 50%. Trivializes F8–F10. Best build always when axe drops.
2. **Mythril Body Tank** — pick on F4–6, stop caring about armor. Combined with Vigor ×5 (+50 maxHp → 99 HP) and Resilient Aura you absorb F10 breath 8 dmg as 5.
3. **Stardust + Frost Nova / Death Touch** — CD halved → Frost Nova every 6 turns r3 freeze for 5 ticks = permanent CC of all close-range enemies.

There is **no realistic build that picks Cat Reflexes (20% dodge)** over Resilience ×2 (+4 DEF), because flat DEF prevents 100% of low-roll hits whereas dodge = 20% expected. Lucky (5%/rank) is also weak vs Brawn.

### 4. Speed / Initiative System — HIGH
SPEED tiers: CRAWL 25 / SLOW 50 / NORMAL 100 / FAST 150 / BLINK 200. Player NORMAL = 100.
- **Bat** (FAST 150) on F1: 1.5 actions per player action, ATK 3 dodge 0.5. Statistically loses 75% of trades but **frustrating** for new players (death by 1 dmg each turn).
- **Rat** (FAST 150) coward AI: low threat, but constant catch-up loops drag tempo.
- **Wraith** (FAST 150, omni, drains XP 5): combines fast + OMNIDIRECTIONAL movement + xp drain. F5 introduction is harsh — can drain **multiple level-ups of progress** in 4–5 hits.
- **Dragon BLINK 200** + 5-tile breath: gets 2 actions per player turn AND a ranged AoE option. **Unfair** even under "boss" conventions.
- **FREEZE**: 5-tick freeze from Frost Nova / Wizard. Player cast on Wizard = trivial CC. No diminishing returns → stunlock loops possible.

### 5. Item Economy — MEDIUM
- 8–14 rooms × 2–3 items/room = **16–42 items spawned per floor**, minus 10% mimic substitution rate (F3+).
- `ensureMin`: 1 weapon + 1 armor + 2 potions guaranteed per floor.
- Anvil chance: 50% from F3 onward = **expected ~4 anvils across F3–F10**. Sufficient.
- Durability turnover: Rusty Dagger 50/1-wear ≈ 50 hits ≈ ~25 enemies. Iron Sword 60. Battle Axe 50/2-wear (twoHanded) → 25 hits = ~10 enemies. **Battle Axe runs out fast** without an anvil.
- Healing economy: 2 potions/floor × 10 floors = 20 heals × ~8 avg hp = 160 HP. F10 dragon does ~20 dmg/round → 8 heal-rounds total. Tight but viable.

### 6. FOV / Lighting — MEDIUM
TORCH_RADIUS 6 (current) vs Plan 01's intent of 3. Perimeter walls always revealed.
- 6 tiles = visible area ~113 tiles. Map 64×44 = 2816 tiles. Ratio 4% — still "torchowo", but dungeon feels more open than the plan expected.
- Sharp Eyes ×3 → torch 9 (max). True Sight → +2 → 11 (capped at MAX 9? — `TORCH_RADIUS_MAX: 9` defined but `effectiveTorchRadius` doesn't clamp; **bug**: True Sight overrides cap silently).
- Lit rooms (20% chance + bonus for >35-area) make ~2–3 rooms per floor fully visible. Combined with TORCH 6, "darkness puzzle" feel is **diluted**.
- Recommend TORCH_RADIUS 5 (compromise).

### 7. Doors Mechanic — MEDIUM
~34 closed doors per level (every corridor↔room boundary). Each = 1 turn open + 1 turn step = **2 turns per room entry**. With 10 rooms × 2 doors avg = 40+ tempo turns per floor just on doors. Combined with chase memory 15-tick AI, fleeing through doors briefly resets pursuit (door blocks vision) but enemies open doors too. **Tempo: tolerable, slightly grindy.**

### 8. AI Chase Memory — HIGH
`lastSeenPlayer.tick` valid for 15 ticks. After expiry, enemy stops chasing. With Bat speed 150 = 22 ticks of chase before forgetting. Over 10 floors enemies converge on the player relentlessly.
- **Player can hide**: 16+ tile retreat behind 2 doors usually shakes pursuit.
- **Snake (zigzag)** + 15-tick memory = will chase you through 10 rooms because zigzag re-acquires LOS every other step.
- **Verdict**: 15 is on the high end. 8–10 ticks would feel less obsessive without breaking AI.

### 9. Trap Density — HIGH
TRAP_CHANCE_PER_ROOM 0.35 + TRAP_CHANCE_CORRIDOR 0.12. With 10 rooms × 0.35 = ~3.5 room traps/floor + corridor density. 5 trap types unlocking F1/F2/F3/F4/F2.
- Spike trap dmg 4–8 on F1 = **16–32% of starting HP from a single tile**. With trap reveal only after step, F1 player hits a spike trap and is at 17 HP through no mistake.
- Explosion trap 6–12 r2 from F3: **AoE damage 6–12** can chain-kill the player.
- TRAP_CHANCE_PER_ROOM 0.35 is too aggressive — consider 0.20–0.25 for F1–F2 with progressive scaling.

### 10. Pity Counter & Card Drops — CRITICAL
`pityCounter >= 7` → next draft guarantees one legendary slot.
Base legendary roll: 10% per slot × 3 slots/draft = ~27% chance per level-up to see a legendary anyway. Combined with pity reset on legendary pick, **realistic legendary cadence is ~5 level-ups average late-game**, dropping to ~3 after pity hits.
- Player levels: ~lvl 3 by F2, ~lvl 6 by F5, ~lvl 9–10 by F10. Total ~9 level-ups → **3–4 legendaries per run** expected.
- 13 legendary cards exist (7 standalone + 2 synergy + 4 weapon variants). After 4 legendaries the "wow" is depleted.
- **Recommend**: pity threshold 10, base legendary roll 5%, ensure first legendary feels earned.

## Dominant Strategies (top 3)
1. **Brawn-stack Berserker Axe** — 5×Brawn + Battle Axe + Berserker = ATK 28 in execute phase. Trivializes F7+.
2. **Mythril Tank** — Mythril Body + Resilient Aura + Vigor ×5 + Endurance ×3. Effective HP ~140, dmg taken cut ~50%.
3. **Stardust CC Lock** — Frost Nova every 6 turns r3 / 5-tick freeze stunlocks 3+ enemies indefinitely.

## Dead Content (top 5)
1. **Dual Wield** (rare) — strictly worse than Doppelganger (legendary 25% full dmg vs 25% half dmg).
2. **Cat Reflexes 20% dodge** — flat DEF stacking is mathematically superior in this `max(1, atk-def)` model.
3. **Apprentice Wand** (atk 2 magic) — no spell scaling implemented in current ITEM_DEFS; pure inferior to Iron Sword (atk 4) on every metric.
4. **Tattered Robes** (def 1, dur 30) — Leather Vest (def 2, dur 50) appears at the same minFloor 2; Robes obsolete after F2.
5. **Wizard enemy** (hp 16 / atk 3) — fragile, low spawn weight 5, low XP relative to risk; rare appearance, easy kill — a forgettable presence.

## Tuning Recommendations
- [ ] 1. **Dragon scaling**: drop scale multiplier to `1 + (floor-1) * 0.10` for boss-tier enemies (forceSpawn=true). Dragon HP 80 → 152 instead of 188; ATK 12 → 23 instead of 28.
- [ ] 2. **Dragon BLINK 200 → FAST 150**: still faster than player but not 2×.
- [ ] 3. **Mythril Body**: change from "armor never loses dur" to "armor max dur ×2 and -50% wear" — keeps theme without breaking the subsystem.
- [ ] 4. **Pity counter 7 → 10**, base legendary roll 10% → 6%; result: ~2 legendaries per 10-level run.
- [ ] 5. **Brawn maxStacks 5 → 3** (or +2 ATK → +1 ATK after 3rd stack): keeps the card desirable but caps top-end.
- [ ] 6. **TRAP_CHANCE_PER_ROOM 0.35 → 0.25** for F1–F3, scale to 0.35 for F4+. Spike trap F1 dmg `[4,8]` → `[2,5]`.
- [ ] 7. **AI chaseMemory 15 → 10 ticks**: gives player viable hide/escape windows without breaking pursuit.
- [ ] 8. **Cat Reflexes 20% → 30% dodge** OR add "first hit per turn always dodged" — make it competitive with flat DEF.
- [ ] 9. **Dual Wield**: change to "always second strike at ½ dmg" (deterministic) so it differentiates from Doppelganger.
- [ ] 10. **Battle Axe maxDur 50 → 70** OR halve twoHanded wear (from `wear*2` to `wear*1.5`): currently axe is the dominant weapon but breaks fastest.
- [ ] 11. **TORCH_RADIUS 6 → 5** with `effectiveTorchRadius` clamped to `TORCH_RADIUS_MAX` (currently uncapped due to bug). Preserves "torchowy" feel.
- [ ] 12. **Wraith XP drain 5 → 3** AND only on hits >50% player HP: prevent multi-level rollback.

## Floor-by-Floor Difficulty Curve (1=trivial, 10=brutal)
| Floor | Difficulty | Notes |
|------|------|------|
| 1 | 3 | Tutorial-friendly, only Bat dodge frustrates. |
| 2 | 4 | Snake poison + Bat is annoying combo. |
| 3 | 5 | Goblin throwers + first mimics + traps stack. |
| 4 | 5 | Battle Axe / Chain Mail unlock — power restored. |
| 5 | 7 | **Power dip**: Ghost ignoresDef + Wraith XP drain. |
| 6 | 6 | Card snowball begins to compensate. |
| 7 | 8 | Demon AoE 6 r2 + teleport + scaling = brutal. |
| 8 | 7 | Player should have 2+ legendaries; manageable. |
| 9 | 8 | Compounded enemy scaling. |
| 10 | **10** | Dragon math — see above. Build-dependent unwinnable. |

## Risk Register
| # | Risk | Severity |
|---|---|---|
| 1 | Dragon F10 unwinnable without specific build (axe Berserker / Doppelganger) — players reaching F10 will rage-quit | CRITICAL |
| 2 | Mythril Body trivializes a 5-plan-deep durability mechanic; designers may have shipped a feature their own legendary card cancels | CRITICAL |
| 3 | F5 power dip (Ghost ignoresDef + Wraith XP drain) is the most likely run-ending floor — many players never reach F10 | HIGH |
